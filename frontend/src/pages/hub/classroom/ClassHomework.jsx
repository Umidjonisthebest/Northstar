import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getClassHomework } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import Icon from "../../../components/Icon.jsx";
import LoadFailed from "../../../components/LoadFailed.jsx";
import { EmptyArt } from "../../../components/Art.jsx";
import { Loading } from "../Home.jsx";
import { SECTION_KEY, SECTION_SHORT, playerUrl } from "../hubUtils.js";
import { classUrl, dueLine, plural } from "./classUtils.js";

// The Homework tab of My Class: what the teachers have set for this class, and how far the
// student is. Nothing is handed in or ticked: a homework finishes itself as its questions are
// answered (backend/homework.js).

function HomeworkCard({ hw }) {
  const due = dueLine(hw);
  const done = hw.state === "done";
  // "Continue" opens at the first question still to do.
  const url = playerUrl({ source: "homework", homework: hw.id, start: hw.next, from: classUrl("homework") });
  return (
    <li className={`ns-card2 cr-hw ${hw.state}`}>
      <div className="cr-hw-top">
        <span className="cr-hw-mark" role="img" aria-label={done ? "Finished" : "Not finished yet"}>
          {done ? <Icon name="check" size={18} strokeWidth={3} /> : <Icon name="checklist" size={20} />}
        </span>
        <div className="cr-hw-title">
          <h3>{hw.title}</h3>
          <p className={`cr-hw-due ${due.tone}`}>
            <Icon name="clock" size={15} /> {due.text}
          </p>
        </div>
        <Link to={url} className={`ns-btn ns-btn-sm ${done ? "ns-btn-outline" : "ns-btn-primary"}`}>
          {done ? "Go over it again" : hw.done ? "Continue" : "Start"} <Icon name="chevronRight" size={15} />
        </Link>
      </div>
      {hw.note && <p className="cr-hw-note">{hw.note}</p>}
      <div className="cr-hw-tags">
        {hw.sections.map((s) => (
          <span key={s} className={`ns-tag2 ${SECTION_KEY[s]}`}>
            {SECTION_SHORT[s]}
          </span>
        ))}
        <span className="cr-hw-skills">
          {hw.skills.join(", ")}
          {hw.moreSkills > 0 && ` and ${plural(hw.moreSkills, "more skill")}`}
        </span>
      </div>
      <div className="cr-hw-progress">
        <div className="ns-progress thin" role="progressbar" aria-valuemin={0} aria-valuemax={hw.total} aria-valuenow={hw.done} aria-label="Questions done">
          <div className={done ? "good" : ""} style={{ width: `${(hw.done / hw.total) * 100}%` }} />
        </div>
        <span>
          {done ? (
            <>
              <b>
                {hw.correct} of {hw.total}
              </b>{" "}
              right at the first try
            </>
          ) : (
            <>
              <b>
                {hw.done} of {hw.total}
              </b>{" "}
              done{hw.done > 0 && ` · ${hw.correct} right at the first try`}
            </>
          )}
        </span>
        <span className="cr-hw-class">
          <Icon name="users" size={15} /> {hw.class.finished} of {plural(hw.class.students, "classmate")} finished
        </span>
      </div>
    </li>
  );
}

export default function ClassHomework({ classroom }) {
  const { token } = useStudentAuth();
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    getClassHomework(token)
      .then((d) => {
        setList(d.homework);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  if (!list) return failed ? <LoadFailed title="Couldn't load your homework" onRetry={load} /> : <Loading />;

  const todo = list.filter((h) => h.state !== "done");
  const finished = list.filter((h) => h.state === "done");

  if (list.length === 0)
    return (
      <div className="ns-empty2" style={{ padding: 36 }}>
        <EmptyArt name="note" />
        <b>No homework right now</b>
        When a teacher sets homework for {classroom.name}, it shows up here with its due date.
      </div>
    );

  return (
    <>
      <section aria-labelledby="cr-hw-todo">
        <div className="ns-section-head">
          <h2 id="cr-hw-todo">
            <Icon name="checklist" size={22} /> To do
          </h2>
        </div>
        {todo.length === 0 ? (
          <p className="cr-cheered" role="status">
            <Icon name="check" size={20} strokeWidth={2.8} /> All done. Nothing is waiting for you.
          </p>
        ) : (
          <ul className="cr-hw-list">
            {todo.map((hw) => (
              <HomeworkCard key={hw.id} hw={hw} />
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section aria-labelledby="cr-hw-done">
          <div className="ns-section-head">
            <h2 id="cr-hw-done">
              <Icon name="check" size={22} /> Finished
            </h2>
          </div>
          <ul className="cr-hw-list">
            {finished.map((hw) => (
              <HomeworkCard key={hw.id} hw={hw} />
            ))}
          </ul>
        </section>
      )}

      <p className="cr-fine">
        There is nothing to hand in. A question is done once you answer it after the homework was set, and it counts as right when your first answer is right without opening the explanation first. Your teacher sees your result; classmates only see how many have
        finished.
      </p>
    </>
  );
}
