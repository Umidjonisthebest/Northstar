import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTraps } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_KEY, SECTION_SHORT, pct, playerUrl } from "./hubUtils.js";
import "../../review.css";

const FROM = "/mistakes?tab=traps";
const MOOD = { empty: "happy", early: "thinking" };

// The trap profile: what trips this student up, from the reasons they gave for their misses and
// from the answers themselves (GET /api/practice/traps). It is a tab of Saved & Mistakes.
export default function TrapProfile() {
  const { token } = useStudentAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTraps(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <LoadFailed title="Couldn't load your trap profile" message={error} />;
  if (!data) return <Loading />;

  const { headline, reasons, tagged, untagged, signals, skills } = data;
  const most = Math.max(1, ...reasons.map((r) => r.count));
  const top = tagged ? reasons[0] : null;
  const reasonName = (id) => reasons.find((r) => r.id === id)?.short;

  return (
    <>
      <section className="rv-head">
        <span className="rv-head-art">
          <Nova size={72} mood={MOOD[headline.kind] || "explain"} sparkles={false} />
        </span>
        <div>
          <h2>{headline.title}</h2>
          <p>{headline.body}</p>
        </div>
      </section>

      {signals.misses > 0 || tagged > 0 ? (
        <>
          <div className="rv-grid">
            <section className="ns-card2 rv-card">
              <h3>Why you miss</h3>
              <p>The reasons you gave, from the last {data.days} days. Tag a miss in the practice player, under the question, with one tap.</p>
              {tagged > 0 ? (
                <>
                  <div className="rv-bars">
                    {reasons.map((r) => (
                      <div key={r.id} className={`rv-bar ${r === top ? "top" : ""}`}>
                        <span title={r.label}>{r.short}</span>
                        <div className="rv-track" aria-hidden="true">
                          <div style={{ width: `${(r.count / most) * 100}%` }} />
                        </div>
                        <b>{r.count}</b>
                      </div>
                    ))}
                  </div>
                  {top && (
                    <p className="rv-tip">
                      <b>{top.label}.</b> {top.tip}
                    </p>
                  )}
                </>
              ) : (
                <p className="rv-tip">You haven't tagged a miss yet. The next time you get a question wrong, pick what went wrong under it. Three or four tags are enough to show a pattern.</p>
              )}
              {untagged > 0 && (
                <div className="rv-untagged">
                  <span>
                    {untagged} missed question{untagged === 1 ? " has" : "s have"} no reason yet.
                  </span>
                  <Link to={playerUrl({ source: "saved", order: "recent", from: FROM })} className="ns-pill-btn sm">
                    Go through my mistakes
                  </Link>
                </div>
              )}
            </section>

            <section className="ns-card2 rv-card">
              <h3>What your answers show</h3>
              <p>
                From your {signals.answers} graded answer{signals.answers === 1 ? "" : "s"} in the last {data.days} days, {signals.misses} of them misses. Nothing here needs tagging.
              </p>
              <ul className="rv-facts">
                <li className="rv-fact">
                  <b>{signals.rushed}</b>
                  <span>rushed misses</span>
                  <small>{signals.timed ? `of ${signals.timed} timed, well under the test's pace` : "no timed misses yet"}</small>
                </li>
                <li className="rv-fact">
                  <b>{signals.easy}</b>
                  <span>misses on Easy questions</span>
                  <small>usually slips, not gaps</small>
                </li>
                <li className="rv-fact">
                  <b>{signals.repeat}</b>
                  <span>missed more than once</span>
                  <small>the same question, again</small>
                </li>
              </ul>
              {signals.byDifficulty.length > 0 && (
                <>
                  <p className="rv-sub">How often you miss, by level</p>
                  {signals.byDifficulty.map((row) => (
                    <div key={row.name} className="rv-level">
                      <span className={`ns-tag2 ${row.name.toLowerCase()}`}>{row.name}</span>
                      <div className="rv-track" aria-hidden="true">
                        <div style={{ width: `${Math.round(row.rate * 100)}%` }} />
                      </div>
                      <b>
                        {pct(row.rate)} <small className="ns-muted2">({row.misses}/{row.answers})</small>
                      </b>
                    </div>
                  ))}
                </>
              )}
            </section>
          </div>

          {skills.length > 0 && (
            <section className="ns-card2 rv-card">
              <h3>Where the traps are</h3>
              <p>The skills you miss most, with the traps question writers set in each. Read them before you practise the skill.</p>
              <div className="rv-skills">
                {skills.map((s) => (
                  <div key={s.skill} className="rv-skill">
                    <div>
                      <div className="rv-skill-name">
                        {s.skill}
                        <span className={`ns-tag2 ${s.section === "Math" ? "math" : "rw"}`}>{SECTION_SHORT[s.section]}</span>
                        {s.reason && reasonName(s.reason) && <span className="rv-reason">Mostly: {reasonName(s.reason).toLowerCase()}</span>}
                      </div>
                      <p className="rv-skill-nums">
                        {s.misses} miss{s.misses === 1 ? "" : "es"} in {s.answers} answer{s.answers === 1 ? "" : "s"} · {pct(s.accuracy)} right
                      </p>
                    </div>
                    <Link to={playerUrl({ source: "drill", sec: SECTION_KEY[s.section], skills: [s.skill], size: 10, from: FROM })} className="ns-btn ns-btn-outline ns-btn-sm">
                      Practise this skill
                    </Link>
                    {s.traps.length > 0 && (
                      <ul>
                        {s.traps.map((t) => (
                          <li key={t}>
                            <Icon name="warning" size={16} /> {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </>
  );
}
