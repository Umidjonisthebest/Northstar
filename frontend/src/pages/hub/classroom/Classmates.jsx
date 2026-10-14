import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cheerClassmate, getClassmate, getClassmates } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import { useToast } from "../../../components/Toast.jsx";
import Icon from "../../../components/Icon.jsx";
import Avatar from "../../../components/avatar/Avatar.jsx";
import LoadFailed from "../../../components/LoadFailed.jsx";
import { Loading } from "../Home.jsx";
import { fmtDay, fmtTime } from "../hubUtils.js";
import { classUrl, duration, plural } from "./classUtils.js";

// The Classmates tab of My Class: everyone in the grade with the week they are having, and, with
// ?with=<id>, you next to one of them. Classmates see each other's effort (time, questions, XP,
// streak), never each other's accuracy.

function CheerButton({ who, done, onDone, small = false }) {
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const first = who.name.split(" ")[0];
  const send = async () => {
    setBusy(true);
    try {
      await cheerClassmate(token, who.id);
      toast.success(`You cheered ${first}`);
      onDone?.();
    } catch (e) {
      toast.error(e.message);
      if (e.status === 409) onDone?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={`ns-btn ns-btn-soft ns-btn-sm cr-cheer-btn ${done ? "done" : ""}`} disabled={busy || done} onClick={send} aria-label={done ? `You cheered ${who.name} today` : `Cheer ${who.name}`}>
      <Icon name={done ? "check" : "party"} size={16} /> {small ? "" : done ? "Cheered" : "Cheer"}
    </button>
  );
}

// Two bars for one number: yours and theirs.
function Versus({ label, me, them, unit, theirName }) {
  const top = Math.max(1, me, them);
  const show = (v) => (unit === "min" ? duration(v) : v.toLocaleString("en-US"));
  return (
    <div className="cr-vs-row" role="img" aria-label={`${label}: you ${show(me)}, ${theirName} ${show(them)}`}>
      <em className="me">{show(me)}</em>
      <i className="me">
        <b style={{ width: `${Math.round((me / top) * 100)}%` }} />
      </i>
      <span>{label}</span>
      <i className="them">
        <b style={{ width: `${Math.round((them / top) * 100)}%` }} />
      </i>
      <em className="them">{show(them)}</em>
    </div>
  );
}

function Sessions({ title, sessions, own }) {
  return (
    <div className="cr-vs-sessions">
      <h3>{title}</h3>
      {sessions.length === 0 ? (
        <p className="cr-quiet">No sessions in the last two weeks.</p>
      ) : (
        <ul>
          {sessions.map((s) => (
            <li key={s.start}>
              <div>
                <b>{s.title}</b>
                <span>
                  {fmtDay(s.date)} · {fmtTime(s.start)}
                </span>
              </div>
              <div>
                <b>{duration(s.minutes)}</b>
                <span>{own ? `${s.correct}/${s.count} right` : plural(s.count, "question")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Compare({ id }) {
  const { token } = useStudentAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    getClassmate(token, id)
      .then(setData)
      .catch((e) => setError(e.status === 404 ? "gone" : e.message));
  }, [token, id]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const back = (
    <Link to={classUrl("classmates")} className="cr-back">
      <Icon name="chevronLeft" size={17} /> All classmates
    </Link>
  );
  if (error === "gone")
    return (
      <>
        {back}
        <div className="ns-empty2">
          <b>That student isn't in your class</b>
          They may have moved to another class.
        </div>
      </>
    );
  if (error) return <LoadFailed title="Couldn't load this classmate" onRetry={load} />;
  if (!data) return <Loading />;

  const { me, them } = data;
  const top = Math.max(1, ...me.days.map((d) => d.minutes), ...them.days.map((d) => d.minutes));
  const first = them.name.split(" ")[0];
  const who = (s, you) => (
    <div className={`cr-vs-who ${you ? "me" : ""}`}>
      <Avatar avatar={s.avatar} name={s.name} size={64} />
      <div>
        <b>{you ? "You" : s.name}</b>
        <span>
          Level {s.level} · {s.league} league
        </span>
        <span>
          <Icon name="northStar" size={14} /> {s.streak}-day streak{s.studying && !you ? " · studying now" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {back}
      <section className="ns-card2 cr-vs">
        <div className="cr-vs-head">
          {who(me, true)}
          <span className="cr-vs-mid">this week</span>
          {who(them, false)}
        </div>
        <Versus label="XP earned" me={me.week.xp} them={them.week.xp} theirName={them.name} />
        <Versus label="Time studied" unit="min" me={me.week.minutes} them={them.week.minutes} theirName={them.name} />
        <Versus label="Questions" me={me.week.questions} them={them.week.questions} theirName={them.name} />
        <Versus label="Days studied" me={me.week.days} them={them.week.days} theirName={them.name} />
        <div className="cr-vs-actions">
          <CheerButton who={them} done={them.cheered} onDone={load} />
          <Link to={classUrl("chat", { room: `dm-${them.id}` })} className="ns-btn ns-btn-outline ns-btn-sm">
            <Icon name="chat" size={16} /> Message {first}
          </Link>
        </div>
      </section>

      <section aria-labelledby="cr-days-h">
        <div className="ns-section-head">
          <h2 id="cr-days-h">
            <Icon name="calendar" size={22} /> Minutes studied, day by day
          </h2>
          <span className="cr-legend">
            <i className="me" /> You <i className="them" /> {first}
          </span>
        </div>
        <div className="ns-card2 cr-days">
          {me.days.map((d, i) => {
            const t = them.days[i];
            return (
              <div key={d.date} className="cr-day" role="img" aria-label={`${fmtDay(d.date)}: you ${d.minutes} minutes, ${them.name} ${t.minutes} minutes`}>
                <div className="cr-day-bars">
                  <i className="me" style={{ height: `${Math.max(d.minutes ? 6 : 0, Math.round((d.minutes / top) * 100))}%` }} title={`You: ${duration(d.minutes)}`} />
                  <i className="them" style={{ height: `${Math.max(t.minutes ? 6 : 0, Math.round((t.minutes / top) * 100))}%` }} title={`${them.name}: ${duration(t.minutes)}`} />
                </div>
                <span>{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cr-two even">
        <Sessions title="Your latest sessions" sessions={me.sessions} own />
        <Sessions title={`${first}'s latest sessions`} sessions={them.sessions} />
      </div>
      <p className="cr-fine">You see when a classmate studied, for how long and how many questions. How many they got right is theirs alone, and yours is yours.</p>
    </>
  );
}

const SORTS = [
  ["xp", "XP this week"],
  ["minutes", "Time studied"],
  ["questions", "Questions"],
  ["streak", "Streak"]
];

export default function Classmates({ classroom }) {
  const { token } = useStudentAuth();
  const [params] = useSearchParams();
  const withId = params.get("with");
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState("xp");

  const load = useCallback(() => {
    getClassmates(token)
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [token]);
  useEffect(() => {
    if (!withId) load();
  }, [load, withId]);

  if (withId) return <Compare id={withId} />;
  if (!data) return failed ? <LoadFailed title="Couldn't load your classmates" onRetry={load} /> : <Loading />;

  const value = (c) => (sort === "streak" ? c.streak : c.week[sort]);
  const rows = [...data.classmates].sort((a, b) => value(b) - value(a) || b.week.xp - a.week.xp || a.name.localeCompare(b.name));
  const others = rows.filter((c) => !c.you).length;

  return (
    <>
      <div className="ns-section-head">
        <h2>
          <Icon name="users" size={22} /> {plural(rows.length, "student")} in {classroom.name}
        </h2>
        <label className="cr-sort">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {others === 0 && (
        <div className="ns-empty2">
          <b>You're the first one here</b>
          Classmates appear as they join {classroom.name} with the class code.
        </div>
      )}

      <ul className="cr-mates">
        {rows.map((c, i) => (
          <li key={c.id} className={`ns-card2 ${c.you ? "you" : ""}`}>
            <span className="cr-mate-rank">{i + 1}</span>
            <span className="cr-mate-face">
              <Avatar avatar={c.avatar} name={c.name} size={46} />
              {c.studying && <i title="Studying now" />}
            </span>
            <div className="cr-mate-main">
              <b>
                {c.name}
                {c.you && <small>you</small>}
              </b>
              <span>
                Level {c.level} · {c.league}
                {c.streak > 0 && (
                  <>
                    {" · "}
                    <Icon name="northStar" size={13} /> {c.streak}
                  </>
                )}
                {c.studying && <em> · studying now</em>}
              </span>
            </div>
            <dl className="cr-mate-week">
              <div>
                <dt>XP</dt>
                <dd>{c.week.xp.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{duration(c.week.minutes)}</dd>
              </div>
              <div>
                <dt>Questions</dt>
                <dd>{c.week.questions}</dd>
              </div>
            </dl>
            {!c.you && (
              <div className="cr-mate-actions">
                <CheerButton who={c} done={c.cheered} onDone={load} small />
                <Link to={classUrl("chat", { room: `dm-${c.id}` })} className="ns-btn ns-btn-soft ns-btn-sm" aria-label={`Message ${c.name}`} title={`Message ${c.name}`}>
                  <Icon name="chat" size={16} />
                </Link>
                <Link to={classUrl("classmates", { with: c.id })} className="ns-btn ns-btn-outline ns-btn-sm">
                  Compare
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="cr-fine">The numbers are for this week (Monday to Sunday). Classmates are shown by first name and last initial.</p>
    </>
  );
}
