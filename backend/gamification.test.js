import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BADGES,
  REPAIR_SIZE,
  XP,
  ackWelcomeBack,
  award,
  badgeLadder,
  claimWelcomeBack,
  dayDiff,
  dayOffset,
  dayStartMs,
  examModuleXp,
  examRewardsFor,
  generatedXp,
  getProgress,
  levelInfo,
  logAnswer,
  markExamRewardsSeen,
  queueExamReward,
  recordAnswer,
  repairStatus,
  repairableDay,
  scaled,
  scoreDrill,
  scoreIeltsEssay,
  scoreIeltsPart,
  scorePlanTask,
  scorePracticeAnswer,
  scoreRemixAnswer,
  scoreVocabReview,
  settleRepair,
  skyOf,
  startDrill,
  startRepair,
  streakOf,
  todayKey,
  weekKey,
  welcomeBackStatus,
  xpGuide
} from "./gamification.js";

describe("levelInfo", () => {
  test("starts at level 1 with 0 xp", () => {
    assert.deepEqual(levelInfo(0), { level: 1, xpIntoLevel: 0, xpForNext: 100 });
  });

  test("stays level 1 just below the level-2 threshold", () => {
    const info = levelInfo(99);
    assert.equal(info.level, 1);
    assert.equal(info.xpIntoLevel, 99);
  });

  test("reaches level 2 exactly at 100 xp", () => {
    const info = levelInfo(100);
    assert.equal(info.level, 2);
    assert.equal(info.xpIntoLevel, 0);
    assert.equal(info.xpForNext, 150);
  });

  test("level requirements grow by 50 each level", () => {
    // level 2 needs 150 (total 250), level 3 needs 200 (total 450)
    assert.equal(levelInfo(249).level, 2);
    assert.equal(levelInfo(250).level, 3);
    assert.equal(levelInfo(250).xpForNext, 200);
  });
});

describe("todayKey / dayOffset / weekKey", () => {
  test("dayOffset moves forward and backward across month boundaries", () => {
    assert.equal(dayOffset("2026-01-31", 1), "2026-02-01");
    assert.equal(dayOffset("2026-03-01", -1), "2026-02-28");
  });

  test("weekKey returns the Monday of the given date's week", () => {
    // 2026-09-22 is a Tuesday
    assert.equal(weekKey("2026-09-22"), "2026-09-21");
    // 2026-09-21 is itself a Monday
    assert.equal(weekKey("2026-09-21"), "2026-09-21");
    // 2026-09-27 is a Sunday, still belongs to the week starting 2026-09-21
    assert.equal(weekKey("2026-09-27"), "2026-09-21");
  });

  test("todayKey returns a YYYY-MM-DD string", () => {
    assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("scaled", () => {
  test("maps 0 accuracy to 200 and 1.0 accuracy to 800", () => {
    assert.equal(scaled(0), 200);
    assert.equal(scaled(1), 800);
  });

  test("clamps out-of-range accuracy instead of producing an invalid score", () => {
    assert.equal(scaled(-0.5), 200);
    assert.equal(scaled(1.5), 800);
  });

  test("rounds to the nearest 10", () => {
    const s = scaled(0.5);
    assert.equal(s % 10, 0);
  });
});

describe("getProgress", () => {
  test("creates a fresh progress record with the expected shape", () => {
    const db = { progress: [] };
    const p = getProgress(db, "user-1");
    assert.equal(p.userId, "user-1");
    assert.equal(p.xp, 0);
    assert.deepEqual(p.saved, []);
    assert.deepEqual(p.examMistakes, []);
    assert.equal(db.progress.length, 1);
  });

  test("backfills examMistakes on a progress record that predates the field", () => {
    const db = { progress: [{ userId: "legacy", xp: 40, xpLog: {}, streak: { current: 0, longest: 0, lastDate: null }, combo: 0, bestCombo: 0, answered: {}, saved: [], vocab: {}, plan: {}, drills: [], badges: [], targetScore: 1400, dailyGoal: 50 }] };
    const p = getProgress(db, "legacy");
    assert.deepEqual(p.examMistakes, []);
  });

  test("returns the same record on repeated calls instead of duplicating it", () => {
    const db = { progress: [] };
    getProgress(db, "user-1");
    getProgress(db, "user-1");
    assert.equal(db.progress.length, 1);
  });
});

// Marks the days `n` days ago as studied, the way award() would have on those days.
function studied(p, ...daysAgo) {
  for (const n of daysAgo) p.days[dayOffset(todayKey(), -n)] = "active";
  p.streak.lastDate = Object.keys(p.days).sort().at(-1);
  return p;
}

describe("award", () => {
  function freshProgress() {
    return getProgress({ progress: [] }, "u");
  }

  test("adds xp and logs it under today", () => {
    const p = freshProgress();
    const today = todayKey();
    award(p, 10);
    assert.equal(p.xp, 10);
    assert.equal(p.xpLog[today], 10);
  });

  test("starts a streak at 1 on the first day and grows it on a consecutive day", () => {
    const p = freshProgress();
    award(p, 5);
    assert.equal(p.streak.current, 1);
    const q = freshProgress();
    studied(q, 4, 3, 2, 1);
    award(q, 5);
    assert.equal(q.streak.current, 5);
    assert.equal(q.streak.longest, 5);
  });

  test("starts the streak again at 1 after missed days, and keeps the best one", () => {
    const p = freshProgress();
    studied(p, 9, 8, 7, 6, 5, 4, 3);
    p.streak.longest = 7;
    award(p, 5);
    assert.equal(p.streak.current, 1);
    assert.equal(p.streak.longest, 7);
  });

  test("reports leveledUp only when the award crosses a level boundary", () => {
    const p = freshProgress();
    const r1 = award(p, 50);
    assert.equal(r1.leveledUp, false);
    const r2 = award(p, 60); // 50 + 60 = 110, crosses the level-2 threshold at 100
    assert.equal(r2.leveledUp, true);
    assert.equal(r2.level, 2);
  });

  test("only awards a badge once even if its condition is met again", () => {
    const p = freshProgress();
    studied(p, 2, 1); // today makes it 3, crossing the streak_3 badge threshold
    const r1 = award(p, 5);
    assert.ok(r1.newBadges.some((b) => b.id === "streak_3"));
    assert.equal(p.badges.filter((b) => b.id === "streak_3").length, 1);

    // Same-day award again: streak.current is still >= 3, but the badge must not duplicate.
    const r2 = award(p, 5);
    assert.ok(!r2.newBadges.some((b) => b.id === "streak_3"));
    assert.equal(p.badges.filter((b) => b.id === "streak_3").length, 1);
  });

  test("goalReached fires exactly once when crossing the daily goal", () => {
    const p = freshProgress();
    p.dailyGoal = 20;
    const r1 = award(p, 15);
    assert.equal(r1.goalReached, false);
    const r2 = award(p, 10); // 15 + 10 = 25, crosses the 20 xp daily goal
    assert.equal(r2.goalReached, true);
    const r3 = award(p, 5);
    assert.equal(r3.goalReached, false);
  });
});

// ---------- XP rules (anti-farming) ----------
const fresh = () => getProgress({ progress: [] }, "u");
const Q = (id, difficulty = "Medium") => ({ id, difficulty });

describe("XP scales with difficulty", () => {
  test("easy < medium < hard < challenging for a first correct answer", () => {
    const p = fresh();
    const easy = recordAnswer(p, Q("e", "Easy"), { correct: true }).xp;
    const medium = recordAnswer(p, Q("m", "Medium"), { correct: true }).xp;
    const hard = recordAnswer(p, Q("h", "Hard"), { correct: true }).xp;
    const challenging = recordAnswer(p, Q("c", "Challenging"), { correct: true }).xp;
    assert.deepEqual([easy, medium, hard, challenging], [XP.question.Easy, XP.question.Medium, XP.question.Hard, XP.question.Challenging]);
    assert.ok(easy < medium && medium < hard && hard < challenging);
  });

  test("Challenging solves count toward Hard Hitter, and a remixed one pays like Hard", () => {
    const p = fresh();
    let got = [];
    for (let i = 0; i < 10; i++) got = scorePracticeAnswer(p, Q(`c${i}`, "Challenging"), { correct: true }).badges;
    assert.ok(got.includes("hard_hitter"));
    assert.equal(generatedXp("Challenging"), XP.remix.Hard);
  });

  test("a question with no known difficulty is paid as medium", () => {
    assert.equal(recordAnswer(fresh(), Q("x", "Tricky"), { correct: true }).xp, XP.question.Medium);
  });

  test("generated questions and IELTS parts scale the same way", () => {
    assert.ok(XP.remix.Easy < XP.remix.Medium && XP.remix.Medium < XP.remix.Hard);
    const p = fresh();
    const xp = ["EASY", "MEDIUM", "HARD"].map((level) => scoreIeltsPart(p, `part-${level}`, level, 10));
    assert.ok(xp[0] < xp[1] && xp[1] < xp[2]);
  });
});

describe("a question pays its full XP once", () => {
  test("repeating a solved question earns review XP once a day, then nothing", () => {
    const p = fresh();
    const q = Q("q1", "Hard");
    assert.equal(recordAnswer(p, q, { correct: true }).xp, XP.question.Hard);
    const again = recordAnswer(p, q, { correct: true });
    assert.equal(again.kind, "review");
    assert.equal(again.xp, XP.review);
    for (let i = 0; i < 20; i++) assert.equal(recordAnswer(p, q, { correct: true }).xp, 0);
    assert.equal(p.answered.q1.attempts, 22);
  });

  test("review XP across many solved questions stops at the daily cap", () => {
    const p = fresh();
    let review = 0;
    for (let i = 0; i < 30; i++) {
      recordAnswer(p, Q(`q${i}`), { correct: true });
      review += recordAnswer(p, Q(`q${i}`), { correct: true }).xp;
    }
    assert.equal(review, XP.reviewDailyCap);
  });

  test("an assisted answer pays a share, and the later clean answer only the rest", () => {
    const p = fresh();
    const q = Q("q1", "Hard");
    const assisted = recordAnswer(p, q, { correct: true, assisted: true });
    assert.equal(assisted.kind, "assisted");
    assert.equal(assisted.xp, Math.ceil(XP.question.Hard * XP.assistedShare));
    assert.equal(recordAnswer(p, q, { correct: true, assisted: true }).xp, 0, "a second assisted answer pays nothing");
    const clean = recordAnswer(p, q, { correct: true });
    assert.equal(assisted.xp + clean.xp, XP.question.Hard);
    assert.equal(recordAnswer(p, q, { correct: true }).kind, "review");
  });

  test("wrong answers pay once, on the first attempt only", () => {
    const p = fresh();
    const q = Q("q1");
    assert.equal(recordAnswer(p, q, { correct: false }).xp, XP.firstMiss);
    for (let i = 0; i < 10; i++) assert.equal(recordAnswer(p, q, { correct: false }).xp, 0);
    assert.equal(recordAnswer(p, q, { correct: true }).xp, XP.question.Medium, "the first correct answer still pays in full");
  });

  test("answers from before per-question XP count as already paid", () => {
    const p = fresh();
    p.answered.old = { attempts: 2, correct: 1, lastCorrect: true, lastAt: "2026-09-01T10:00:00.000Z" };
    p.answered.missed = { attempts: 1, correct: 0, lastCorrect: false, lastAt: "2026-09-01T10:00:00.000Z" };
    assert.equal(recordAnswer(p, Q("old", "Hard"), { correct: true }).kind, "review");
    assert.equal(recordAnswer(p, Q("missed", "Hard"), { correct: true }).xp, XP.question.Hard);
  });
});

describe("the practice player's answer", () => {
  test("the long-haul badges: 20 in a row, 10 hard first tries, 100 solved, level 10", () => {
    const p = fresh();
    let got = [];
    for (let i = 0; i < 20; i++) got = scorePracticeAnswer(p, Q(`h${i}`, "Hard"), { correct: true }).badges;
    assert.ok(got.includes("combo_20") && got.includes("hard_hitter"));
    assert.ok(!got.includes("century"));
    for (let i = 0; i < 80; i++) got = scorePracticeAnswer(p, Q(`m${i}`), { correct: true }).badges;
    assert.ok(got.includes("century") && !got.includes("galaxy_brain"));
    const wrong = scorePracticeAnswer(p, Q("w1", "Hard"), { correct: false }).badges;
    assert.ok(!wrong.includes("century"), "a wrong answer earns none of them");
    assert.ok(award(fresh(), 5000).newBadges.some((b) => b.id === "level_10"));
    for (const id of ["combo_20", "streak_14", "streak_30", "level_20", "galaxy_brain", "clean_slate", "drill_10", "lexicon", "stargazer"]) assert.ok(BADGES[id], id);
  });

  test("the trophy card: every badge has its line, and a ladder badge points at the next rung", () => {
    for (const [id, b] of Object.entries(BADGES)) assert.ok(b.cheer && b.cheer !== b.desc, id);
    const p = fresh();
    for (let i = 0; i < 7; i++) award(p, 0, scorePracticeAnswer(p, Q(`q${i}`), { correct: true }).badges);
    assert.deepEqual(badgeLadder(p, "combo_5"), { step: 1, size: 3, next: { id: "combo_10", need: 10, have: 7, tally: "Best run so far: 7 of 10 in a row" } });
    assert.equal(badgeLadder(p, "first_steps"), null, "a badge on its own has no ladder");
    // The next rung is the first one not yet earned, and the top rung has nothing above it.
    p.badges.push({ id: "combo_10", earnedAt: new Date().toISOString() }, { id: "combo_20", earnedAt: new Date().toISOString() });
    assert.equal(badgeLadder(p, "combo_5").next, null);
    assert.deepEqual(badgeLadder(p, "combo_20"), { step: 3, size: 3, next: null });
    // The mock exam pair has no count, and a count past the mark stops at the mark.
    assert.deepEqual(badgeLadder(p, "mock_finisher"), { step: 1, size: 2, next: { id: "full_test" } });
    p.xp = 50000;
    assert.deepEqual(badgeLadder(p, "level_5").next, { id: "level_10", need: 10, have: 10, tally: "Level 10 of 10" });
  });

  test("only new questions build the combo, and the bonus starts at three in a row", () => {
    const p = fresh();
    const xp = [1, 2, 3].map((i) => scorePracticeAnswer(p, Q(`q${i}`), { correct: true }).xp);
    assert.deepEqual(xp, [XP.question.Medium, XP.question.Medium, XP.question.Medium + XP.combo]);
    assert.equal(p.combo, 3);
    for (let i = 0; i < 10; i++) scorePracticeAnswer(p, Q("q1"), { correct: true });
    assert.equal(p.combo, 3, "re-solving a solved question doesn't grow the combo");
    assert.ok(!scorePracticeAnswer(p, Q("q2"), { correct: true }).badges.includes("combo_5"));
    scorePracticeAnswer(p, Q("q3"), { correct: false });
    assert.equal(p.combo, 0);
  });

  test("missing on purpose and clearing the mistake again can't be repeated for XP", () => {
    const p = fresh();
    const q = Q("q1", "Easy");
    const miss = scorePracticeAnswer(p, q, { correct: false });
    assert.equal(miss.autoSaved, true);
    const clear = scorePracticeAnswer(p, q, { correct: true });
    assert.equal(clear.cleared, true);
    assert.ok(clear.badges.includes("mistake_crusher"));
    assert.equal(clear.xp, XP.question.Easy + XP.mistakeCleared);
    const total = miss.xp + clear.xp;
    let loop = 0;
    for (let i = 0; i < 15; i++) {
      loop += scorePracticeAnswer(p, q, { correct: false }).xp;
      loop += scorePracticeAnswer(p, q, { correct: true }).xp;
    }
    assert.ok(loop <= XP.review, `the loop earned ${loop} XP after the first ${total}`);
    assert.ok(!p.saved.includes("q1"));
  });

  test("an assisted answer doesn't clear a saved mistake", () => {
    const p = fresh();
    scorePracticeAnswer(p, Q("q1"), { correct: false });
    const r = scorePracticeAnswer(p, Q("q1"), { correct: true, assisted: true });
    assert.equal(r.cleared, false);
    assert.ok(p.saved.includes("q1"));
  });
});

describe("other XP sources can't be repeated either", () => {
  test("a generated variant pays once, and only up to the daily cap", () => {
    const p = fresh();
    assert.equal(scoreRemixAnswer(p, "rmx.a.2.1", "Hard", { correct: true }), XP.remix.Hard);
    assert.equal(scoreRemixAnswer(p, "rmx.a.2.1", "Hard", { correct: true }), 0);
    assert.equal(scoreRemixAnswer(p, "rmx.a.0.2", "Easy", { correct: false }), 0);
    assert.equal(scoreRemixAnswer(p, "rmx.a.0.2", "Easy", { correct: true, retry: true }), Math.ceil(XP.remix.Easy * XP.assistedShare));
    let total = 0;
    for (let i = 10; i < 60; i++) total += scoreRemixAnswer(p, `rmx.a.2.${i}`, "Hard", { correct: true });
    assert.equal(p.daily.remixXp, XP.remixDailyCap);
    assert.ok(total < 50 * XP.remix.Hard);
  });

  test("a flashcard pays once a day per word, up to the daily cap", () => {
    const p = fresh();
    assert.equal(scoreVocabReview(p, "w1"), XP.vocab);
    assert.equal(scoreVocabReview(p, "w1"), 0);
    let total = XP.vocab;
    for (let i = 2; i < 80; i++) total += scoreVocabReview(p, `w${i}`);
    assert.equal(total, XP.vocabDailyCap);
  });

  test("the daily counters start again on a new day", () => {
    const p = fresh();
    scoreVocabReview(p, "w1");
    p.daily.date = dayOffset(todayKey(), -1);
    assert.equal(scoreVocabReview(p, "w1"), XP.vocab);
  });

  test("un-ticking and re-ticking a plan task pays once", () => {
    const p = fresh();
    assert.equal(scorePlanTask(p, "2026-09-28", 2), XP.planTask);
    assert.equal(scorePlanTask(p, "2026-09-28", 2), 0);
    assert.equal(scorePlanTask(p, "2026-09-28", 3), XP.planTask);
    assert.equal(scorePlanTask(p, "2026-10-05", 2), XP.planTask, "a new week pays again");
    assert.deepEqual(Object.keys(p.planPaid), ["2026-10-05"]);
  });

  test("plan tasks ticked before this bookkeeping existed count as already paid", () => {
    const legacy = { userId: "old", xp: 40, xpLog: {}, streak: { current: 0, longest: 0, lastDate: null }, combo: 0, bestCombo: 0, answered: {}, saved: [], vocab: {}, plan: { "2026-09-28": [0, 4] }, drills: [], badges: [], targetScore: 1400, dailyGoal: 50 };
    const p = getProgress({ progress: [legacy] }, "old");
    assert.equal(scorePlanTask(p, "2026-09-28", 4), 0);
    assert.equal(scorePlanTask(p, "2026-09-28", 1), XP.planTask);
  });

  test("repeating an IELTS part only pays for a better score", () => {
    const p = fresh();
    const first = scoreIeltsPart(p, "L1", "MEDIUM", 6);
    assert.equal(first, XP.ieltsPart + 6 * XP.ieltsCorrect.MEDIUM);
    assert.equal(scoreIeltsPart(p, "L1", "MEDIUM", 6), 0);
    assert.equal(scoreIeltsPart(p, "L1", "MEDIUM", 4), 0);
    assert.equal(scoreIeltsPart(p, "L1", "MEDIUM", 10), 4 * XP.ieltsCorrect.MEDIUM);
    // A part tried before this bookkeeping existed starts from its best earlier score.
    assert.equal(scoreIeltsPart(p, "L2", "EASY", 10, 10), 0);
    assert.equal(scoreIeltsPart(p, "L3", "EASY", 10, 7), 3 * XP.ieltsCorrect.EASY);
  });

  test("an essay pays in full once, however often it is handed in", () => {
    const p = fresh();
    assert.equal(scoreIeltsEssay(p, "W1", "HARD", false), XP.ieltsEssayShort);
    assert.equal(scoreIeltsEssay(p, "W1", "HARD", true), XP.ieltsEssay.HARD - XP.ieltsEssayShort);
    assert.equal(scoreIeltsEssay(p, "W1", "HARD", true), 0);
    assert.equal(scoreIeltsEssay(p, "W2", "MEDIUM", true, true), 0);
  });

  test("mock-exam modules pay per correct answer, with a bonus for a perfect one", () => {
    assert.equal(examModuleXp(0, 10), XP.examModule);
    assert.equal(examModuleXp(7, 10), XP.examModule + 7 * XP.examCorrect);
    assert.equal(examModuleXp(10, 10), XP.examModule + 10 * XP.examCorrect + XP.examPerfect);
    assert.equal(examModuleXp(0, 0), XP.examModule);
  });
});

describe("drill bonus", () => {
  // Answers a drill question the way the practice route does.
  function answer(p, id, { correct = true, assisted = false } = {}) {
    scorePracticeAnswer(p, Q(id), { correct, assisted });
    logAnswer(p, { q: id, at: new Date().toISOString(), ok: correct, ...(assisted ? { a: true } : {}) });
  }
  const ids = ["a", "b", "c", "d", "e"];

  test("a perfect drill of new questions earns the full bonus and the badge", () => {
    const p = fresh();
    startDrill(p, ids);
    ids.forEach((id) => answer(p, id));
    const r = scoreDrill(p);
    assert.equal(r.xp, XP.drillComplete + XP.drillPerfect);
    assert.deepEqual(r.badges, ["perfect_drill"]);
    assert.deepEqual([r.total, r.correct], [5, 5]);
    assert.equal(p.drills.length, 1);
  });

  test("the bonus can't be claimed twice, or without a drill", () => {
    const p = fresh();
    assert.equal(scoreDrill(p), null);
    startDrill(p, ids);
    ids.forEach((id) => answer(p, id));
    assert.ok(scoreDrill(p).xp > 0);
    assert.equal(scoreDrill(p), null);
  });

  test("a drill nobody answered earns nothing", () => {
    const p = fresh();
    startDrill(p, ids);
    assert.equal(scoreDrill(p), null);
    assert.equal(p.drills.length, 0);
  });

  test("re-running questions that were already solved earns no bonus XP", () => {
    const p = fresh();
    ids.forEach((id) => {
      scorePracticeAnswer(p, Q(id), { correct: true });
      logAnswer(p, { q: id, at: new Date(Date.now() - 60000).toISOString(), ok: true });
    });
    startDrill(p, ids);
    ids.forEach((id) => answer(p, id));
    const r = scoreDrill(p);
    assert.equal(r.xp, 0);
    assert.deepEqual(r.badges, ["perfect_drill"], "it is still a perfect drill");
  });

  test("a miss or an assisted answer means the drill isn't perfect", () => {
    const p = fresh();
    startDrill(p, ids);
    answer(p, "a", { correct: false });
    answer(p, "a", { assisted: true }); // the retry doesn't change the first answer
    ["b", "c", "d", "e"].forEach((id) => answer(p, id));
    const r = scoreDrill(p);
    assert.deepEqual([r.total, r.correct], [5, 4]);
    assert.equal(r.xp, XP.drillComplete);
    assert.deepEqual(r.badges, []);
  });

  test("answers given before the drill started don't count toward it", () => {
    const p = fresh();
    logAnswer(p, { q: "a", at: new Date(Date.now() - 60000).toISOString(), ok: true });
    startDrill(p, ids);
    assert.equal(scoreDrill(p), null);
  });
});

describe("exam rewards queue", () => {
  test("rewards wait per session until they are marked seen", () => {
    const p = fresh();
    queueExamReward(p, { sessionId: "s1", moduleId: "m1", moduleName: "Reading & Writing" }, award(p, 95, ["mock_finisher"]));
    queueExamReward(p, { sessionId: "s1", moduleId: "m2", moduleName: "Math" }, award(p, 45, ["full_test"]));
    queueExamReward(p, { sessionId: "s2", moduleId: "m9", moduleName: "Math" }, award(p, 25));
    const s1 = examRewardsFor(p, "s1");
    assert.equal(s1.items.length, 2);
    assert.equal(s1.totalXp, 140);
    assert.equal(s1.unseen, 2);
    assert.equal(s1.items[0].moduleName, "Reading & Writing");
    assert.ok(s1.items[0].newBadges.some((b) => b.id === "mock_finisher"));
    assert.equal(markExamRewardsSeen(p, "s1"), 2);
    assert.equal(markExamRewardsSeen(p, "s1"), 0);
    assert.equal(examRewardsFor(p, "s1").unseen, 0);
    assert.equal(examRewardsFor(p, "s1").totalXp, 140, "they stay on the results page after being seen");
    assert.equal(examRewardsFor(p, "s2").unseen, 1);
    assert.deepEqual(examRewardsFor(p, "nope"), { items: [], totalXp: 0, unseen: 0 });
  });
});

describe("xpGuide", () => {
  test("lists the amounts from the rules", () => {
    const guide = xpGuide();
    assert.ok(guide.length >= 6);
    assert.ok(guide.every((g) => typeof g.xp === "string" && g.label.length > 5));
    assert.equal(guide[0].xp, `${XP.question.Easy}/${XP.question.Medium}/${XP.question.Hard}/${XP.question.Challenging}`);
  });
});

// ---------- Streaks, the sky, repair and welcome back ----------
const NOON = 12 * 3600000;
// Noon (app time) on the day `n` days from today, as epoch ms.
const noonIn = (n) => dayStartMs(dayOffset(todayKey(), n)) + NOON;
const ago = (n) => dayOffset(todayKey(), -n);

describe("day helpers", () => {
  test("dayDiff counts whole days across a month boundary", () => {
    assert.equal(dayDiff("2026-10-03", "2026-09-28"), 5);
    assert.equal(dayDiff("2026-09-28", "2026-10-03"), -5);
    assert.equal(dayDiff("2026-10-03", "2026-10-03"), 0);
  });

  test("dayStartMs is midnight in the app's timezone", () => {
    const start = dayStartMs("2026-10-03");
    assert.equal(todayKey(new Date(start)), "2026-10-03");
    assert.equal(todayKey(new Date(start - 1)), "2026-10-02");
    assert.equal(dayStartMs("2026-10-04") - start, 86400000);
  });
});

describe("day history", () => {
  test("a record from before the day history gets one from its XP log and its streak", () => {
    const legacy = { userId: "old", xp: 40, xpLog: { [ago(9)]: 20, [ago(1)]: 0 }, streak: { current: 3, longest: 3, lastDate: ago(1) }, combo: 0, bestCombo: 0, answered: {}, saved: [], vocab: {}, plan: {}, drills: [], badges: [], targetScore: 1400, dailyGoal: 50 };
    const p = getProgress({ progress: [legacy] }, "old");
    assert.deepEqual(Object.keys(p.days).sort(), [ago(9), ago(3), ago(2), ago(1)]);
    assert.equal(streakOf(p).current, 3);
    award(p, 5);
    assert.equal(p.streak.current, 4);
  });

  test("the streak counts while today or yesterday is active, and the best one is kept", () => {
    const p = studied(fresh(), 5, 4, 3, 2, 1);
    assert.deepEqual(streakOf(p), { current: 5, longest: 5, lastDate: ago(1), activeToday: false });
    const q = studied(fresh(), 5, 4, 3, 2);
    q.streak.longest = 4;
    assert.equal(streakOf(q).current, 0);
    assert.equal(streakOf(q).longest, 4);
  });

  test("a gift that isn't study doesn't light today's star", () => {
    const p = fresh();
    award(p, 30, [], { activity: false });
    assert.equal(p.xp, 30);
    assert.deepEqual(p.days, {});
    assert.equal(p.streak.current, 0);
  });
});

describe("the sky", () => {
  test("an empty sky before the first star", () => {
    assert.deepEqual(skyOf(fresh()), { start: null, marks: "", lit: 0, repaired: 0, missed: 0, perConstellation: 7, constellations: 0, toward: 0 });
  });

  test("every day from the first star to today has a mark, and missed days stay", () => {
    const p = studied(fresh(), 6, 5, 3, 1);
    p.days[ago(4)] = "repaired";
    const sky = skyOf(p);
    assert.equal(sky.start, ago(6));
    assert.equal(sky.marks, "11r101t");
    assert.deepEqual([sky.lit, sky.repaired, sky.missed], [5, 1, 1]);
    award(p, 1);
    assert.equal(skyOf(p).marks, "11r1011");
  });

  test("seven lit stars make a constellation, even with missed days between them", () => {
    const p = studied(fresh(), 20, 19, 18, 15, 14, 10, 9, 8, 2);
    const sky = skyOf(p);
    assert.equal(sky.lit, 9);
    assert.equal(sky.constellations, 1);
    assert.equal(sky.toward, 2);
    assert.equal(sky.missed, 11);
    assert.equal(sky.marks.length, 21);
  });

  test("the sky is never wiped: a long break only adds dim stars", () => {
    const p = studied(fresh(), 40, 39, 38);
    const before = skyOf(p).lit;
    award(p, 5);
    const sky = skyOf(p);
    assert.equal(sky.lit, before + 1);
    assert.equal(sky.marks, "111" + "0".repeat(37) + "1");
  });
});

describe("repair window", () => {
  test("exactly one missed day can be repaired: yesterday", () => {
    const p = studied(fresh(), 4, 3, 2);
    assert.equal(repairableDay(p), ago(1));
    const status = repairStatus(p);
    assert.equal(status.day, ago(1));
    assert.equal(status.streak, 3);
    assert.equal(status.total, REPAIR_SIZE);
    assert.equal(status.started, false);
    // It closes 48 hours after the missed day ended.
    assert.equal(Date.parse(status.closesAt), dayStartMs(dayOffset(todayKey(), 2)));
  });

  test("the day before yesterday, while yesterday was active", () => {
    const p = studied(fresh(), 4, 3, 1);
    assert.equal(repairableDay(p), ago(2));
    assert.equal(Date.parse(repairStatus(p).closesAt), dayStartMs(dayOffset(todayKey(), 1)));
  });

  test("not when two days were missed, or when the window has passed", () => {
    assert.equal(repairableDay(studied(fresh(), 5, 4, 3)), null, "two missed days");
    assert.equal(repairableDay(studied(fresh(), 5, 4, 2, 1)), null, "the missed day ended more than 48 hours ago");
    assert.equal(repairableDay(studied(fresh(), 3, 2, 1)), null, "nothing was missed");
    assert.equal(repairableDay(fresh()), null, "no history");
    assert.equal(repairableDay(studied(fresh(), 3)), null);
  });

  test("there has to be a streak to rejoin: the day before the missed one was active", () => {
    assert.equal(repairableDay(studied(fresh(), 1)), null);
    assert.equal(repairableDay(studied(fresh(), 2)), ago(1));
  });

  test("the same day stops being repairable once the 48 hours are over", () => {
    const p = studied(fresh(), 4, 3, 2);
    assert.equal(repairableDay(p, noonIn(1)), null, "tomorrow, with today missed too");
    p.days[todayKey()] = "active";
    assert.equal(repairableDay(p, noonIn(1)), ago(1), "tomorrow, with today active");
    p.days[dayOffset(todayKey(), 1)] = "active";
    assert.equal(repairableDay(p, noonIn(2)), null, "the day after: more than 48 hours");
  });
});

describe("repair drill", () => {
  const ids = Array.from({ length: REPAIR_SIZE }, (_, i) => `r${i}`);
  // Answers a drill question the way the practice route does.
  function answer(p, id, ok = true) {
    logAnswer(p, { q: id, at: new Date().toISOString(), ok });
    award(p, 1);
    return p.repair?.ids.includes(id) ? settleRepair(p) : null;
  }

  test("starting it picks the questions once and resumes the same drill", () => {
    const p = studied(fresh(), 4, 3, 2);
    let picks = 0;
    const pick = (n) => {
      picks += 1;
      return ids.slice(0, n);
    };
    const first = startRepair(p, pick);
    assert.deepEqual(first.ids, ids);
    assert.equal(first.day, ago(1));
    assert.equal(startRepair(p, pick), first);
    assert.equal(picks, 1);
    assert.equal(repairStatus(p).started, true);
  });

  test("it can't be started when no day qualifies, or when the bank is empty", () => {
    assert.equal(startRepair(studied(fresh(), 6, 5), () => ids), null);
    assert.equal(startRepair(studied(fresh(), 4, 3, 2), () => []), null);
  });

  test("finishing every question, with any score, relights the day and rejoins the streak", () => {
    const p = studied(fresh(), 4, 3, 2);
    startRepair(p, () => ids);
    for (const id of ids.slice(0, 9)) assert.equal(answer(p, id, false).state, "open");
    assert.equal(repairStatus(p).answered, 9);
    assert.equal(p.days[ago(1)], undefined, "nine answers don't repair it");
    const done = answer(p, ids[9], false);
    assert.equal(done.state, "repaired");
    assert.equal(done.streak, 5);
    assert.equal(p.days[ago(1)], "repaired");
    assert.equal(p.repair, null);
    assert.equal(p.streak.current, 5);
    assert.equal(skyOf(p).marks, "111r1");
    assert.equal(repairStatus(p), null);
    assert.deepEqual(settleRepair(p), { state: "none" });
  });

  test("answers given before the drill started don't count", () => {
    const p = studied(fresh(), 4, 3, 2);
    for (const id of ids) logAnswer(p, { q: id, at: new Date(Date.now() - 3600000).toISOString(), ok: true });
    startRepair(p, () => ids);
    const state = settleRepair(p);
    assert.equal(state.state, "open");
    assert.equal(state.remaining, REPAIR_SIZE);
  });

  test("a question removed from the bank drops out instead of blocking the drill", () => {
    const p = studied(fresh(), 4, 3, 2);
    startRepair(p, () => ids);
    for (const id of ids.slice(0, 9)) logAnswer(p, { q: id, at: new Date().toISOString(), ok: true });
    award(p, 1);
    assert.equal(settleRepair(p).state, "open");
    assert.equal(settleRepair(p, (id) => id !== "r9").state, "repaired");
  });

  test("the drill closes when the window does, and nothing is repaired", () => {
    const p = studied(fresh(), 4, 3, 2);
    startRepair(p, () => ids);
    for (const id of ids) logAnswer(p, { q: id, at: new Date().toISOString(), ok: true });
    p.days[todayKey()] = "active";
    p.days[dayOffset(todayKey(), 1)] = "active";
    const late = settleRepair(p, () => true, dayStartMs(dayOffset(todayKey(), 2)) + 3600000);
    assert.equal(late.state, "closed");
    assert.equal(p.days[ago(1)], undefined);
    assert.equal(p.repair, null);
  });

  test("a drill started inside the window can be finished a few minutes after it closes", () => {
    const p = studied(fresh(), 4, 3, 2);
    startRepair(p, () => ids);
    for (const id of ids) logAnswer(p, { q: id, at: new Date().toISOString(), ok: true });
    p.days[todayKey()] = "active";
    p.days[dayOffset(todayKey(), 1)] = "active";
    assert.equal(settleRepair(p, () => true, dayStartMs(dayOffset(todayKey(), 2)) + 10 * 60000).state, "repaired");
  });

  test("a second missed day while the drill is open closes it", () => {
    const p = studied(fresh(), 4, 3, 2);
    startRepair(p, () => ids);
    for (const id of ids) logAnswer(p, { q: id, at: new Date().toISOString(), ok: true });
    // Tomorrow, with nothing studied today: two days are missing now.
    assert.equal(settleRepair(p, () => true, noonIn(1)).state, "closed");
  });

  test("a streak rejoined by a repair can earn the streak badges", () => {
    const p = studied(fresh(), 7, 6, 5, 4, 3, 2);
    startRepair(p, () => ids);
    ids.forEach((id) => answer(p, id));
    assert.equal(p.streak.current, 8);
    assert.ok(award(p, 0).newBadges.some((b) => b.id === "streak_7"));
  });
});

describe("welcome back", () => {
  test("three or more days away, with earlier activity, earns the gift once", () => {
    const p = studied(fresh(), 9, 8, 3);
    const status = welcomeBackStatus(p);
    assert.deepEqual([status.eligible, status.daysAway, status.pending], [true, 3, null]);
    const gift = claimWelcomeBack(p);
    assert.equal(gift.xp, XP.welcomeBack);
    assert.equal(gift.daysAway, 3);
    assert.equal(gift.newBadge, true);
    assert.equal(p.xp, XP.welcomeBack);
    assert.ok(p.badges.some((b) => b.id === "returning_star"));
    assert.ok(BADGES.returning_star);
    assert.equal(p.days[todayKey()], undefined, "the gift needs no study and doesn't light a star");
    // Given, and waiting to be shown.
    assert.deepEqual(welcomeBackStatus(p).pending, { daysAway: 3, xp: XP.welcomeBack, newBadge: true });
    assert.equal(welcomeBackStatus(p).eligible, false);
    assert.equal(claimWelcomeBack(p), null);
    assert.equal(p.xp, XP.welcomeBack);
    ackWelcomeBack(p);
    assert.equal(welcomeBackStatus(p).pending, null);
  });

  test("not for a short gap, a new account, or a day that can still be repaired", () => {
    assert.equal(welcomeBackStatus(studied(fresh(), 5, 2)).eligible, false, "two days away");
    assert.equal(welcomeBackStatus(studied(fresh(), 1)).eligible, false);
    assert.equal(welcomeBackStatus(fresh()).eligible, false, "never active, so never away");
    assert.equal(claimWelcomeBack(fresh()), null);
    const repairable = studied(fresh(), 4, 3, 2);
    assert.ok(repairableDay(repairable));
    assert.equal(welcomeBackStatus(repairable).eligible, false);
    // The two never overlap: three days away means at least two missed days.
    assert.equal(repairableDay(studied(fresh(), 5, 4, 3)), null);
  });

  test("at most once every 14 days", () => {
    const p = studied(fresh(), 10, 9);
    assert.ok(claimWelcomeBack(p));
    assert.equal(welcomeBackStatus(p, noonIn(5)).eligible, false);
    assert.equal(welcomeBackStatus(p, noonIn(13)).eligible, false);
    const later = welcomeBackStatus(p, noonIn(15));
    assert.equal(later.eligible, true);
    assert.equal(later.daysAway, 24);
  });

  test("a second gift gives the XP again but the badge only once", () => {
    const p = studied(fresh(), 30, 29);
    claimWelcomeBack(p);
    p.welcome.at = new Date(Date.now() - 20 * 86400000).toISOString();
    const again = claimWelcomeBack(p);
    assert.equal(again.newBadge, false);
    assert.equal(p.xp, 2 * XP.welcomeBack);
    assert.equal(p.badges.filter((b) => b.id === "returning_star").length, 1);
  });

  test("studying first doesn't forfeit it: the return is remembered", () => {
    const p = studied(fresh(), 12, 11, 6);
    award(p, 10); // a question answered straight from a link, before the hub was opened
    assert.equal(p.days[todayKey()], "active");
    assert.deepEqual(p.returned, { day: todayKey(), daysAway: 6 });
    const status = welcomeBackStatus(p);
    assert.deepEqual([status.eligible, status.daysAway], [true, 6]);
    assert.ok(claimWelcomeBack(p));
    assert.equal(p.returned, null);
    assert.equal(welcomeBackStatus(p).eligible, false);
  });

  test("an ordinary next-day return isn't a break", () => {
    const p = studied(fresh(), 2, 1);
    award(p, 10);
    assert.equal(p.returned, null);
    assert.equal(welcomeBackStatus(p).eligible, false);
  });
});
