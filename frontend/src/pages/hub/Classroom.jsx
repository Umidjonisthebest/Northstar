import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cheerClassmate, getClass, setClassMembership, studentMe } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Avatar from "../../components/avatar/Avatar.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import ClassCodeField, { codeProblem } from "../../components/ClassCodeField.jsx";
import { Loading } from "./Home.jsx";
import { fmtDay, pct, playerUrl } from "./hubUtils.js";
import { ago, classUrl, dueLine, duration, nameList, plural } from "./classroom/classUtils.js";
import Classmates from "./classroom/Classmates.jsx";
import ClassHomework from "./classroom/ClassHomework.jsx";
import ClassChat from "./classroom/ClassChat.jsx";
import "../../classroom.css";

// My Class (/class). A class is made and named by a teacher; its students see each other's study
// sessions, work toward a class goal, get homework and announcements from their teachers, and
// chat. A student who isn't in a class gets in with the class code their teacher gives them: that
// is the only way in (sign-up doesn't ask), and the class's discussion is open to them from that
// moment. Everything shown comes from the server (backend/classrooms.js, classStats.js,
// homework.js, classChat.js).

const TABS = [
  ["overview", "Overview", "home"],
  ["classmates", "Classmates", "users"],
  ["homework", "Homework", "checklist"],
  ["chat", "Chat", "chat"]
];

// For a student who isn't in a class: the class code that puts them in one, and what joining brings.
function JoinClass({ info, onJoined }) {
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body, done) {
    setBusy(true);
    setError("");
    try {
      const r = await setClassMembership(token, body);
      toast.success(done(r));
      await onJoined(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e) {
    e.preventDefault();
    const missing = codeProblem(code, info.codeLength);
    if (missing) return setError(missing);
    send({ code }, (r) => `Welcome to ${r.classroom.name}`);
  }
  // "I don't have a class": the answer is kept, and My Class leaves the menu.
  const decline = () => send({ leave: true }, () => "Saved. If you get a class code later, enter it in Settings.");

  if (info.demo) {
    return (
      <div className="cr-join">
        <span className="cr-join-icon">
          <Icon name="users" size={30} />
        </span>
        <h1>Classes are for real accounts</h1>
        <p>You're looking around with the demo account, which everyone shares, so it can't be in a class. Create your own free account to join yours.</p>
        <Link to="/signup" className="ns-btn ns-btn-primary">
          Create a free account
        </Link>
      </div>
    );
  }

  return (
    <form className="cr-join" onSubmit={submit}>
      <span className="cr-join-icon">
        <Icon name="users" size={30} />
      </span>
      <h1>Join your class</h1>
      <p>Your teacher makes the class and gives you its code. Once you're in, you see each other's study sessions, work toward a class goal, get homework from your teachers, and the class discussion opens: you can chat about hard questions straight away.</p>
      <div className="cr-join-form">
        <ClassCodeField
          value={code}
          length={info.codeLength}
          busy={busy}
          autoFocus
          onChange={(v) => {
            setCode(v);
            setError("");
          }}
        />
        {error && (
          <p className="cr-error" role="alert">
            <Icon name="error" size={17} /> {error}
          </p>
        )}
        <button className="ns-btn ns-btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Join my class"}
        </button>
      </div>
      <p className="cr-join-foot">
        No class? Nothing changes for you: the question bank, tests, Nova and the leagues all work the same.
        {!info.schoolAsked && (
          <>
            {" "}
            <button type="button" className="cr-join-no" disabled={busy} onClick={decline}>
              I don't have a class
            </button>
          </>
        )}
      </p>
    </form>
  );
}

// One number of the week, three ways: yours, the class average and the best in the class.
function CompareRow({ label, unit, me, average, best }) {
  const top = Math.max(1, me, average, best);
  const show = (v) => (unit === "min" ? duration(v) : v.toLocaleString("en-US"));
  return (
    <div className="cr-cmp">
      <span className="cr-cmp-label">{label}</span>
      <div className="cr-cmp-bars" role="img" aria-label={`${label}: you ${show(me)}, class average ${show(average)}, best in class ${show(best)}`}>
        {[
          ["you", "You", me],
          ["avg", "Class average", average],
          ["best", "Best in class", best]
        ].map(([key, name, v]) => (
          <div key={key} className={`cr-bar ${key}`}>
            <span>{name}</span>
            <i>
              <b style={{ width: `${Math.round((v / top) * 100)}%` }} />
            </i>
            <em>{show(v)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function Quest({ quest, name }) {
  const left = Math.max(0, quest.target - quest.total);
  return (
    <section className="ns-card2 cr-quest" aria-labelledby="cr-quest-h">
      <div className="cr-quest-top">
        <span className={`cr-quest-star ${quest.reached ? "lit" : ""}`}>
          <Icon name="northStar" size={34} />
        </span>
        <div>
          <h2 id="cr-quest-h">This week's class goal</h2>
          <p>
            {quest.reached
              ? `${name} reached its goal this week. That's a new star on the class shelf.`
              : `Everyone's XP counts. ${left.toLocaleString("en-US")} XP to go, ${quest.week.daysLeft === 1 ? "and the week ends tonight" : `${quest.week.daysLeft} days left`}.`}
          </p>
        </div>
        <div className="cr-quest-num">
          <b>{quest.total.toLocaleString("en-US")}</b>
          <span>of {quest.target.toLocaleString("en-US")} XP</span>
        </div>
      </div>
      <div className="ns-progress" role="progressbar" aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={Math.min(quest.total, quest.target)} aria-label="Class goal">
        <div className={quest.reached ? "good" : ""} style={{ width: `${Math.min(100, quest.percent)}%` }} />
      </div>
      <div className="cr-quest-foot">
        <span>
          <Icon name="bolt" size={16} /> You've added <b>{quest.mine.toLocaleString("en-US")} XP</b>.{quest.contributors > 0 && ` ${plural(quest.contributors, "student has", "students have")} chipped in.`}
        </span>
        {quest.top.length > 0 && (
          <span className="cr-quest-top3">
            {quest.top.slice(0, 3).map((t) => (
              <span key={t.id} title={`${t.you ? "You" : t.name}: ${t.xp} XP`}>
                <Avatar avatar={t.avatar} name={t.name} size={26} />
                {t.you ? "You" : t.name.split(" ")[0]} <em>{t.xp}</em>
              </span>
            ))}
          </span>
        )}
      </div>
      {quest.history.length > 0 && (
        <div className="cr-shelf">
          <span>
            Class shelf: {plural(quest.stars, "star")}
          </span>
          <ol aria-label="Past weeks, newest first">
            {quest.history.map((w) => (
              <li key={w.week} className={w.reached ? "lit" : ""} title={`Week of ${fmtDay(w.week, { month: "short", day: "numeric" })}: ${w.total.toLocaleString("en-US")} of ${w.target.toLocaleString("en-US")} XP${w.reached ? ", goal reached" : ""}`}>
                <Icon name="star" size={18} />
                <span className="cr-sr">
                  Week of {fmtDay(w.week, { month: "short", day: "numeric" })}: {w.reached ? "goal reached" : "goal not reached"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Overview({ data, onCheer, cheering }) {
  const { compare, quest, cup, feed, cheers, homework } = data;
  const name = data.classroom.name;
  const next = homework.next;
  return (
    <>
      {next && (
        <Link to={classUrl("homework")} className={`cr-next ${homework.overdue ? "late" : ""}`}>
          <Icon name="checklist" size={24} />
          <div>
            <b>
              {plural(homework.open, "homework")} to do{homework.overdue ? ` (${homework.overdue} past the due date)` : ""}
            </b>
            <span>
              {next.title} · {dueLine({ ...next, state: next.daysLeft < 0 ? "overdue" : "open" }).text} · {next.done} of {next.total} done
            </span>
          </div>
          <Icon name="chevronRight" size={18} />
        </Link>
      )}

      {cheers.today.length > 0 && (
        <p className="cr-cheered" role="status">
          <Icon name="party" size={20} /> {nameList(cheers.today)} cheered you today.
        </p>
      )}

      {quest && <Quest quest={quest} name={name} />}

      <div className="cr-two">
        <section aria-labelledby="cr-cmp-h">
          <div className="ns-section-head">
            <h2 id="cr-cmp-h">
              <Icon name="chart" size={22} /> Your week next to the class
            </h2>
            <Link to={classUrl("classmates")} className="ns-pill-btn">
              All classmates
            </Link>
          </div>
          <div className="ns-card2 cr-cmp-card">
            {compare.studied === 0 ? (
              <p className="cr-quiet">Nobody in {name} has studied yet this week. Be the first: any practice counts.</p>
            ) : (
              <>
                <CompareRow label="XP earned" me={compare.me.xp} average={compare.average.xp} best={compare.best.xp} />
                <CompareRow label="Time studied" unit="min" me={compare.me.minutes} average={compare.average.minutes} best={compare.best.minutes} />
                <CompareRow label="Questions answered" me={compare.me.questions} average={compare.average.questions} best={compare.best.questions} />
                <CompareRow label="Days studied" me={compare.me.days} average={compare.average.days} best={compare.best.days} />
                <p className="cr-cmp-note">
                  {compare.rank ? `You're ${compare.rank === 1 ? "first" : `number ${compare.rank}`} in the class by XP this week. ` : ""}
                  The average is over the {plural(compare.studied, "classmate")} who studied this week.
                  {compare.accuracy.me != null && (
                    <>
                      {" "}
                      Your accuracy: <b>{pct(compare.accuracy.me)}</b>
                      {compare.accuracy.class != null && (
                        <>
                          , class average <b>{pct(compare.accuracy.class)}</b>
                        </>
                      )}
                      . Nobody sees another student's accuracy.
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          {cup.length > 1 && (
            <>
              <div className="ns-section-head" style={{ marginTop: 32 }}>
                <h2>
                  <Icon name="podium" size={22} /> Classes this week
                </h2>
              </div>
              <ol className="ns-card2 cr-cup" aria-label="Each class's progress toward its own weekly goal">
                {cup.map((c) => (
                  <li key={c.id} className={c.you ? "you" : ""} aria-current={c.you ? "true" : undefined}>
                    <span className="cr-cup-rank">{c.rank}</span>
                    <span className="cr-cup-name">
                      {c.name}
                      {c.you && <small>your class</small>}
                    </span>
                    <i aria-hidden="true">
                      <b style={{ width: `${Math.min(100, c.percent)}%` }} />
                    </i>
                    <em>{c.percent}%</em>
                  </li>
                ))}
              </ol>
              <p className="cr-fine">Each class is measured against its own goal, sized to how many of its students are studying, so a small class and a large one have the same chance.</p>
            </>
          )}
        </section>

        <section aria-labelledby="cr-feed-h">
          <div className="ns-section-head">
            <h2 id="cr-feed-h">
              <Icon name="clock" size={22} /> Study sessions in your class
            </h2>
          </div>
          {feed.length === 0 ? (
            <div className="ns-empty2">
              <b>No study sessions this week yet</b>
              When you or a classmate practise, the session shows up here.
            </div>
          ) : (
            <ul className="cr-feed">
              {feed.slice(0, 14).map((s) => (
                <li key={`${s.who.id}-${s.start}`} className={s.you ? "you" : ""}>
                  <Avatar avatar={s.who.avatar} name={s.who.name} size={38} />
                  <div className="cr-feed-main">
                    <b>{s.you ? "You" : <Link to={classUrl("classmates", { with: s.who.id })}>{s.who.name}</Link>}</b>
                    <span>
                      {s.title} · {ago(s.end)}
                    </span>
                  </div>
                  <div className="cr-feed-num">
                    <b>{duration(s.minutes)}</b>
                    <span>{plural(s.count, "question")}</span>
                  </div>
                  {!s.you && (
                    <button type="button" className="cr-cheer" disabled={cheering === s.who.id} onClick={() => onCheer(s.who)} aria-label={`Cheer ${s.who.name}`} title={`Cheer ${s.who.name}`}>
                      <Icon name="party" size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function Classroom() {
  const { token, user, login } = useStudentAuth();
  const { refresh } = useProgress();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [cheering, setCheering] = useState(null);
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "overview";

  const load = useCallback(async () => {
    try {
      setData(await getClass(token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);
  // The overview's numbers move while classmates study: look again every minute while it is in front.
  useEffect(() => {
    if (tab !== "overview") return undefined;
    const timer = setInterval(() => !document.hidden && load(), 60000);
    return () => clearInterval(timer);
  }, [tab, load]);

  // Joining (or "I don't have a class") changes the account: the menu and the stored profile follow.
  const joined = async () => {
    try {
      login(token, await studentMe(token));
    } catch {
      /* the menu catches up with the next page */
    }
    await Promise.all([load(), refresh()]);
  };

  const cheer = async (who) => {
    setCheering(who.id);
    try {
      await cheerClassmate(token, who.id);
      toast.success(`You cheered ${who.name.split(" ")[0]}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCheering(null);
    }
  };

  if (!data) return failed ? <LoadFailed title="Couldn't load your class" onRetry={load} /> : <Loading />;
  if (!data.member) return <JoinClass info={data} onJoined={joined} />;

  const badges = { homework: data.homework.open, chat: data.chat.unread };
  const studying = data.studyingNow;

  return (
    <div className={`ns-page cr-page ${tab === "chat" ? "cr-chat-open" : ""}`}>
      <div className="cr-head">
        <span className="cr-head-badge" aria-hidden="true">
          {data.classroom.mark}
        </span>
        <div className="cr-head-main">
          <h1 className="ns-h1">{data.classroom.name}</h1>
          <p>
            {plural(data.students, "student")}
            {studying.length > 0 && (
              <span className="cr-live">
                <i /> {studying.length === 1 ? `${studying[0].name} is studying now` : `${nameList(studying)} are studying now`}
              </span>
            )}
          </p>
        </div>
        {user?.firstName && tab === "overview" && (
          <Link to={playerUrl({ source: "drill", size: 10, from: "/class" })} className="ns-btn ns-btn-primary cr-head-go">
            <Icon name="play2" size={16} /> Study for the class
          </Link>
        )}
      </div>

      <div className="ns-tabs2 cr-tabs" role="tablist" aria-label="My class">
        {TABS.map(([key, label, icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setParams(key === "overview" ? {} : { tab: key })}>
            <Icon name={icon} size={17} /> {label}
            {badges[key] > 0 && <span>{badges[key]}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} onCheer={cheer} cheering={cheering} />}
      {tab === "classmates" && <Classmates classroom={data.classroom} />}
      {tab === "homework" && <ClassHomework classroom={data.classroom} />}
      {tab === "chat" && <ClassChat classroom={data.classroom} onRead={() => Promise.all([load(), refresh()])} />}
    </div>
  );
}
