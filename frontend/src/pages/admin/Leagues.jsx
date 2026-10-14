import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLeagues } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import TierBadge from "../../components/Tier.jsx";
import { Avatar, Empty, Kpi } from "../../components/adminUi.jsx";
import "../../leagues.css";
import { studioPath } from "../../studio/panels.js";

const day = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MOVE = { up: ["chevronUp", "Moving up"], down: ["chevronDown", "Moving down"] };
const RESULT = { up: "Moved up to", down: "Moved down to", stay: "Stayed in" };

function Movement({ zone }) {
  if (!MOVE[zone]) return <span className="ad-muted">Staying</span>;
  return (
    <span className={`ad-chip ${zone === "up" ? "ad-league-up" : ""}`}>
      <Icon name={MOVE[zone][0]} size={13} strokeWidth={2.6} /> {MOVE[zone][1]}
    </span>
  );
}

// The teacher's view of the weekly leagues: every group and its table this
// week, and how the last week closed. Read-only: the server forms the groups
// and moves students between tiers on its own (backend/leagues.js).
export default function Leagues() {
  const { token } = useAdminAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminLeagues(token)
      .then((d) => {
        setError("");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">Insights</span>
          <h1>Leagues</h1>
          <p>Students are grouped by the week with about twenty others near their level and ranked by the XP they earn. Every Monday at 00:00 (Tashkent) the top of each group moves up a league and the bottom moves down.</p>
        </div>
      </div>

      {error ? (
        <div className="ad-card">
          <Empty icon="warning">
            Couldn't load the leagues: {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </div>
          </Empty>
        </div>
      ) : !data ? (
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      ) : (
        <>
          <div className="ad-grid-4">
            <Kpi icon="users" tone="violet" label="Students in leagues" value={data.students} sub={data.waiting ? `${data.waiting} more join with their first XP` : "everyone with an account"} />
            <Kpi icon="podium" tone="amber" label="Groups this week" value={data.groups.length} sub="about 20 students each" />
            <Kpi icon="calendar" tone="green" label="This week" value={`${day(data.week.start)} – ${day(data.week.end)}`} sub={data.week.daysLeft === 1 ? "ends tonight" : `${data.week.daysLeft} days left`} />
            <Kpi icon="chart" tone="rose" label="XP earned this week" value={data.groups.reduce((s, g) => s + g.rows.reduce((t, r) => t + r.xp, 0), 0).toLocaleString()} sub="across all groups" />
          </div>

          <div className="ad-card">
            <div className="ad-card-head">
              <h3>
                <Icon name="layers" size={18} /> Tiers
              </h3>
              <span>lowest to highest</span>
            </div>
            <div className="ad-league-tiers">
              {data.tiers.map((t, i) => (
                <div key={t.name}>
                  <TierBadge tier={i} size={38} />
                  <b>{t.name}</b>
                  <span>
                    {t.students} student{t.students === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {data.groups.length === 0 ? (
            <div className="ad-card">
              <Empty icon="podium">No student has earned XP yet. The first group forms as soon as one does.</Empty>
            </div>
          ) : (
            data.groups.map((g) => (
              <div key={g.id} className="ad-card">
                <div className="ad-card-head">
                  <h3>
                    <Icon name="podium" size={18} /> Group {g.number}
                  </h3>
                  <span>
                    {g.size} student{g.size === 1 ? "" : "s"} · {g.movers ? `top ${g.movers} move up, bottom ${g.movers} move down` : "too small for anyone to move"}
                  </span>
                </div>
                <div className="ad-table-wrap">
                  <table className="ad-table ad-league-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>League</th>
                        <th>Level</th>
                        <th>XP this week</th>
                        <th>On Monday</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.userId} onClick={() => nav(studioPath(`/students/${r.userId}`))}>
                          <td>{r.rank}</td>
                          <td>
                            <div className="ad-person">
                              <Avatar name={r.name} avatar={r.avatar} />
                              <div>
                                <b>{r.name}</b>
                                <span>{r.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>{r.tier}</td>
                          <td>
                            <span className="ad-chip lvl">Lv {r.level}</span>
                          </td>
                          <td>
                            <b>{r.xp.toLocaleString()}</b>
                          </td>
                          <td>
                            <Movement zone={r.zone} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <div className="ad-card">
            <div className="ad-card-head">
              <h3>
                <Icon name="clock" size={18} /> Last week
              </h3>
              <span>{data.last ? `${day(data.last.week)} – ${day(data.last.end)}` : "no earlier week"}</span>
            </div>
            {!data.last || data.last.rows.length === 0 ? (
              <Empty icon="clock">Results appear here after the first week closes.</Empty>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table ad-league-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Finished</th>
                      <th>XP</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.last.rows.map((r) => (
                      <tr key={r.userId} onClick={() => nav(studioPath(`/students/${r.userId}`))}>
                        <td>
                          <b>{r.name}</b>
                        </td>
                        <td>#{r.rank}</td>
                        <td>{r.xp.toLocaleString()}</td>
                        <td>
                          {RESULT[r.move]} {r.to}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
