import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { studentMe, updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon, { Medal } from "../../components/Icon.jsx";
import { useTrophyCard } from "../../components/TrophyCard.jsx";
import Avatar from "../../components/avatar/Avatar.jsx";
import AvatarPicker from "../../components/avatar/AvatarPicker.jsx";
import SchoolSettings from "./classroom/SchoolSettings.jsx";
import { Loading } from "./Home.jsx";
import { pct } from "./hubUtils.js";
import "../../planning.css";
import "../../settings.css";

const TABS = [
  ["account", "Account", "users"],
  ["appearance", "Appearance", "moon"],
  ["goals", "Study goals", "target"],
  ["security", "Sign-in & security", "lock"]
];

const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// A number field that saves when the student leaves it or presses Enter.
function NumberField({ id, label, hint, value, min, max, step, onSave, optional = false }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const commit = () => {
    const v = draft.trim();
    if (v === String(value ?? "")) return;
    if (v === "" && !optional) return setDraft(String(value ?? ""));
    onSave(v === "" ? null : Number(v));
  };
  return (
    <div className="ns-profile-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        placeholder={optional ? "Not set" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

// The card at the top of Account: a strip of sky with the newest trophies, the picture, the name
// and four numbers.
function ProfileCard({ user, progress }) {
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Me";
  const earned = progress.badges.filter((b) => b.earned).sort((a, b) => String(b.earnedAt).localeCompare(String(a.earnedAt)));
  const trophy = useTrophyCard(progress.badges);
  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const stats = [
    ["Current streak", `${progress.streak.current} day${progress.streak.current === 1 ? "" : "s"}`],
    ["Longest streak", `${progress.streak.longest} day${progress.streak.longest === 1 ? "" : "s"}`],
    ["Level", `${progress.level} · ${progress.xp} XP`],
    ["Questions solved", `${progress.practice.solved}${progress.practice.accuracy == null ? "" : ` · ${pct(progress.practice.accuracy)} right`}`]
  ];
  return (
    <section className="ns-set-card ns-set-me" aria-label="Your profile">
      <div className="ns-set-banner">
        <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path className="ns-set-comet a" d="M-20 180C200 150 420 110 640 -10" />
          <path className="ns-set-comet b" d="M120 220C330 190 560 150 820 20" />
          <path className="ns-set-comet c" d="M-40 120C160 110 330 70 470 -20" />
          <path className="ns-set-spark" d="M640 46q0 18 18 18q-18 0-18 18q0-18-18-18q18 0 18-18z" />
          <path className="ns-set-spark small" d="M250 34q0 10 10 10q-10 0-10 10q0-10-10-10q10 0 10-10z" />
          <path className="ns-set-spark small" d="M470 120q0 9 9 9q-9 0-9 9q0-9-9-9q9 0 9-9z" />
        </svg>
        <div className="ns-set-medals">
          {earned.slice(0, 4).map((b) => (
            <button key={b.id} type="button" title={b.name} aria-label={`${b.name} trophy`} aria-haspopup="dialog" onClick={() => trophy.open(b.id)}>
              <Medal id={b.id} size={40} />
            </button>
          ))}
          <Link to="/trophies" aria-label={`All trophies: ${earned.length} of ${progress.badges.length} earned`}>
            {earned.length > 4 ? `+${earned.length - 4}` : <Icon name="trophy" size={18} />}
          </Link>
        </div>
      </div>
      <div className="ns-set-me-body">
        <div className="ns-set-face">
          <Avatar avatar={user?.avatar} name={name} size={104} />
        </div>
        <div className="ns-set-who">
          <h2>{name}</h2>
          <ul>
            {user?.email && (
              <li>
                <Icon name="mail" size={16} /> {user.email}
              </li>
            )}
            <li>
              <Icon name="users" size={16} /> Candidate ID {user?.candidateId}
            </li>
            {joined && (
              <li>
                <Icon name="calendar" size={16} /> Joined {joined}
              </li>
            )}
          </ul>
        </div>
        <dl className="ns-set-stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {trophy.card}
    </section>
  );
}

// Settings: the account, how the app looks, what the plan aims for, and signing in.
// (Still at /profile: the links to it are everywhere.)
export default function Profile() {
  const { user, token, login, logout } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const { darkMode, setDarkMode } = useTheme();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [customDay, setCustomDay] = useState("");
  const [busy, setBusy] = useState(false);
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "account";

  // A browser that signed in before "Joined" existed has no date stored: fetch the account once.
  useEffect(() => {
    if (!user || user.createdAt !== undefined) return;
    studentMe(token)
      .then((me) => login(token, me))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!progress) return <Loading />;

  const exam = progress.nextExam;
  const today = progress.today.date;
  const save = async (body, message) => {
    setBusy(true);
    try {
      await updateSettings(token, body);
      await refresh();
      toast.success(message);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const ownDay = customDay || (exam?.custom ? exam.day : "");

  return (
    <div className="ns-page" style={{ gap: 22, paddingTop: 12 }}>
      <h1 className="ns-h1">
        <Icon name="gear" size={32} /> Settings
      </h1>

      <div className="ns-set">
        <nav className="ns-set-nav" aria-label="Settings sections">
          {TABS.map(([key, label, icon]) => (
            <button key={key} type="button" className={tab === key ? "on" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => setParams(key === "account" ? {} : { tab: key }, { replace: true })}>
              <Icon name={icon} size={18} /> {label}
            </button>
          ))}
        </nav>

        <div className="ns-set-main">
          {tab === "account" && (
            <>
              <ProfileCard user={user} progress={progress} />
              <SchoolSettings />
              <section className="ns-set-card" aria-labelledby="ns-set-pic">
                <h2 id="ns-set-pic">Your profile picture</h2>
                <p className="ns-set-note">Pick a study companion. It shows next to your name in the sidebar and in your league.</p>
                <AvatarPicker />
              </section>
            </>
          )}

          {tab === "appearance" && (
            <section className="ns-set-card" aria-labelledby="ns-set-theme">
              <h2 id="ns-set-theme">Theme</h2>
              <p className="ns-set-note">Light for daytime, dark for late study. Tests and the practice player follow it too.</p>
              <div className="ns-set-themes" role="radiogroup" aria-labelledby="ns-set-theme">
                {[
                  [false, "Light", "sun"],
                  [true, "Dark", "moon"]
                ].map(([dark, label, icon]) => (
                  <button key={label} type="button" role="radio" aria-checked={darkMode === dark} className={`ns-set-theme ${dark ? "dark" : "light"}`} onClick={() => setDarkMode(dark)}>
                    <span className="ns-set-preview" aria-hidden="true">
                      <i />
                      <b />
                      <b />
                      <em />
                    </span>
                    <span className="ns-set-theme-name">
                      <Icon name={icon} size={18} /> {label}
                      {darkMode === dark && <Icon name="check" size={16} strokeWidth={2.8} className="ns-set-tick" />}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "goals" && (
            <>
              <section className="ns-set-card" aria-labelledby="ns-profile-date">
                <h2 id="ns-profile-date">Your SAT date</h2>
                <p className="ns-set-note">
                  {exam
                    ? `${exam.label}: ${exam.daysLeft} day${exam.daysLeft === 1 ? "" : "s"} to go.${exam.chosen ? "" : " This is the next official date. Pick yours below."}`
                    : "No date is set, and there are no official dates coming up. Enter your own date below."}{" "}
                  <Link to="/plan">See your plan</Link>
                </p>
                <div className="ns-profile-dates" role="radiogroup" aria-label="Official SAT dates">
                  {progress.satDates.map((d) => {
                    const on = exam?.chosen && !exam.custom && exam.iso === d.iso;
                    return (
                      <button key={d.iso} role="radio" aria-checked={on} disabled={busy} className={on ? "on" : ""} onClick={() => save({ examDate: d.iso }, "SAT date saved")}>
                        {on && <Icon name="check" size={15} strokeWidth={2.8} />} {d.label}
                      </button>
                    );
                  })}
                </div>
                <form
                  className="ns-profile-own"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (ownDay && (await save({ examDate: ownDay }, "SAT date saved"))) setCustomDay("");
                  }}
                >
                  <label htmlFor="ns-profile-day">Another date (a school-day SAT, for example)</label>
                  <div>
                    <input id="ns-profile-day" type="date" min={addDays(today, 1)} max={addDays(today, 730)} value={ownDay} onChange={(e) => setCustomDay(e.target.value)} />
                    <button className="ns-btn ns-btn-primary ns-btn-sm" disabled={busy || !ownDay || (exam?.custom && ownDay === exam.day)}>
                      Use this date
                    </button>
                    {exam?.chosen && (
                      <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" disabled={busy} onClick={() => save({ examDate: null }, "Back to the next official date")}>
                        Clear my date
                      </button>
                    )}
                  </div>
                  {exam?.custom && <small>Your own date is set: {exam.label}.</small>}
                </form>
              </section>

              <section className="ns-set-card" aria-labelledby="ns-set-targets">
                <h2 id="ns-set-targets">Targets</h2>
                <p className="ns-set-note">Your plan and the point-gap map are built around these. Each one saves when you leave the box.</p>
                <div className="ns-profile-grid">
                  <NumberField
                    key={`t${progress.targetScore}`}
                    id="ns-profile-target"
                    label="Target SAT score"
                    hint="400 to 1600"
                    value={progress.targetScore}
                    min={400}
                    max={1600}
                    step={10}
                    onSave={(v) => save({ targetScore: v }, "Target score saved")}
                  />
                  <NumberField
                    key={`c${progress.currentScore}`}
                    id="ns-profile-current"
                    label="Current SAT score"
                    hint="Optional. Your latest SAT or PSAT score"
                    value={progress.currentScore}
                    min={400}
                    max={1600}
                    step={10}
                    optional
                    onSave={(v) => save({ currentScore: v }, "Current score saved")}
                  />
                  <NumberField key={`g${progress.dailyGoal}`} id="ns-profile-goal" label="Daily XP goal" hint="10 to 500" value={progress.dailyGoal} min={10} max={500} step={5} onSave={(v) => save({ dailyGoal: v }, "Daily goal saved")} />
                  <NumberField
                    key={`i${progress.ieltsTarget}`}
                    id="ns-profile-ielts"
                    label="Target IELTS band"
                    hint="4 to 9, in half bands"
                    value={progress.ieltsTarget}
                    min={4}
                    max={9}
                    step={0.5}
                    onSave={(v) => save({ ieltsTarget: v }, "Target band saved")}
                  />
                  <div className="ns-profile-field">
                    <label htmlFor="ns-profile-acc">Target accuracy</label>
                    <select id="ns-profile-acc" value={progress.targetAccuracy} disabled={busy} onChange={(e) => save({ targetAccuracy: Number(e.target.value) }, "Target accuracy saved")}>
                      {[0.7, 0.8, 0.9, 1].map((t) => (
                        <option key={t} value={t}>
                          {Math.round(t * 100)}%
                        </option>
                      ))}
                    </select>
                    <small>
                      What the <Link to="/gap">point-gap map</Link> and your plan aim for
                    </small>
                  </div>
                </div>
              </section>
            </>
          )}

          {tab === "security" && (
            <section className="ns-set-card" aria-labelledby="ns-set-signin">
              <h2 id="ns-set-signin">Sign-in</h2>
              <ul className="ns-set-rows">
                <li>
                  <div>
                    <b>Email</b>
                    <span>{user?.email || "Not set. You sign in with the details your teacher gave you."}</span>
                  </div>
                </li>
                <li>
                  <div>
                    <b>Candidate ID</b>
                    <span>{user?.candidateId}. Your teacher uses it to add you to tests, and you type it to enter an IELTS test.</span>
                  </div>
                </li>
                <li>
                  <div>
                    <b>Password</b>
                    <span>Changing it signs out your other devices.</span>
                  </div>
                  <Link to="/change-password" className="ns-btn ns-btn-outline ns-btn-sm">
                    Change password
                  </Link>
                </li>
                <li>
                  <div>
                    <b>Sign out</b>
                    <span>On this device only. Your progress stays on your account.</span>
                  </div>
                  <button
                    type="button"
                    className="ns-btn ns-btn-outline ns-btn-sm ns-set-out"
                    onClick={() => {
                      logout();
                      nav("/");
                    }}
                  >
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </li>
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
