import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGapMap, updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_KEY, SECTION_SHORT, accClass, pct, playerUrl } from "./hubUtils.js";
import "../../planning.css";
import { EmptyArt } from "../../components/Art.jsx";

const practiceUrl = (section, skill) => playerUrl({ source: "drill", sec: SECTION_KEY[section], skills: [skill], size: 10, from: "/gap" });
const questions = (n) => `${n} question${n === 1 ? "" : "s"}`;

function AccBar({ value }) {
  return (
    <div className="ns-skillbar-track" aria-hidden="true">
      <div className={accClass(value)} style={{ width: `${value == null ? 0 : Math.round(value * 100)}%` }} />
    </div>
  );
}

// The point-gap map: for each skill, the student's accuracy and how many more
// raw questions they would get right on test day at their target accuracy.
// Raw question counts only: no scaled scores appear anywhere on this page.
export default function PointGap() {
  const { token } = useStudentAuth();
  const { refresh } = useProgress();
  const { toast } = useToast();
  const [map, setMap] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getGapMap(token)
      .then((d) => {
        setError("");
        setMap(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const setTarget = async (target) => {
    try {
      await updateSettings(token, { targetAccuracy: target });
      load();
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="ns-page" style={{ gap: 26, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="target" size={32} /> Point-Gap Map
        </h1>
        <p className="ns-lead">
          For every skill: your accuracy, about how many questions it carries on test day, and how many more of them you'd get right at your target accuracy. Everything is counted in raw questions, not scaled scores.
        </p>
      </div>

      {error ? (
        <div className="ns-empty2">
          <b>Couldn't load your map</b>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : !map ? (
        <Loading />
      ) : (
        <>
          <div className="ns-gap-target">
            <span id="ns-gap-target-label">Target accuracy</span>
            <div className="ns-gap-seg" role="radiogroup" aria-labelledby="ns-gap-target-label">
              {map.targets.map((t) => (
                <button key={t} role="radio" aria-checked={t === map.target} className={t === map.target ? "on" : ""} onClick={() => setTarget(t)}>
                  {Math.round(t * 100)}%
                </button>
              ))}
            </div>
            <span className="ns-muted2">
              {map.measured
                ? `At ${Math.round(map.target * 100)}% on the ${map.measured} skill${map.measured === 1 ? "" : "s"} measured so far: about ${questions(map.gain)} more.`
                : "No skill has enough answers yet."}
            </span>
          </div>

          <section aria-labelledby="ns-gap-top">
            <div className="ns-section-head">
              <h2 id="ns-gap-top">
                <Icon name="northStar" size={22} /> Worth the most points for you
              </h2>
            </div>
            {map.top.length === 0 ? (
              <div className="ns-empty2">
                <EmptyArt name="bullseye" />
                <b>{map.measured ? "You're at your target on every skill measured so far" : "Not enough answers yet"}</b>
                {map.measured
                  ? "Raise the target above, or practise the skills that still say “needs answers” below."
                  : `A skill shows up here once you've answered ${map.minAnswers} questions on it. The diagnostic test covers every part of the SAT in 20 minutes.`}
                {!map.measured && (
                  <div style={{ marginTop: 12 }}>
                    <Link to="/diagnostic" className="ns-btn ns-btn-primary ns-btn-sm">
                      <Icon name="compass" size={15} /> Take the diagnostic
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <ol className="ns-gap-top">
                {map.top.map((t, i) => (
                  <li key={t.skill}>
                    <span className="ns-gap-rank">{i + 1}</span>
                    <div>
                      <b>{t.skill}</b>
                      <span>
                        {SECTION_SHORT[t.section]} · {t.domain}
                      </span>
                      <p>
                        <strong>About +{questions(t.gain)}</strong> on test day. You're at {pct(t.accuracy)} over {t.attempts} answers, and this skill carries about {questions(t.questions)}.
                      </p>
                    </div>
                    <Link to={practiceUrl(t.section, t.skill)} className="ns-btn ns-btn-primary ns-btn-sm">
                      Practise it <Icon name="chevronRight" size={15} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {map.sections.map((sec) => (
            <section key={sec.section} aria-label={sec.section}>
              <div className="ns-section-head">
                <h2>{sec.section}</h2>
                <span className="ns-muted2" style={{ fontSize: 14.5 }}>
                  {sec.questions} questions on the test
                </span>
              </div>
              <div className="ns-gap-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Skill</th>
                      <th scope="col">Your accuracy</th>
                      <th scope="col">On the test</th>
                      <th scope="col">Gain at target</th>
                      <th scope="col">
                        <span className="ns-sr">Practice</span>
                      </th>
                    </tr>
                  </thead>
                  {sec.domains.map((d) => (
                    <tbody key={d.domain}>
                      <tr className="ns-gap-domain">
                        <th scope="rowgroup">{d.domain}</th>
                        <td>{d.attempts ? pct(d.accuracy) : "—"}</td>
                        <td>about {d.questions}</td>
                        <td>{d.gain == null ? "—" : `+${d.gain}`}</td>
                        <td />
                      </tr>
                      {d.skills.map((k) => (
                        <tr key={k.skill}>
                          <th scope="row">{k.skill}</th>
                          <td>
                            <div className="ns-gap-acc">
                              <AccBar value={k.accuracy} />
                              <span>{k.attempts ? `${pct(k.accuracy)} of ${k.attempts}` : "Not tried"}</span>
                            </div>
                          </td>
                          <td>about {k.questions}</td>
                          <td>{k.enough ? <b className={k.gain > 0 ? "ns-gap-gain" : ""}>{k.gain > 0 ? `+${k.gain}` : "At target"}</b> : <span className="ns-muted2">Needs {map.minAnswers - k.attempts} more answer{map.minAnswers - k.attempts === 1 ? "" : "s"}</span>}</td>
                          <td>
                            <Link to={practiceUrl(sec.section, k.skill)} className="ns-pill-btn sm" aria-label={`Practise ${k.skill}`}>
                              Practise
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </section>
          ))}

          <p className="ns-muted2" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            How this is counted: the digital SAT has 54 Reading and Writing questions and 44 Math questions, and the number per domain follows the College Board's published weights. Within a domain the questions are shared evenly between its skills, so the per-skill
            numbers are estimates. A gain is that number times the distance from your accuracy to your target. It is a way to choose what to practise, not a score prediction.
          </p>
        </>
      )}
    </div>
  );
}
