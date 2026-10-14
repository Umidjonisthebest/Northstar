import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ackWelcomeBack, claimWelcomeBack, studentAnnouncements } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import Icon, { Medal } from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { novaMood } from "../../components/nova/moods.js";
import Avatar from "../../components/avatar/Avatar.jsx";
import { chunkWord } from "../../components/avatar/shopParts.js";
import Logo from "../../components/Brand.jsx";
import { usePresence } from "./usePresence.js";
import "../../shell.css";
import "../../sky.css";

// Navigation per exam. The SAT / IELTS switch in the sidebar picks the set;
// shared pages (Ask Nova, Vocab, Trophies) keep whichever exam was last used.
// Each link's icon sits on a small rounded tile. The tile colours are one analogous family
// (neighbouring hues, the same strength), running from the app's blue through indigo and violet
// to Nova's orchid: one hue per group, so the menu reads as a single gradient from top to bottom
// instead of a row of unrelated colours. Coral and gold are not used here: coral is kept for
// "your next step" and gold for stars.
const BLUE = "#4f7df3";
const INDIGO = "#6a63ec";
const VIOLET = "#8a5fe6";
const ORCHID = "#b05fd6";

// My Class: for students who are in a class, and for a student who hasn't answered yet (a new
// account), who enters their class code there. Everyone else doesn't see it.
const MY_CLASS = { to: "/class", label: "My Class", icon: "users", badge: "class", tint: BLUE, classOnly: true };

// Four groups by what the student is doing: today's work, practising, seeing progress, tools.
const NAV = {
  sat: [
    {
      group: "Today",
      items: [
        { to: "/dashboard", label: "Home", icon: "home", tint: BLUE },
        MY_CLASS,
        { to: "/daily", label: "Daily Star", icon: "northStar", badge: "daily", tint: BLUE },
        { to: "/plan", label: "Study Planner", icon: "calendar", badge: "plan", tint: BLUE },
        { to: "/nova", label: "Ask Nova", nova: true, tint: BLUE }
      ]
    },
    {
      group: "Practise",
      items: [
        { to: "/practice", label: "Question Bank", icon: "bank", tint: INDIGO },
        // Practice tests, their results and the teacher's mocks: one page, three tabs (MockExams.jsx).
        { to: "/mock", label: "Practice Tests", icon: "mock", tint: INDIGO },
        { to: "/diagnostic", label: "Diagnostic Test", icon: "compass", badge: "diagnostic", tint: INDIGO },
        { to: "/mistakes", label: "Saved & Mistakes", icon: "bookmark", badge: "mistakes", tint: INDIGO },
        { to: "/vocab", label: "Vocab", icon: "book", tint: INDIGO }
      ]
    },
    {
      group: "Progress",
      items: [
        { to: "/sky", label: "Your Sky", icon: "constellation", tint: VIOLET },
        { to: "/analytics", label: "Analytics", icon: "chart", tint: VIOLET },
        { to: "/gap", label: "Point-Gap Map", icon: "target", tint: VIOLET },
        { to: "/leagues", label: "Leagues", icon: "podium", tint: VIOLET },
        { to: "/trophies", label: "Trophies", icon: "trophy", tint: VIOLET },
        { to: "/recap", label: "Monthly Recap", icon: "calendarStar", badge: "recap", tint: VIOLET }
      ]
    },
    {
      group: "Tools & help",
      items: [
        { to: "/score", label: "Score Calculator", icon: "calc", tint: ORCHID },
        { to: "/shop", label: "Comet Shop", icon: "comet", tint: ORCHID },
        { to: "/messages", label: "Message Developers", icon: "chat", badge: "messages", tint: ORCHID }
      ]
    }
  ],
  ielts: [
    {
      group: "Today",
      items: [
        { to: "/ielts-prep", label: "Home", icon: "home", end: true, tint: BLUE },
        MY_CLASS,
        { to: "/nova", label: "Ask Nova", nova: true, tint: BLUE }
      ]
    },
    {
      group: "Practise",
      items: [
        { to: "/ielts-prep/practice", label: "Section Practice", icon: "layers", tint: INDIGO },
        // The same for IELTS (IeltsPracticeTests.jsx): the teacher's mock tests are a tab of it now.
        { to: "/ielts-prep/practice-tests", label: "Practice Tests", icon: "mock", tint: INDIGO },
        { to: "/ielts-prep/diagnostic", label: "Diagnostic Test", icon: "compass", badge: "ieltsDiagnostic", tint: INDIGO },
        { to: "/vocab", label: "Vocab", icon: "book", tint: INDIGO }
      ]
    },
    {
      group: "Progress",
      items: [
        { to: "/sky", label: "Your Sky", icon: "constellation", tint: VIOLET },
        { to: "/ielts-prep/analytics", label: "Analytics", icon: "chart", tint: VIOLET },
        { to: "/leagues", label: "Leagues", icon: "podium", tint: VIOLET },
        { to: "/trophies", label: "Trophies", icon: "trophy", tint: VIOLET },
        { to: "/recap", label: "Monthly Recap", icon: "calendarStar", badge: "recap", tint: VIOLET }
      ]
    },
    {
      group: "Tools & help",
      items: [
        { to: "/ielts-prep/score", label: "Band Calculator", icon: "calc", tint: ORCHID },
        { to: "/shop", label: "Comet Shop", icon: "comet", tint: ORCHID },
        { to: "/messages", label: "Message Developers", icon: "chat", badge: "messages", tint: ORCHID }
      ]
    }
  ]
};

// The five things a phone's bottom bar offers; "More" opens the full menu.
const TABS = {
  sat: [
    { to: "/dashboard", label: "Home", icon: "home" },
    { to: "/practice", label: "Practise", icon: "bank" },
    { to: "/nova", label: "Nova", nova: true },
    { to: "/sky", label: "Sky", icon: "constellation" }
  ],
  ielts: [
    { to: "/ielts-prep", label: "Home", icon: "home", end: true },
    { to: "/ielts-prep/practice", label: "Practise", icon: "layers" },
    { to: "/nova", label: "Nova", nova: true },
    { to: "/leagues", label: "Leagues", icon: "podium" }
  ]
};

const SAT_ONLY = ["/dashboard", "/daily", "/diagnostic", "/practice", "/mistakes", "/analytics", "/gap", "/plan", "/mock", "/score"];
const HOME = { sat: "/dashboard", ielts: "/ielts-prep" };

function readStoredExam() {
  try {
    return localStorage.getItem("ns_exam") === "ielts" ? "ielts" : "sat";
  } catch {
    return "sat";
  }
}

function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    const esc = (e) => e.key === "Escape" && onOutside();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [ref, onOutside, active]);
}

function Bell({ token }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem("ns_ann_seen") || "";
    } catch {
      return "";
    }
  });
  const box = useRef(null);
  useClickOutside(box, () => setOpen(false), open);

  useEffect(() => {
    studentAnnouncements(token)
      .then((d) => setItems(d.announcements || []))
      .catch(() => {});
  }, [token]);

  const newest = items.reduce((m, a) => (a.createdAt > m ? a.createdAt : m), "");
  const unread = items.filter((a) => a.createdAt > seen).length;

  return (
    <div className="ns-pop-anchor" ref={box}>
      <button
        className="ns-bar-icon"
        aria-label={unread ? `Notifications (${unread} new)` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (newest) {
            setSeen(newest);
            try {
              localStorage.setItem("ns_ann_seen", newest);
            } catch {
              /* private mode */
            }
          }
        }}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="ns-dot">{unread}</span>}
      </button>
      {open && (
        <div className="ns-pop ns-pop-right ns-bell-pop" role="dialog" aria-label="Notifications">
          <p className="ns-pop-title">From your teachers</p>
          {items.length === 0 ? (
            <p className="ns-pop-empty">No announcements yet.</p>
          ) : (
            items.map((a) => (
              <div key={a.id} className={`ns-ann ${a.tone || ""}`}>
                <b>
                  {a.pinned && <Icon name="pinFilled" size={12} />} {a.title}
                </b>
                <p>{a.body}</p>
                <small>{new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// The foot of the sidebar: the picture and the gear both open Settings (/profile), which holds the
// profile, the theme, the study goals and signing out.
function UserMenu({ user }) {
  return (
    <div className="ns-side-user">
      <Link to="/profile" className="ns-side-avatar-link" aria-label="Your profile and settings">
        <Avatar avatar={user?.avatar} name={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Me"} size={40} />
      </Link>
      <Link to="/profile" className="ns-side-user-meta">
        <b>
          {user?.firstName} {user?.lastName}
        </b>
        <span>ID {user?.candidateId}</span>
      </Link>
      <Link to="/profile" className="ns-side-icon" aria-label="Settings">
        <Icon name="gear" size={18} />
      </Link>
    </div>
  );
}

// Shown to a student who is back after a few days away. The gift (XP and the
// Returning Star badge) has already been given by the server when this
// appears: there is nothing to do but close it.
function WelcomeBack({ gift, name, onClose }) {
  const button = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    button.current?.focus();
    const esc = (e) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  return createPortal(
    <div className="ns-welcome-back" role="dialog" aria-modal="true" aria-labelledby="ns-welcome-title" aria-describedby="ns-welcome-text">
      <div className="ns-welcome-card">
        <Nova size={104} mood={novaMood("welcomeBack")} float />
        <p className="ns-welcome-kicker">Welcome back</p>
        <h2 id="ns-welcome-title">Good to see you{name ? `, ${name}` : ""}.</h2>
        <p id="ns-welcome-text">
          It's been {gift.daysAway} days, and your sky kept every star you lit. Here's a little something to get you going again. There's nothing to do for it: it's already yours.
        </p>
        <div className="ns-welcome-gifts">
          <div className="ns-welcome-gift">
            <Icon name="bolt" size={40} />
            <b>+{gift.xp} XP</b>
            <span>added to your total</span>
          </div>
          <div className="ns-welcome-gift">
            <Medal id="returning_star" size={44} />
            <b>Returning Star</b>
            <span>{gift.newBadge ? "a new badge for your trophy case" : "your badge shines on"}</span>
          </div>
        </div>
        <div className="ns-welcome-actions">
          <button ref={button} className="ns-btn ns-btn-primary" onClick={onClose}>
            Thanks, let's go
          </button>
          <Link to="/sky" onClick={onClose}>
            See my sky
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function StudentShell() {
  const { user, token } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const [open, setOpen] = useState(false);
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const claiming = useRef(false);
  // "Studying now": this page's heartbeat, and the anonymous count it gets back.
  const presence = usePresence(token);
  const studying = !presence ? null : presence.few ? ["A few students are studying", "A few studying"] : [`${presence.count} students studying now`, `${presence.count} studying`];
  const nav = useNavigate();
  const loc = useLocation();
  const panel = useRef(null);

  const path = loc.pathname;
  const exam = path.startsWith("/ielts-prep") ? "ielts" : SAT_ONLY.some((p) => path === p || path.startsWith(`${p}/`)) ? "sat" : readStoredExam();

  useEffect(() => {
    try {
      localStorage.setItem("ns_exam", exam);
    } catch {
      /* private mode */
    }
  }, [exam]);

  useEffect(() => {
    setOpen(false);
    refresh();
    panel.current?.scrollTo({ top: 0 });
  }, [path, refresh]);

  // Back after a break: the server checks the absence and gives the gift;
  // the screen then shows what was given until it is closed.
  const welcomeDue = Boolean(progress?.welcomeBack?.eligible);
  useEffect(() => {
    if (!welcomeDue || claiming.current) return;
    claiming.current = true;
    claimWelcomeBack(token)
      .then(refresh)
      .catch(() => {
        /* it stays due and is offered again on the next page */
      })
      .finally(() => {
        claiming.current = false;
      });
  }, [welcomeDue, token, refresh]);
  const welcomeGift = welcomeClosed ? null : progress?.welcomeBack?.pending;
  const closeWelcome = () => {
    setWelcomeClosed(true);
    ackWelcomeBack(token)
      .then(refresh)
      .catch(() => {
        /* shown again next time, which is harmless */
      });
  };

  const switchExam = (mode) => {
    try {
      localStorage.setItem("ns_exam", mode);
    } catch {
      /* private mode */
    }
    nav(HOME[mode]);
  };

  // The student's class comes with their progress (fresh on every page); the stored profile fills
  // in until that has loaded.
  const account = progress || user;
  const inClass = Boolean(account?.classroom);
  const showClass = inClass || account?.schoolAsked === false;

  const badges = {
    plan: progress ? progress.plan.tasks.filter((t) => !t.done && (t.overdue || t.isToday)).length : 0,
    mistakes: progress?.practice.savedCount || 0,
    // Until today's one attempt at the daily question has been used.
    daily: progress?.daily && !progress.daily.attempted ? 1 : 0,
    // Last month's recap, until it has been opened.
    recap: progress?.recap?.ready && progress.recap.unseen ? "New" : 0,
    // "New" until the first diagnostic is done; "1" while one is waiting to be finished.
    diagnostic: progress?.diagnostic ? (progress.diagnostic.open ? 1 : progress.diagnostic.latest ? 0 : "New") : 0,
    ieltsDiagnostic: progress?.ieltsDiagnostic ? (progress.ieltsDiagnostic.open ? 1 : progress.ieltsDiagnostic.latest ? 0 : "New") : 0,
    // Replies from the developers that haven't been opened.
    messages: progress?.messages?.unread || 0,
    // Homework still to do, plus chat messages not read yet. "New" for a student who hasn't
    // entered a class code or said they have none.
    class: inClass ? (progress?.class?.homework || 0) + (progress?.class?.unread || 0) : "New"
  };
  const chunks = progress?.chunks?.balance ?? 0;
  const novaCost = progress?.chunks?.novaCost ?? 1;

  return (
    <div className="ns-shell">
      <aside className={`ns-side ${open ? "open" : ""}`}>
        <div className="ns-side-top">
          <Logo to={exam === "ielts" ? "/ielts-prep" : "/dashboard"} size={34} />
          <button className="ns-side-icon ns-only-mobile" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="ns-exam-switch" role="tablist" aria-label="Exam">
          {[
            ["sat", "SAT"],
            ["ielts", "IELTS"]
          ].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={exam === key} className={exam === key ? "on" : ""} onClick={() => switchExam(key)}>
              {label}
            </button>
          ))}
        </div>

        <nav className="ns-side-nav" aria-label="Main">
          {NAV[exam].map((g, gi) => (
            <div key={gi} className="ns-side-group">
              {g.group && <p className="ns-side-label">{g.group}</p>}
              {g.items.filter((item) => !item.classOnly || showClass).map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `ns-side-link ${isActive ? "active" : ""}`} style={{ "--tint": item.tint }}>
                  <span className={`ns-side-link-icon ${item.nova ? "nova-tile" : ""}`}>{item.nova ? <Nova size={24} sparkles={false} /> : <Icon name={item.icon} size={19} />}</span>
                  <span className="ns-side-link-label">{item.label}</span>
                  {item.badge && badges[item.badge] ? <span className="ns-side-badge">{badges[item.badge]}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="ns-side-foot">
          {progress && (
            <div className="ns-side-goal" title={`${progress.today.xp} of ${progress.today.goal} XP today`}>
              <div className="ns-side-goal-top">
                <span>Daily goal</span>
                <b>
                  {progress.today.xp}/{progress.today.goal} XP
                </b>
              </div>
              <div className="ns-side-goal-bar">
                <div style={{ width: `${Math.min(100, Math.round((progress.today.xp / progress.today.goal) * 100))}%` }} />
              </div>
            </div>
          )}
          <UserMenu user={user} />
        </div>
      </aside>
      {open && <div className="ns-scrim" onClick={() => setOpen(false)} />}

      <div className="ns-panel" ref={panel}>
        <header className="ns-bar">
          <button className="ns-bar-icon ns-only-mobile" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="ns-bar-spacer" />
          {studying && (
            <span className="ns-presence" role="img" aria-label={`${studying[0]}. No names are shown.`} title="Students active in the last two minutes. No names are shown.">
              <i />
              <span className="ns-presence-long">{studying[0]}</span>
              <span className="ns-presence-short">{studying[1]}</span>
            </span>
          )}
          {/* Announcements come from teachers, and only a class has teachers. */}
          {inClass && <Bell token={token} />}
          {/* The three counters explain themselves on hover, focus or a tap (shell.css, .ns-hint).
              XP and comet chunks are two different counts: XP is never spent, chunks are. */}
          <div className="ns-bar-stats">
            <span className="ns-hint">
              <Link
                to="/sky"
                className={`ns-bar-stat streak ${progress?.streak.activeToday ? "lit" : ""}`}
                aria-label={`${progress?.streak.current ?? 0} day streak. Open your sky`}
                aria-describedby="ns-hint-streak"
              >
                <Icon name="northStar" size={18} /> {progress?.streak.current ?? 0}
              </Link>
              <span className="ns-hint-card" role="tooltip" id="ns-hint-streak">
                <b>
                  <Icon name="northStar" size={16} /> {progress?.streak.current ?? 0}-day streak
                </b>
                <span>
                  Every day you study lights a star. Your streak is how many days in a row have one.{" "}
                  {progress?.streak.activeToday ? "Today's star is lit." : "Answer one question to light today's star."}
                </span>
                <small>
                  Best so far: {progress?.streak.longest ?? 0} day{progress?.streak.longest === 1 ? "" : "s"}. A missed day can be relit for two days after it.
                </small>
              </span>
            </span>
            <span className="ns-hint">
              <button type="button" className="ns-bar-stat xp" aria-label={`${progress?.xp ?? 0} XP, level ${progress?.level ?? 1}`} aria-describedby="ns-hint-xp">
                <Icon name="bolt" size={17} /> {progress?.xp ?? 0}
                <span className="ns-bar-unit">XP</span>
              </button>
              <span className="ns-hint-card" role="tooltip" id="ns-hint-xp">
                <b>
                  <Icon name="bolt" size={16} /> {progress?.xp ?? 0} XP · Level {progress?.level ?? 1}
                </b>
                <span>XP shows how much you have learned. You earn it for right answers (more for harder questions), plan tasks and the daily star. It sets your level and your place in this week's league, and it is never spent.</span>
                {progress && (
                  <>
                    <span className="ns-hint-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNext) * 100))}%` }} />
                    </span>
                    <small>
                      {progress.xpIntoLevel} of {progress.xpForNext} XP to level {progress.level + 1}
                    </small>
                  </>
                )}
              </span>
            </span>
            <span className="ns-hint">
              <Link to="/shop" className="ns-bar-stat chunks" aria-label={`${chunks} ${chunkWord(chunks)}. Open the Comet Shop`} aria-describedby="ns-hint-chunks">
                <Icon name="comet" size={18} /> {chunks}
              </Link>
              <span className="ns-hint-card" role="tooltip" id="ns-hint-chunks">
                <b>
                  <Icon name="comet" size={16} /> {chunks} {chunkWord(chunks)}
                </b>
                <span>
                  Comet chunks are for spending: {novaCost} for each message on the Ask Nova page, and things for your picture in the Comet Shop. Nova's hints inside a question and every explanation
                  are free.
                </span>
                <small>You earn them by studying: the first thing you do each day, your daily goal, the daily star, new levels and new trophies.</small>
              </span>
            </span>
          </div>
        </header>
        <main className="ns-content">
          <Outlet context={{ exam }} />
        </main>
      </div>
      {/* Phones: the five most-used places within thumb reach. Hidden on wider screens (shell.css). */}
      <nav className="ns-tabbar" aria-label="Quick navigation">
        {TABS[exam].map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `ns-tab ${isActive ? "active" : ""}`}>
            <span className="ns-tab-icon">{tab.nova ? <Nova size={24} sparkles={false} /> : <Icon name={tab.icon} size={22} />}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`ns-tab ${open ? "active" : ""}`} onClick={() => setOpen(true)} aria-expanded={open} aria-label="More: open the full menu">
          <span className="ns-tab-icon">
            <Icon name="moreH" size={22} />
          </span>
          <span>More</span>
        </button>
      </nav>
      {welcomeGift && <WelcomeBack gift={welcomeGift} name={user?.firstName} onClose={closeWelcome} />}
    </div>
  );
}
