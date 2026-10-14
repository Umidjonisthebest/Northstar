import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getLeague } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import TierBadge from "../../components/Tier.jsx";
import Avatar from "../../components/avatar/Avatar.jsx";
import { Loading } from "./Home.jsx";
import { fmtDay, playerUrl } from "./hubUtils.js";
import "../../leagues.css";
import { EmptyArt } from "../../components/Art.jsx";

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

// How the last league week ended, in plain words.
function LastWeek({ last }) {
  const where =
    last.move === "up" ? `and moved up to ${last.toName}.` : last.move === "down" ? `This week you're in ${last.toName}.` : `You're staying in ${last.toName}.`;
  return (
    <div className="ns-league-last">
      <TierBadge tier={last.to} size={40} />
      <p>
        <b>Week of {fmtDay(last.week, { month: "short", day: "numeric" })}</b>
        You finished {ordinal(last.rank)} of {last.size} with {last.xp} XP {where}
      </p>
    </div>
  );
}

// The movement column: an arrow and words, never colour alone.
function Movement({ zone }) {
  if (zone === "up")
    return (
      <span className="ns-league-move up">
        <Icon name="chevronUp" size={15} strokeWidth={2.6} /> Moving up
      </span>
    );
  if (zone === "down")
    return (
      <span className="ns-league-move down">
        <Icon name="chevronDown" size={15} strokeWidth={2.6} /> Moving down
      </span>
    );
  return <span className="ns-league-move">Staying</span>;
}

// Weekly leagues: the student's tier, their group's table for the week and
// last week's result. All of it comes from the server (leagues.js).
export default function Leagues() {
  const { token, user } = useStudentAuth();
  const { exam } = useOutletContext() || {};
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getLeague(token)
      .then((d) => {
        setError("");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const practise = () => nav(exam === "ielts" ? "/ielts-prep/practice" : playerUrl({ source: "drill", size: 10, from: "/leagues" }));
  const group = data?.group;
  const mixed = group ? new Set(group.rows.map((r) => r.tier)).size > 1 : false;
  const day = (key) => fmtDay(key, { month: "short", day: "numeric" });

  return (
    <div className="ns-page" style={{ gap: 24, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="podium" size={32} /> Leagues
        </h1>
        <p className="ns-lead">
          Each week you're in a group of about twenty students near your level, ranked by the XP you earn that week. On Monday the top of each group moves up a league and the bottom moves down one.
        </p>
      </div>

      {error ? (
        <div className="ns-empty2">
          <b>Couldn't load your league</b>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="ns-league-top">
            <div className="ns-league-tier">
              <TierBadge tier={data.tier.index} size={88} />
              <div>
                <small>Your league</small>
                <b>{data.tier.name}</b>
                <span>{data.xp} XP this week</span>
              </div>
            </div>
            <div className="ns-league-week">
              <b>
                {day(data.week.start)} – {day(data.week.end)}
              </b>
              <span>
                {data.week.daysLeft === 1 ? "The week ends tonight at midnight" : `${data.week.daysLeft} days left in this week`}. A new one starts every Monday at 00:00, Tashkent time.
              </span>
            </div>
          </div>

          <ol className="ns-league-ladder" aria-label="The five leagues, lowest to highest">
            {data.tiers.map((name, i) => (
              <li key={name} className={i === data.tier.index ? "here" : ""} aria-current={i === data.tier.index ? "true" : undefined}>
                <TierBadge tier={i} size={52} />
                <span>{name}</span>
                {i === data.tier.index && <small>You are here</small>}
              </li>
            ))}
          </ol>

          {data.last && <LastWeek last={data.last} />}

          {!group ? (
            <div className="ns-empty2" style={{ padding: 36 }}>
              <EmptyArt name="trophy" />
              <b>You join a league with your first XP</b>
              Leagues are made of students who are studying. Earn any XP this week and you're placed in a group near your level.
              <div style={{ marginTop: 14 }}>
                <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={practise}>
                  Start practising
                </button>
              </div>
            </div>
          ) : (
            <section>
              <div className="ns-table-wrap ns-league-table">
                <table>
                  <caption>
                    Your group this week: {group.size} student{group.size === 1 ? "" : "s"}.{" "}
                    {group.movers > 0
                      ? `The top ${group.movers} with XP move up a league on Monday, and the bottom ${group.movers} move down one.`
                      : "With so few students nobody changes league this week."}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Student</th>
                      <th scope="col">Level</th>
                      {mixed && <th scope="col">League</th>}
                      <th scope="col">XP this week</th>
                      <th scope="col">On Monday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r) => (
                      <tr key={r.rank} className={r.you ? "you" : ""} aria-current={r.you ? "true" : undefined}>
                        <td>{r.rank}</td>
                        <th scope="row">
                          <span className="ns-league-who">
                            <Avatar avatar={r.avatar} name={r.you ? `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "You" : r.name} size={30} />
                            {r.name}
                          </span>
                        </th>
                        <td>{r.level}</td>
                        {mixed && <td>{r.tier}</td>}
                        <td>{r.xp}</td>
                        <td>
                          <Movement zone={r.zone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.you && (data.you.zone === "up" || data.you.toStay || data.you.toPromote) && (
                <p className="ns-league-goal">
                  <Icon name="target" size={17} />
                  {data.you.zone === "up"
                    ? "You're in the promotion zone. Hold your place through Sunday to move up."
                    : data.you.toStay
                      ? `${data.you.toStay} more XP this week lifts you out of the lower zone.`
                      : `${data.you.toPromote} more XP this week puts you in the promotion zone.`}
                </p>
              )}
              <p className="ns-muted2" style={{ fontSize: 14, margin: "12px 2px 0" }}>
                {group.size === 1 ? "You're the first one here this week. Others appear as they earn XP. " : ""}
                Students with the same XP are ranked by who reached it first. Other students are shown by first name and initial.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
