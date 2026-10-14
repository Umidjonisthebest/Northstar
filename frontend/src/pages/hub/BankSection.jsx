import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { practiceSkillTable } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_NAME, playerUrl } from "./hubUtils.js";

const LEVELS = [
  ["Easy", "easy"],
  ["Medium", "medium"],
  ["Hard", "hard"],
  ["Challenging", "challenging"]
];
const COMPLETED = [
  ["", "All questions"],
  ["unanswered", "Unanswered"],
  ["correct", "Answered correctly"],
  ["incorrect", "Answered incorrectly"]
];
const ORDERS = [
  ["normal", "Normal"],
  ["shuffle", "Shuffle"],
  ["easy", "Easy to hard"],
  ["hard", "Hard to easy"],
  ["unanswered", "Unanswered first"]
];
const TYPES = [
  ["", "All question types"],
  ["mcq", "Multiple choice"],
  ["grid_in", "Student-produced response"]
];

function FilterPill({ icon, label, active, count, children, width }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  // The menu opens from its pill's left edge. A pill near the right edge of a phone has no room
  // for it there, so the menu is moved left by as much as it would run off the screen.
  const menu = useRef(null);
  useLayoutEffect(() => {
    if (!open || !menu.current || !box.current) return;
    const left = box.current.getBoundingClientRect().left;
    const over = left + menu.current.offsetWidth - (document.documentElement.clientWidth - 12);
    menu.current.style.left = over > 0 && left > 12 ? `${-Math.min(over, left - 12)}px` : "";
  }, [open]);
  return (
    <div className="ns-pop-anchor" ref={box}>
      <button className={`ns-fpill ${active ? "active" : ""}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} size={18} /> {label}
        {count > 0 && <span className="ns-fpill-count">{count}</span>}
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="ns-pop ns-fmenu" role="menu" ref={menu} style={width ? { width } : undefined}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function CheckItem({ on, onClick, children }) {
  return (
    <button role="menuitemcheckbox" aria-checked={on} className="ns-menu-item" onClick={onClick}>
      {children}
      <span className={`ns-check2 ${on ? "on" : ""}`}>{on && <Icon name="check" size={13} strokeWidth={3} />}</span>
    </button>
  );
}

function RadioItem({ on, onClick, children }) {
  return (
    <button role="menuitemradio" aria-checked={on} className="ns-menu-item" onClick={onClick}>
      {children}
      <span className={`ns-radio2 ${on ? "on" : ""}`} />
    </button>
  );
}

function accTone(a) {
  if (a == null) return null;
  return a >= 0.7 ? "var(--viz-c-med)" : a >= 0.5 ? "#eab308" : "var(--viz-w-med)";
}

// Filters are remembered per section for this browser tab.
function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  }, [key, value]);
  return [value, setValue];
}

// Keyed by section: the filters, the picked skills and the table belong to that section alone. (The
// route reuses this component when only :sec changes, which carried one section's filters, and its
// table, over to the other.)
export default function BankSection() {
  const { sec } = useParams();
  return <BankSectionPage key={sec} sec={sec} />;
}

function BankSectionPage({ sec }) {
  const { token } = useStudentAuth();
  const nav = useNavigate();
  const section = SECTION_NAME[sec];
  const [f, setF] = useStoredState(`ns_bank_filters_${sec}`, { difficulty: [], status: "", order: "normal", seed: 7, flagged: false, saved: false, type: "" });
  const [res, setRes] = useState({ key: "", data: null, error: "" });
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"
  const [picked, setPicked] = useState(() => new Set());

  const query = useMemo(
    () => ({ difficulty: f.difficulty, status: f.status, flagged: f.flagged ? "1" : "", saved: f.saved ? "1" : "", type: f.type }),
    [f.difficulty, f.status, f.flagged, f.saved, f.type]
  );
  const key = `${attempt}:${JSON.stringify(query)}`;

  useEffect(() => {
    if (!section) return undefined;
    let alive = true;
    practiceSkillTable(token, sec, query)
      .then((d) => alive && setRes({ key, data: d, error: "" }))
      // A failed reload keeps the table that is already on screen, and says so; the error clears
      // itself as soon as the filters change or a retry works (it used to stay for good).
      .catch((e) => alive && setRes((r) => ({ ...r, key, error: e.message })));
    return () => {
      alive = false;
    };
  }, [token, sec, section, query, key]);

  const data = res.data;
  const error = res.key === key ? res.error : "";
  const allSkills = useMemo(() => (data ? data.domains.flatMap((d) => d.skills) : []), [data]);
  if (!section) return <Navigate to="/practice" replace />;
  if (error && !data) {
    return (
      <div className="ns-empty2">
        <b>Couldn't load this section</b>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <Loading />;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const go = (skills) =>
    nav(
      playerUrl({
        source: "bank",
        sec,
        skills,
        difficulty: f.difficulty,
        status: f.status,
        flagged: f.flagged,
        saved: f.saved,
        type: f.type,
        order: f.order,
        seed: f.order === "shuffle" ? f.seed : undefined,
        from: `/practice/${sec}`
      })
    );
  const pickedSkills = allSkills.filter((s) => picked.has(s.skill));
  const pickedCount = pickedSkills.reduce((n, s) => n + s.matching, 0);
  const toggle = (skill) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  const extraCount = Number(f.flagged) + Number(f.saved) + Number(Boolean(f.type));
  const skillCount = allSkills.filter((s) => s.total > 0).length;

  return (
    <div className="ns-sec-page ns-page">
      <Link to="/practice" className="ns-back">
        <Icon name="chevronLeft" size={16} /> Back to Question Bank
      </Link>
      <div className="ns-sec-title">
        <h1>{section}</h1>
        <FilterPill icon="more" label="More options" width={290}>
          {(close) => (
            <>
              <button
                className="ns-menu-item"
                onClick={() => {
                  close();
                  nav(playerUrl({ source: "drill", sec, size: 10, from: `/practice/${sec}` }));
                }}
              >
                <Icon name="bolt" size={16} /> 10 unseen questions (drill)
              </button>
              <button
                className="ns-menu-item"
                onClick={() => {
                  close();
                  nav(playerUrl({ source: "saved", sec, from: `/practice/${sec}` }));
                }}
              >
                <Icon name="mistakes" size={16} /> Review my mistakes here
              </button>
              <button
                className="ns-menu-item"
                onClick={() => {
                  close();
                  set({ difficulty: [], status: "", order: "normal", flagged: false, saved: false, type: "" });
                }}
              >
                <Icon name="undo" size={16} /> Reset filters
              </button>
            </>
          )}
        </FilterPill>
      </div>

      <div className="ns-filterbar">
        <FilterPill icon="levels" label="Difficulty" active={f.difficulty.length > 0} count={f.difficulty.length}>
          {LEVELS.map(([level, cls]) => (
            <CheckItem key={level} on={f.difficulty.includes(level)} onClick={() => set({ difficulty: f.difficulty.includes(level) ? f.difficulty.filter((x) => x !== level) : [...f.difficulty, level] })}>
              <span className={`ns-tag2 ${cls}`}>{level}</span>
            </CheckItem>
          ))}
        </FilterPill>
        <FilterPill icon="success" label={COMPLETED.find(([v]) => v === f.status)?.[1].replace("All questions", "Completed") || "Completed"} active={Boolean(f.status)}>
          {(close) =>
            COMPLETED.map(([v, label]) => (
              <RadioItem
                key={v}
                on={f.status === v}
                onClick={() => {
                  set({ status: v });
                  close();
                }}
              >
                {label}
              </RadioItem>
            ))
          }
        </FilterPill>
        <FilterPill icon="shuffle" label={`Order: ${ORDERS.find(([v]) => v === f.order)?.[1] || "Normal"}`} active={f.order !== "normal"}>
          {(close) =>
            ORDERS.map(([v, label]) => (
              <RadioItem
                key={v}
                on={f.order === v}
                onClick={() => {
                  set({ order: v, seed: v === "shuffle" ? 1 + Math.floor(Math.random() * 100000) : f.seed });
                  close();
                }}
              >
                {label}
              </RadioItem>
            ))
          }
        </FilterPill>
        <FilterPill icon="filter" label="Filters" active={extraCount > 0} count={extraCount} width={300}>
          <CheckItem on={f.flagged} onClick={() => set({ flagged: !f.flagged })}>
            <Icon name="bookmark" size={16} /> Marked for review
          </CheckItem>
          <CheckItem on={f.saved} onClick={() => set({ saved: !f.saved })}>
            <Icon name="mistakes" size={16} /> In my mistakes queue
          </CheckItem>
          {sec === "math" && (
            <>
              <p className="ns-fmenu-note">Question type</p>
              {TYPES.map(([v, label]) => (
                <RadioItem key={v} on={f.type === v} onClick={() => set({ type: v })}>
                  {label}
                </RadioItem>
              ))}
            </>
          )}
        </FilterPill>
      </div>

      {error && (
        <p className="ns-empty2" role="alert" style={{ padding: 12 }}>
          Couldn't refresh the list: {error}{" "}
          <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}

      <div className="ns-card2 ns-practice-all">
        <div>
          <h3>Practice all topics</h3>
          <p>
            Start practicing all {skillCount} skills in {section}
            {data.matching !== data.total ? ` · ${data.matching} questions match your filters` : ` · ${data.total} questions`}.
          </p>
        </div>
        <button className="ns-btn ns-btn-soft" disabled={!data.matching} onClick={() => go([])}>
          Start practice
        </button>
      </div>

      <div className="ns-skill-table" role="table" aria-label={`${section} skills`}>
        <div className="ns-skill-head" role="row">
          <span role="columnheader">Topic</span>
          <span role="columnheader">Progress</span>
          <span role="columnheader">Accuracy</span>
        </div>
        {data.domains.map((d) => (
          <div key={d.domain} className="ns-domain" role="rowgroup">
            <h3>{d.domain}</h3>
            {d.skills.map((s) => {
              const on = picked.has(s.skill);
              const disabled = s.matching === 0;
              return (
                <div
                  key={s.skill}
                  className="ns-skill-row"
                  role="row"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  style={disabled ? { opacity: 0.55, cursor: "default" } : undefined}
                  title={disabled ? "No questions match your filters" : `Practice ${s.skill}`}
                  onClick={() => !disabled && go([s.skill])}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) {
                      e.preventDefault();
                      go([s.skill]);
                    }
                  }}
                >
                  <span className="ns-skill-name" role="cell">
                    <button
                      className={`ns-check2 ${on ? "on" : ""}`}
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`Select ${s.skill}`}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(s.skill);
                      }}
                    >
                      {on && <Icon name="check" size={14} strokeWidth={3} />}
                    </button>
                    <span>{s.skill}</span>
                  </span>
                  <span className="ns-skill-prog" role="cell">
                    <span className="ns-skill-track">
                      <div style={{ width: `${s.total ? (s.answered / s.total) * 100 : 0}%`, minWidth: s.answered ? 8 : 0 }} />
                    </span>
                    <span className="ns-skill-count">
                      {s.answered}/{s.total}
                    </span>
                  </span>
                  <span className={`ns-skill-acc ${s.accuracy == null ? "none" : ""}`} role="cell">
                    {s.accuracy == null ? (
                      "—"
                    ) : (
                      <>
                        <i style={{ background: accTone(s.accuracy) }} />
                        {Math.round(s.accuracy * 100)} <small>%</small>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {picked.size > 0 && (
        <div className="ns-selbar" role="region" aria-label="Selected skills">
          <span>
            <b>
              {picked.size} skill{picked.size === 1 ? "" : "s"}
            </b>{" "}
            · {pickedCount} question{pickedCount === 1 ? "" : "s"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setPicked(new Set())}>
              Clear
            </button>
            <button className="ns-btn ns-btn-primary ns-btn-sm" disabled={!pickedCount} onClick={() => go(pickedSkills.map((s) => s.skill))}>
              Start practice <Icon name="chevronRight" size={15} />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
