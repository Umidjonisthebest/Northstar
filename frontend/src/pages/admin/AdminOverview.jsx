import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminOverview } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { Avatar, Kpi, Empty, scoreClass, timeAgo } from "../../components/adminUi.jsx";
import { studioPath } from "../../studio/panels.js";
import { useStudio } from "../../studio/useStudio.js";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tashkent" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const TONE_ICON = { info: "info", success: "success", warning: "warning", celebrate: "party" };

export default function AdminOverview() {
  const { token, admin } = useAdminAuth();
  // The same screen in both panels. A teacher's numbers are their classes' (the server leaves out
  // everyone else), and the third button is what each can do: set homework, or add a question.
  const { isTeacher, has } = useStudio();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminOverview(token).then(setD).catch((e) => setErr(e.message));
  }, [token]);

  if (err) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load the overview</h2>
        <p style={{ color: "var(--ink-soft)" }}>{err}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (!d)
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );

  const c = d.counts;
  const maxXp = Math.max(10, ...d.activity.map((a) => a.xp));
  const maxSub = Math.max(1, ...d.activity.map((a) => a.submissions));
  const lastDay = d.activity.at(-1)?.date;

  return (
    <div className="ad-page">
      <section className="ad-hero">
        <div>
          <span className="ad-eyebrow">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Tashkent" }).format(new Date())}</span>
          <h1>
            {greeting()}, {admin?.firstName || (isTeacher ? "teacher" : "admin")}.
          </h1>
          <p>
            {c.activeToday > 0
              ? `${c.activeToday} student${c.activeToday === 1 ? " is" : "s are"} practising today — ${c.activeWeek} active this week.`
              : c.students
                ? `${c.students} ${isTeacher ? "students in your classes" : "students enrolled"}. Post an announcement to get them practising today.`
                : isTeacher
                  ? "No student has joined a class yet. Make a class on the Classes page and give its code to your students."
                  : "Invite your first students by adding them to a session."}
          </p>
        </div>
        <div className="ad-hero-actions">
          <Link to={studioPath("/sessions")} className="ad-btn-gold">
            <Icon name="play" size={16} /> New SAT session
          </Link>
          <Link to={studioPath("/announcements")} className="ad-btn-glass">
            <Icon name="megaphone" size={16} /> Announce
          </Link>
          {has("homework") && (
            <Link to={studioPath("/homework")} className="ad-btn-glass">
              <Icon name="checklist" size={16} /> Set homework
            </Link>
          )}
          {has("practice") && (
            <Link to={studioPath("/practice")} className="ad-btn-glass">
              <Icon name="plus" size={16} /> Add question
            </Link>
          )}
        </div>
      </section>

      <div className="ad-grid-4">
        <Kpi icon="users" tone="violet" label={isTeacher ? "Students in classes" : "Students"} value={c.students} sub={`${c.activeWeek} active this week`} spark={d.activity.map((a) => a.active)} sparkColor="#8b5cf6" />
        <Kpi icon="bolt" tone="amber" label="XP earned · 7 days" value={c.xpWeek.toLocaleString()} sub="across practice & mocks" spark={d.activity.map((a) => a.xp)} sparkColor="#f59e0b" />
        <Kpi icon="mock" tone="rose" label="Module submissions" value={c.submissions} sub={`${c.submissionsWeek} this week · ${c.sessionsLive} live session${c.sessionsLive === 1 ? "" : "s"}`} spark={d.activity.map((a) => a.submissions)} sparkColor="#f43f5e" />
        <Kpi icon="trendUp" tone="green" label="Avg section score" value={c.avgSectionScore ?? "—"} sub="estimate, all submitted modules" />
      </div>

      <div className="ad-grid-2">
        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="chart" size={18} /> Class activity
            </h3>
            <div className="ad-legend">
              <span>
                <i style={{ background: "var(--primary)" }} />
                XP
              </span>
              <span>
                <i style={{ background: "var(--coral)" }} />
                Submissions
              </span>
            </div>
          </div>
          <div className="ad-chart">
            {d.activity.map((a, i) => (
              <div key={a.date} className={`ad-chart-col ${a.date === lastDay ? "today" : ""}`}>
                <div className="ad-chart-bars">
                  <span className="ad-tip">
                    {new Date(a.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {a.xp} XP · {a.submissions} submitted · {a.active} active
                  </span>
                  <i className="xp" style={{ height: `${(a.xp / maxXp) * 100}%`, animationDelay: `${i * 30}ms` }} />
                  <i className="sub" style={{ height: `${(a.submissions / maxSub) * 100}%`, animationDelay: `${i * 30 + 60}ms` }} />
                </div>
                <span>{new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
          <p className="ad-small ad-muted" style={{ margin: "10px 0 0" }}>
            Last 14 days. Hover a day for details.
          </p>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="trophy" size={18} /> Top students
            </h3>
            <Link to={studioPath("/students")} className="ad-link">
              All students <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {d.topStudents.length === 0 && <Empty icon="users">No students yet.</Empty>}
          <div className="ad-feed">
            {d.topStudents.map((s, i) => (
              <Link key={s.id} to={studioPath(`/students/${s.id}`)} className="ad-feed-item">
                <span className={`ad-rank r${i + 1}`}>{i + 1}</span>
                <Avatar name={s.name} avatar={s.avatar} />
                <div className="ad-feed-main">
                  <b>{s.name}</b>
                  <span>
                    Lv {s.level} · {s.practiceAnswered} practised · last active {timeAgo(s.lastActive)}
                  </span>
                </div>
                {s.streak > 0 && (
                  <span className="ad-chip fire">
                    <Icon name="northStar" size={12} /> {s.streak}
                  </span>
                )}
                <span className="ad-chip lvl">{s.xp} XP</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="ad-grid-2">
        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="clock" size={18} /> Recent submissions
            </h3>
            <Link to={studioPath("/analytics")} className="ad-link">
              Analytics <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {d.recent.length === 0 && <Empty icon="mock">No mock modules submitted yet.</Empty>}
          <div className="ad-feed">
            {d.recent.map((r) => (
              <Link key={r.id} to={r.sessionId ? studioPath(`/sessions/${r.sessionId}/participants/${r.participantId}`) : "#"} className="ad-feed-item">
                <Avatar name={r.student} />
                <div className="ad-feed-main">
                  <b>
                    {r.student} · {r.module}
                  </b>
                  <span>
                    {r.test} · {timeAgo(r.at)} · {r.raw}/{r.max} correct
                  </span>
                </div>
                {r.scaled !== null && <span className={`ad-score ${scoreClass(r.scaled)}`}>{r.scaled}</span>}
              </Link>
            ))}
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="play" size={18} /> Live sessions
            </h3>
            <Link to={studioPath("/sessions")} className="ad-link">
              Manage <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {d.liveSessions.length === 0 && <Empty icon="mock">No sessions running right now.</Empty>}
          <div className="ad-feed">
            {d.liveSessions.map((s) => (
              <Link key={s.id} to={studioPath(`/sessions/${s.id}`)} className="ad-feed-item">
                <span className="ad-kpi-icon tone-rose">
                  <Icon name="mock" size={18} />
                </span>
                <div className="ad-feed-main">
                  <b>{s.name}</b>
                  <span>
                    {s.test} · {s.finished}/{s.participants} finished
                  </span>
                  <div className="ad-bar" style={{ marginTop: 6 }}>
                    <i style={{ width: `${s.participants ? (s.finished / s.participants) * 100 : 0}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="ad-card-head" style={{ marginTop: 22 }}>
            <h3>
              <Icon name="megaphone" size={18} /> Latest announcements
            </h3>
            <Link to={studioPath("/announcements")} className="ad-link">
              Post <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {d.announcements.length === 0 && <Empty icon="megaphone">Nothing posted yet.</Empty>}
          <div className="ann-list">
            {d.announcements.map((a) => (
              <div key={a.id} className={`ann ${a.tone}`}>
                <span className="ann-icon">
                  <Icon name={TONE_ICON[a.tone]} size={18} />
                </span>
                <div>
                  <b>{a.title}</b>
                  <small>{timeAgo(a.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
