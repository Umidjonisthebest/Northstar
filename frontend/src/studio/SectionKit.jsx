import React from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { EXAMS } from "./panels.js";

// The pieces an exam's section page is made of in both staff panels (styles: admin.css, "Which
// exam a screen belongs to"). Each exam has one Practice tests section with the same three tabs:
// the tests students take alone, their results, and the mocks a teacher runs.

export const TEST_TABS = [
  { key: "tests", label: "Practice tests", icon: "mock" },
  { key: "results", label: "Results", icon: "chart" },
  { key: "mocks", label: "Teacher mocks", icon: "calendar" }
];

// The exam's name as a solid tag in the exam's colour.
export function ExamTag({ exam }) {
  return <span className={`ad-exam-tag ${exam}`}>{EXAMS[exam].name}</span>;
}

// The page's heading: which exam, the section's name, a line about it, and its main button(s).
export function SectionHead({ exam, title, children, actions }) {
  return (
    <div className={`ad-sec-head ad-exam ${exam}`}>
      <div>
        <ExamTag exam={exam} />
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="ad-sec-actions">{actions}</div>}
    </div>
  );
}

// tabs: [{ key, label, icon?, count? }]
export function SectionTabs({ exam, tabs, value, onChange, label }) {
  return (
    <div className={`ad-tabs ad-exam ${exam}`} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={value === t.key ? "on" : ""} onClick={() => onChange(t.key)}>
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.count != null && <i>{t.count}</i>}
        </button>
      ))}
    </div>
  );
}

// The smaller switch inside a tab. options: [[key, label]]
export function SubSwitch({ exam, options, value, onChange, label }) {
  return (
    <div className={`ad-sub ad-exam ${exam}`} role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} className={value === key ? "on" : ""} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// Which tab is open lives in the address (?tab=, and ?view= for the switch inside a tab), so the
// browser's Back button and a link from another page both land on the right one.
export function useSectionTabs(tabs, views = []) {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab = tabs.some((t) => t.key === asked) ? asked : tabs[0].key;
  const askedView = params.get("view");
  const view = views.includes(askedView) ? askedView : views[0] || null;
  const setTab = (key) => setParams(key === tabs[0].key ? {} : { tab: key }, { replace: true });
  const setView = (key) => setParams({ ...(tab === tabs[0].key ? {} : { tab }), ...(key === views[0] ? {} : { view: key }) }, { replace: true });
  return { tab, setTab, view, setView, params };
}
