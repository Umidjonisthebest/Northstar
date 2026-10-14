import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminClassesWaiting, adminMessagesWaiting } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { EXAMS, PANELS, STAFF_LOGIN, activeFeature, panelHas, panelMenu, screenTitle } from "../studio/panels.js";
import StaffPassword from "../studio/StaffPassword.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Icon from "../components/Icon.jsx";
import Logo from "../components/Brand.jsx";
import "../admin.css";
import "../messages.css";

// The frame of both staff panels: the admin panel and the teacher studio. `panel` says which one;
// what is in its menu comes from studio/panels.js.
export default function StudioLayout({ panel }) {
  const { admin, token, logout } = useAdminAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [password, setPassword] = useState(false);
  const [q, setQ] = useState("");
  // Conversations from "Message Developers" that nobody has opened yet (the admin's inbox).
  const [waiting, setWaiting] = useState(0);
  // Class-chat messages students have reported and nobody has dealt with yet.
  const [reported, setReported] = useState(0);
  const { base, name, crumb, who } = PANELS[panel];
  const hasInbox = panelHas(panel, "messages");
  const refreshInbox = useCallback(() => {
    const keep = () => {
      /* the badge keeps its last number */
    };
    adminClassesWaiting(token)
      .then((d) => setReported(d.reports))
      .catch(keep);
    if (!hasInbox) return Promise.resolve();
    return adminMessagesWaiting(token)
      .then((d) => setWaiting(d.waiting))
      .catch(keep);
  }, [token, hasInbox]);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
    refreshInbox();
  }, [loc.pathname, refreshInbox]);
  useEffect(() => {
    const timer = setInterval(() => !document.hidden && refreshInbox(), 60000);
    return () => clearInterval(timer);
  }, [refreshInbox]);
  const badges = { messages: waiting, classes: reported };

  const here = screenTitle(panel, loc.pathname);
  // The menu item this address belongs to: a section's editors and detail pages keep it lit.
  const lit = activeFeature(panel, loc.pathname);
  const initials = `${admin?.firstName?.[0] || who[0]}${admin?.lastName?.[0] || ""}`.toUpperCase();

  function handleLogout() {
    logout();
    nav(STAFF_LOGIN);
  }

  return (
    <div className="ad-shell" data-panel={panel} data-exam={here.exam || undefined}>
      <aside className={`ad-side ${open ? "open" : ""}`}>
        <div className="ad-side-top">
          <Logo to={`${base}/overview`} size={38} tag={name} />
          <button className="ad-icon-btn ad-only-mobile" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="ad-nav" aria-label={name}>
          {panelMenu(panel).map((g) => (
            // An exam's screens sit together under the exam's name, in its colour: it is always
            // plain whether a screen is SAT or IELTS.
            <div key={g.label} className={`ad-nav-group${g.exam ? ` ad-nav-exam ${g.exam}` : ""}`} role="group" aria-label={g.exam ? EXAMS[g.exam].full : g.label}>
              {g.exam ? (
                <p className="ad-nav-exam-head">
                  <span className={`ad-exam-tag ${g.exam}`}>{g.label}</span>
                </p>
              ) : (
                <p>{g.label}</p>
              )}
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} aria-label={g.exam ? `${g.label}: ${n.label}` : undefined} className={() => "ad-nav-link" + (n.key === lit ? " active" : "")}>
                  <span className="ad-nav-icon">
                    <Icon name={n.icon} size={18} />
                  </span>
                  {n.label}
                  {n.badge && badges[n.badge] ? (
                    <span className="ad-nav-badge" aria-label={`${badges[n.badge]} waiting`}>
                      {badges[n.badge]}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="ad-side-card">
          <Icon name="sparkles" size={18} />
          <div>
            <b>Student view</b>
            <p>{panel === "teacher" ? "See the app the way your students do." : "See the app the way students do."}</p>
            <a href="/" target="_blank" rel="noreferrer">
              Open student site <Icon name="arrowRight" size={13} />
            </a>
          </div>
        </div>
      </aside>
      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}

      <div className="ad-main">
        <header className="ad-top">
          <button className="ad-icon-btn ad-only-mobile" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="ad-crumb">
            <span>{crumb}</span>
            <Icon name="arrowRight" size={12} />
            {here.exam && (
              <>
                <span className={`ad-exam-tag ${here.exam}`}>{EXAMS[here.exam].name}</span>
                <Icon name="arrowRight" size={12} />
              </>
            )}
            <b>{here.title}</b>
          </div>
          <form
            className="ad-search"
            onSubmit={(e) => {
              e.preventDefault();
              nav(`${base}/students?q=${encodeURIComponent(q)}`);
            }}
          >
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student by name, email or ID…" />
            <kbd>↵</kbd>
          </form>
          <div className="ad-top-actions">
            <ThemeToggle />
            <div className="ad-user">
              <button className="ad-avatar-btn" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                <span className="ad-avatar">{initials}</span>
                <span className="ad-hide-sm">
                  <b>
                    {admin?.firstName} {admin?.lastName}
                  </b>
                  <small>{who}</small>
                </span>
              </button>
              {menu && (
                <div className="ad-menu" role="menu">
                  <p>{admin?.email}</p>
                  <a href="/" target="_blank" rel="noreferrer">
                    <Icon name="eye" size={16} /> View student site
                  </a>
                  <a href="/ielts" target="_blank" rel="noreferrer">
                    <Icon name="headphones" size={16} /> Open IELTS exam room
                  </a>
                  <button
                    className="ad-menu-plain"
                    onClick={() => {
                      setMenu(false);
                      setPassword(true);
                    }}
                  >
                    <Icon name="key" size={16} /> Change password
                  </button>
                  <button onClick={handleLogout}>
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="ad-content">
          <Outlet context={{ refreshInbox, panel }} />
        </main>
      </div>
      {password && <StaffPassword onClose={() => setPassword(false)} />}
    </div>
  );
}
