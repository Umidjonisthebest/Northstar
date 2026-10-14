import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { markPracticeTestRewardSeen, practiceTestResults } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import RichText, { RichInline } from "../../components/RichText.jsx";
import { Loading } from "./Home.jsx";
import { fmtDate } from "./hubUtils.js";
import { SECTION_TITLE, TESTS_URL, clockLabel, moduleShort, runUrl, sittingLabel } from "../practicetest/ptUtils.js";
import "../../player.css";
import "../../diagnostic.css";
import "../../practicetest.css";

// The results of one sitting of a practice test (/mock/practice/:runId): the estimated score, each
// section by domain, and every question that was sat with its answer, the student's answer and
// the explanation. What the sitting earned is shown here too, since the test screens show no rewards.

const LETTERS = "ABCDEF";
const FILTERS = [
  ["all", "All questions"],
  ["missed", "Incorrect and omitted"],
  ["marked", "Marked for review"]
];
const verdictOf = (it) => (it.correct ? "right" : it.answered ? "wrong" : "skip");
const VERDICT = { right: "Correct", wrong: "Incorrect", skip: "Omitted" };

function Verdict({ kind }) {
  return (
    <span className={`dg-verdict ${kind}`}>
      {kind === "right" && <Icon name="check" size={16} strokeWidth={2.8} />}
      {kind === "wrong" && <Icon name="cross" size={16} strokeWidth={2.8} />}
      {VERDICT[kind]}
    </span>
  );
}

// One question, opened: what was asked, the choices with the right one and the student's marked,
// and why.
function Answer({ it }) {
  const grid = it.type === "grid_in";
  return (
    <div className="pt-answer">
      {it.passage && <RichText className="pt-answer-passage" nodes={it.passage} />}
      <RichText className="pt-answer-prompt" nodes={it.prompt} />
      {grid ? (
        <div className="pt-typed">
          <p>
            <span>Your answer</span>
            <b className={it.correct ? "right" : it.answered ? "wrong" : ""}>{it.answered ? String(it.given).replace(/^-/, "−") : "No answer"}</b>
          </p>
          <p>
            <span>Correct answer</span>
            <b className="right">{it.shown.replace(/-/g, "−")}</b>
          </p>
        </div>
      ) : (
        <ol className="pt-choices">
          {it.options.map((opt, i) => {
            const right = i === it.correctIndex;
            const mine = it.given === i;
            return (
              <li key={i} className={`${right ? "right" : ""} ${mine && !right ? "wrong" : ""}`}>
                <span className="pt-choice-letter">{LETTERS[i]}</span>
                <RichInline nodes={opt} />
                {(right || mine) && <small>{right && mine ? "Your answer, correct" : right ? "Correct answer" : "Your answer"}</small>}
              </li>
            );
          })}
        </ol>
      )}
      {/* A question typed in the studio may have been given no explanation. */}
      {it.explanation?.length > 0 && (
        <div className="pt-explain">
          <b>
            <Icon name="steps" size={16} /> Explanation
          </b>
          <RichInline as="p" nodes={it.explanation} />
        </div>
      )}
    </div>
  );
}

function Reward({ reward }) {
  if (!reward || (!reward.xpGained && !reward.chunksGained && !reward.newBadges?.length)) return null;
  return (
    <p className="pt-reward">
      <span className="pt-reward-gem">
        <Icon name="bolt" size={20} />
      </span>
      <span>
        <b>This sitting earned you {reward.xpGained.toLocaleString("en-US")} XP</b>
        {reward.chunksGained > 0 ? ` and ${reward.chunksGained} comet chunk${reward.chunksGained === 1 ? "" : "s"}` : ""}
        {reward.newBadges?.length ? `, and the ${reward.newBadges.map((b) => b.name).join(" and ")} troph${reward.newBadges.length === 1 ? "y" : "ies"}` : ""}. A module pays for
        your best score on it, so sitting it again earns only for what improves.
      </span>
    </p>
  );
}

export default function PracticeTestResult() {
  const { runId } = useParams();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("all");
  const [open, setOpen] = useState(() => new Set());
  const celebrated = useRef(null);

  useEffect(() => {
    let alive = true;
    practiceTestResults(token, runId)
      .then((data) => alive && setD(data))
      .catch((e) => {
        if (!alive) return;
        if (e.code === "IN_PROGRESS") nav(runUrl(runId), { replace: true });
        else setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [token, runId, nav]);

  // The rewards wait for this page (nothing is celebrated on the test screens). Shown once.
  useEffect(() => {
    if (!d?.reward || d.rewardSeen || celebrated.current === d.id) return;
    celebrated.current = d.id;
    celebrate(d.reward);
    markPracticeTestRewardSeen(token, d.id).catch(() => {});
  }, [d, token, celebrate]);

  const items = useMemo(() => (d ? d.modules.flatMap((m) => m.items.map((it) => ({ ...it, module: m }))) : []), [d]);

  const back = (
    <Link to={TESTS_URL} className="ns-back">
      <Icon name="chevronLeft" size={18} /> Practice Tests
    </Link>
  );
  if (error) {
    return (
      <div className="ns-page dg-page">
        {back}
        <div className="ns-empty2">
          <b>Couldn't load these results</b>
          {error}
        </div>
      </div>
    );
  }
  if (!d || d.id !== runId) return <Loading />;
  // Cancelled because the student left a locked module: there is nothing to show but why.
  if (d.status === "cancelled") {
    return (
      <div className="ns-page dg-page">
        {back}
        <div className="ns-empty2" style={{ padding: 40 }}>
          <Nova size={80} mood="sleep" />
          <b style={{ marginTop: 10 }}>This attempt was cancelled</b>
          {d.title} ({sittingLabel(d)}), {fmtDate(d.finishedAt)}. A module is locked while you sit it, and you {d.cancelled?.reason || "left the test page"}{" "}
          while one was running, so the attempt ended there with no score. Start the test again whenever you're ready to stay on each module from start to
          finish.
        </div>
        <div className="pt-results-actions">
          <Link to={TESTS_URL} className="ns-btn ns-btn-primary">
            Back to the tests
          </Link>
        </div>
      </div>
    );
  }

  const r = d.result;
  const sat = d.modules.filter((m) => m.status === "completed");
  const left = d.modules.filter((m) => m.status !== "completed");
  const sections = ["rw", "math"].filter((k) => r.sections[k]);
  const only = sections.length === 1 ? r.sections[sections[0]] : null;
  // The headline: the total, or the one section's score, or (a section not finished) the raw count.
  const headline = r.total != null ? { value: r.total, of: "/ 1600" } : only?.score != null ? { value: only.score, of: "/ 800" } : { value: `${r.correct}`, of: `/ ${r.count} correct` };
  const share = r.count ? r.correct / r.count : 0;
  const mood = share >= 0.8 ? "cheer" : share >= 0.55 ? "happy" : "wink";
  const seconds = sat.reduce((s, m) => s + (m.seconds || 0), 0);
  const shown = items.filter((it) => (section === "all" || it.module.section === section) && (filter === "all" || (filter === "missed" ? !it.correct : it.flagged)));
  const counts = { all: items.length, missed: items.filter((it) => !it.correct).length, marked: items.filter((it) => it.flagged).length };
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = shown.length > 0 && shown.every((it) => open.has(it.id));

  return (
    <div className="ns-page dg-page pt-results">
      {back}

      <section className="dg-score-card">
        <div>
          <span className="dg-kicker">
            <Icon name="mock" size={16} /> {d.title} · {fmtDate(d.finishedAt)}
          </span>
          <div className="dg-total">
            <b>{headline.value}</b>
            <span>{headline.of}</span>
          </div>
          <span className="dg-level">
            {sittingLabel(d)}
            {d.status === "ended" ? " · ended early" : ""}
          </span>
          <div className="dg-split">
            {sections.map((k) => (
              <div key={k}>
                <small>{SECTION_TITLE[k]}</small>
                <b>{r.sections[k].score ?? `${r.sections[k].raw}/${r.sections[k].total}`}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="dg-side">
          <Nova size={96} mood={mood} float />
          <p>
            <b>
              {r.correct} of {r.count}
            </b>{" "}
            correct
            <br />
            {clockLabel(seconds)} {d.timed ? "used" : "spent on questions"}
          </p>
        </div>
        <p className="dg-fineprint">
          {r.total != null || only?.score != null
            ? "The scaled score comes from the test's own table for your raw score. The real test adapts its second module to you and weighs harder questions more, so expect a real section score within about 40 points of this estimate. It isn't an official College Board score."
            : "A section's scaled score needs both of its modules, so this attempt has a raw score only."}
          {d.timed ? "" : " This was an untimed sitting, so it isn't added to your score trend."}
        </p>
      </section>

      <Reward reward={d.reward} />

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="chart" size={22} /> Section by section
          </h2>
        </div>
        <div className="dg-sections">
          {sections.map((k) => {
            const s = r.sections[k];
            return (
              <div key={k} className="dg-sec">
                <div className="dg-sec-head">
                  <h3>{SECTION_TITLE[k]}</h3>
                  <span className="dg-sec-score">
                    {s.score ?? s.raw}
                    <small> / {s.score != null ? 800 : s.total}</small>
                  </span>
                </div>
                <p>
                  {s.raw} of {s.total} correct
                  {s.modules < s.of ? ` · ${s.modules} of ${s.of} modules sat` : ""}
                </p>
                {s.domains.map((dm) => (
                  <div key={dm.domain} className="pt-domain">
                    <span>{dm.domain}</span>
                    <span className="pt-bar" aria-hidden="true">
                      <i style={{ width: `${Math.round((dm.correct / dm.total) * 100)}%` }} />
                    </span>
                    <b>
                      {dm.correct}/{dm.total}
                    </b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="pt-mods">
          {sat.map((m) => (
            <span key={m.key}>
              {moduleShort(d.modules, m)}:{" "}
              <b>
                {m.raw}/{m.questions}
              </b>{" "}
              · {clockLabel(m.seconds)}
              {m.auto ? " · time ran out" : ""}
            </span>
          ))}
          {left.map((m) => (
            <span key={m.key} className="out">
              {moduleShort(d.modules, m)}: not sat
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="checklist" size={22} /> Answer review
          </h2>
          {shown.length > 0 && (
            <button className="ns-pill-btn" onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((it) => it.id)))}>
              {allOpen ? "Close all" : "Open all"}
            </button>
          )}
        </div>
        <div className="pt-filters">
          <div className="pt-chips" role="group" aria-label="Which questions to show">
            {FILTERS.map(([key, label]) => (
              <button key={key} className={filter === key ? "on" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label} <span>{counts[key]}</span>
              </button>
            ))}
          </div>
          {sections.length > 1 && (
            <div className="pt-chips" role="group" aria-label="Which section to show">
              {[["all", "Both sections"], ...sections.map((k) => [k, SECTION_TITLE[k]])].map(([key, label]) => (
                <button key={key} className={section === key ? "on" : ""} aria-pressed={section === key} onClick={() => setSection(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="ns-empty2">
            <b>{filter === "missed" ? "Nothing missed here" : filter === "marked" ? "Nothing was marked for review" : "No questions"}</b>
            {filter === "missed" ? "Every question in this view was answered correctly." : "Choose another filter to see the questions."}
          </div>
        ) : (
          <div className="pt-review">
            {shown.map((it) => {
              const isOpen = open.has(it.id);
              const kind = verdictOf(it);
              return (
                <div key={it.id} className={`pt-item ${kind}${isOpen ? " open" : ""}`}>
                  <button className="pt-item-head" aria-expanded={isOpen} onClick={() => toggle(it.id)}>
                    <span className="pt-item-n">{it.n}</span>
                    <span className="pt-item-main">
                      {/* A test made in the studio isn't sorted into skills and domains. */}
                      <b>{it.skill || `Question ${it.n}`}</b>
                      <span>
                        {moduleShort(d.modules, it.module)}
                        {it.domain ? ` · ${it.domain}` : ""}
                      </span>
                    </span>
                    {it.flagged && <Icon name="bookmarkFilled" size={16} className="pt-item-flag" />}
                    <Verdict kind={kind} />
                    <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={18} />
                  </button>
                  {isOpen && <Answer it={it} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="pt-results-actions">
        <Link to={TESTS_URL} className="ns-btn ns-btn-primary">
          Back to the tests
        </Link>
      </div>
    </div>
  );
}
