import React, { useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useProgress } from "../../context/ProgressContext.jsx";
import SkillSky from "../../components/skillsky/SkillSky.jsx";
import Icon from "../../components/Icon.jsx";
import SkyField, { RepairPrompt, SkyLegend, SkyList } from "../../components/Sky.jsx";
import { describeSky } from "../../components/skyModel.js";
import { Loading } from "./Home.jsx";
import { playerUrl } from "./hubUtils.js";

const FIRST_PAGE = 12; // constellations shown before "Show earlier"

// The student's whole sky: every day studied since the first one, as stars
// and constellations, with the streak numbers and the same thing as a list.
export default function Sky() {
  const { progress } = useProgress();
  const { exam } = useOutletContext() || {};
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [asList, setAsList] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (!progress) return <Loading />;

  const { sky, streak, repair } = progress;
  const total = sky.constellations + 1;
  const startRepair = () => nav(playerUrl({ source: "repair", from: "/sky" }));
  // A day's star is lit by any graded work, so on the IELTS side "practise" opens IELTS practice.
  const practice = () => nav(exam === "ielts" ? "/ielts-prep/practice" : playerUrl({ source: "drill", size: 10, from: "/sky" }));
  const tab = params.get("tab") === "skills" ? "skills" : "days";
  const setTab = (t) => setParams(t === "skills" ? { tab: "skills" } : {}, { replace: true });

  const tabs = (
    <div className="ns-sky-tabs" role="tablist" aria-label="Your sky">
      <button type="button" role="tab" aria-selected={tab === "days"} onClick={() => setTab("days")}>
        <Icon name="calendar" size={17} /> Days
      </button>
      <button type="button" role="tab" aria-selected={tab === "skills"} onClick={() => setTab("skills")}>
        <Icon name="northStar" size={17} /> Skills
      </button>
    </div>
  );

  if (tab === "skills") {
    return (
      <div className="ns-page" style={{ gap: 20, paddingTop: 12 }}>
        <div>
          <h1 className="ns-h1">
            <Icon name="northStar" size={32} /> Your sky
          </h1>
          <p className="ns-lead">Every skill on the SAT is a star, and every domain a constellation. Stars grow brighter as you get stronger. None are locked, and none ever go dark.</p>
        </div>
        {tabs}
        <SkillSky />
      </div>
    );
  }

  return (
    <div className="ns-page" style={{ gap: 24, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="northStar" size={32} /> Your sky
        </h1>
        <p className="ns-lead">
          Every day you study lights a star, and every seven stars join into a constellation. Days off stay as dim stars. Nothing here is ever taken away.
        </p>
      </div>
      {tabs}

      <div className="ns-stats">
        {[
          ["Current streak", streak.current, streak.current === 1 ? "day" : "days"],
          ["Best streak", streak.longest, streak.longest === 1 ? "day" : "days"],
          ["Stars lit", sky.lit, sky.repaired ? `${sky.repaired} repaired` : ""],
          ["Constellations", sky.constellations, sky.start ? `${sky.perConstellation - sky.toward} more star${sky.perConstellation - sky.toward === 1 ? "" : "s"} to the next` : ""]
        ].map(([label, value, note]) => (
          <div key={label} className="ns-stat2">
            <span className="ns-stat2-label">{label}</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{value}</span>
            </div>
            {note && <span className="ns-stat2-sub">{note}</span>}
          </div>
        ))}
      </div>

      <RepairPrompt repair={repair} today={progress.today.date} onStart={startRepair} />

      {sky.start ? (
        <>
          <div className="ns-sky-tools">
            <p className="ns-sky-summary">{describeSky(sky)}</p>
            <button className="ns-pill-btn" aria-pressed={asList} onClick={() => setAsList((v) => !v)}>
              <Icon name={asList ? "northStar" : "checklist"} size={16} /> {asList ? "View as sky" : "View as list"}
            </button>
          </div>
          {asList ? (
            <SkyList sky={sky} />
          ) : (
            <>
              <div className="ns-sky-panel ns-sky-full">
                <SkyField sky={sky} limit={showAll ? Infinity : FIRST_PAGE} />
              </div>
              {total > FIRST_PAGE && !showAll && (
                <button className="ns-pill-btn" style={{ alignSelf: "center" }} onClick={() => setShowAll(true)}>
                  Show {total - FIRST_PAGE} earlier constellation{total - FIRST_PAGE === 1 ? "" : "s"}
                </button>
              )}
              <SkyLegend />
            </>
          )}
        </>
      ) : (
        <div className="ns-sky-panel ns-sky-full">
          <div className="ns-sky-empty">
            <Icon name="northStar" size={40} />
            <b>Your sky is waiting for its first star</b>
            <p>Answer one question and today lights up. Come back tomorrow for the next star, and seven of them make your first constellation.</p>
            <button className="ns-btn ns-btn-primary" onClick={practice}>
              Light the first star
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
