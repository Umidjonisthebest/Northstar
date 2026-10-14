import React from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { studioPath } from "../../studio/panels.js";

// Which classes something goes to: all of them, or the ones ticked. Used by announcements and
// homework. The classes are the ones teachers have made (the Classes page); students outside a
// class get neither.
//
//   value     "all" or a list of class ids
//   onChange  (value) => void
//   classes   every class there is, in the server's order: [{ id, name, students? }]; null while
//             they are loading

// "All classes", "7A", "7A and 8B", "7A, 8B and 2 more". `ids` is a list of class ids; none (or
// every class there is) means all of them. `classes` gives the ids their names.
export function classesLabel(ids, classes) {
  if (!Array.isArray(ids) || ids.length === 0) return "All classes";
  const names = ids.map((id) => (classes || []).find((c) => c.id === id)?.name).filter(Boolean);
  if (classes && classes.length > 1 && names.length === classes.length) return "All classes";
  if (names.length === 0) return ids.length === 1 ? "1 class" : `${ids.length} classes`;
  if (names.length === 1) return names[0];
  if (names.length > 3) return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// The same inside a sentence, from a picker's value: "all classes", "7A", "7A and 8B".
export function classesPhrase(value, classes) {
  const label = classesLabel(value === "all" ? [] : value, classes);
  return label === "All classes" ? "all classes" : label;
}

export default function ClassPicker({ value, onChange, classes }) {
  const all = value === "all";
  const picked = all ? [] : value;
  // Kept in the classes' own order, whatever order they were ticked in.
  const toggle = (id) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    onChange((classes || []).filter((c) => next.includes(c.id)).map((c) => c.id));
  };
  if (classes && classes.length === 0)
    return (
      <p className="ad-small ad-muted" style={{ margin: 0 }}>
        There are no classes yet. <Link to={studioPath("/classes")}>Make a class</Link> first, then give its code to your students.
      </p>
    );
  return (
    <div className="ad-cls-pick">
      <div className="ad-seg" role="radiogroup" aria-label="Who is it for?">
        <button type="button" role="radio" aria-checked={all} className={all ? "on" : ""} onClick={() => onChange("all")}>
          All classes
        </button>
        <button type="button" role="radio" aria-checked={!all} className={all ? "" : "on"} onClick={() => all && onChange([])}>
          Choose classes
        </button>
      </div>
      {!all && (
        <div className="ad-cls-grades" role="group" aria-label="Classes">
          {(classes || []).map((c) => (
            <button key={c.id} type="button" aria-pressed={picked.includes(c.id)} aria-label={c.students === undefined ? c.name : `${c.name}, ${c.students} student${c.students === 1 ? "" : "s"}`} className={picked.includes(c.id) ? "on" : ""} onClick={() => toggle(c.id)}>
              {picked.includes(c.id) && <Icon name="check" size={13} strokeWidth={3} />}
              <b>{c.name}</b>
              {c.students !== undefined && <small>{c.students}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
