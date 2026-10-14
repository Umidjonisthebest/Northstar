import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminStudents } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { Avatar, Kpi, Empty, accClass, scoreClass, timeAgo } from "../../components/adminUi.jsx";
import { studioPath } from "../../studio/panels.js";
import { useStudio } from "../../studio/useStudio.js";

const COLS = [
  ["name", "Student"],
  ["level", "Level"],
  ["xp", "XP"],
  ["streak", "Streak"],
  ["practiceAccuracy", "Practice accuracy"],
  ["mockAvgScaled", "Mock avg"],
  ["lastActive", "Last active"]
];

function toCsv(rows) {
  const head = ["Name", "Email", "Candidate ID", "Level", "XP", "Streak", "Practice answered", "Practice accuracy %", "Mock modules", "Mock avg (est.)", "Last active"];
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((s) =>
    [s.name, s.email, s.candidateId, s.level, s.xp, s.streak, s.practiceAnswered, s.practiceAccuracy === null ? "" : Math.round(s.practiceAccuracy * 100), s.mockModules, s.mockAvgScaled ?? "", s.lastActive ?? ""]
      .map(cell)
      .join(",")
  );
  return "﻿" + [head.join(","), ...body].join("\n");
}

export default function StudentsList() {
  const { token } = useAdminAuth();
  // The admin has every account; a teacher has the students of the classes (the server's rule).
  const { isAdmin } = useStudio();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [list, setList] = useState(null);
  const [classes, setClasses] = useState([]); // every class there is, for the class filter
  const [sort, setSort] = useState(["xp", -1]);
  const [filter, setFilter] = useState("all");
  const [klass, setKlass] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    setQ(params.get("q") || "");
  }, [params]);

  useEffect(() => {
    const t = setTimeout(
      () =>
        adminStudents(token, q).then((d) => {
          setList(d.students);
          setClasses(d.classes || []);
        }),
      150
    );
    return () => clearTimeout(t);
  }, [token, q]);

  const rows = useMemo(() => {
    let r = [...(list || [])];
    const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (filter === "active") r = r.filter((s) => s.lastActive && s.lastActive >= week);
    if (filter === "inactive") r = r.filter((s) => !s.lastActive || s.lastActive < week);
    if (filter === "struggling") r = r.filter((s) => (s.practiceAccuracy !== null && s.practiceAccuracy < 0.5) || (s.mockAvgScaled !== null && s.mockAvgScaled < 450));
    // By class: a class's id, or "none" for students who aren't in one.
    if (klass === "none") r = r.filter((s) => !s.classroom);
    else if (klass) r = r.filter((s) => s.classroom?.id === klass);
    const [k, dir] = sort;
    r.sort((a, b) => {
      const av = a[k] ?? (typeof b[k] === "string" ? "" : -1);
      const bv = b[k] ?? (typeof a[k] === "string" ? "" : -1);
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
    return r;
  }, [list, sort, filter, klass]);

  const all = list || [];
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const active = all.filter((s) => s.lastActive && s.lastActive >= week).length;
  const accs = all.filter((s) => s.practiceAccuracy !== null);
  const avgAcc = accs.length ? Math.round((accs.reduce((t, s) => t + s.practiceAccuracy, 0) / accs.length) * 100) : null;

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "students.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">People</span>
          <h1>Students</h1>
          <p>{isAdmin ? "Everyone with a student account — click a row to open their full profile." : "The students who are in a class — click a row to open their full profile."}</p>
        </div>
        <div className="ad-actions">
          <button className="btn btn-secondary" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="download" size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="ad-grid-4">
        <Kpi icon="users" tone="violet" label="Total students" value={all.length} sub={isAdmin ? "with an account" : classes.length === 1 ? "in 1 class" : `in ${classes.length} classes`} />
        <Kpi icon="flame" tone="amber" label="Active this week" value={active} sub={all.length ? `${Math.round((active / all.length) * 100)}% of the class` : "—"} />
        <Kpi icon="target" tone="green" label="Avg practice accuracy" value={avgAcc === null ? "—" : `${avgAcc}%`} sub={`${accs.length} students practising`} />
        <Kpi icon="warning" tone="rose" label="Need attention" value={all.filter((s) => (s.practiceAccuracy !== null && s.practiceAccuracy < 0.5) || (s.mockAvgScaled !== null && s.mockAvgScaled < 450)).length} sub="accuracy < 50% or mock < 450" />
      </div>

      <div className="ad-filters">
        <input
          className="ad-input"
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Search by name, email or candidate ID…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
          }}
        />
        <select className="ad-input" value={klass} onChange={(e) => setKlass(e.target.value)} aria-label="Class">
          <option value="">Every class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {isAdmin && <option value="none">Not in a class</option>}
        </select>
        <div className="ad-seg">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["struggling", "Need attention"]
          ].map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {list === null ? (
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="ad-card">
          <Empty icon="users">No students match.</Empty>
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                {COLS.map(([k, l]) => (
                  <th key={k} className={sort[0] === k ? "ad-th-sort sorted" : "ad-th-sort"} onClick={() => setSort(([sk, d]) => [k, sk === k ? -d : k === "name" ? 1 : -1])}>
                    {l} {sort[0] === k ? (sort[1] > 0 ? "↑" : "↓") : ""}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => nav(studioPath(`/students/${s.id}`))}>
                  <td>
                    <div className="ad-person">
                      <Avatar name={s.name} avatar={s.avatar} />
                      <div>
                        <b>{s.name}</b>
                        <span>
                          {s.email} · ID {s.candidateId}
                          {s.classroom ? ` · ${s.classroom.name}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="ad-chip lvl">Lv {s.level}</span>
                  </td>
                  <td>
                    <b>{s.xp.toLocaleString()}</b>
                  </td>
                  <td>{s.streak > 0 ? <span className="ad-chip fire"><Icon name="northStar" size={12} /> {s.streak}d</span> : <span className="ad-muted">—</span>}</td>
                  <td style={{ minWidth: 150 }}>
                    {s.practiceAccuracy === null ? (
                      <span className="ad-muted">Not started</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="ad-bar" style={{ flex: 1 }}>
                          <i className={accClass(s.practiceAccuracy)} style={{ width: `${Math.round(s.practiceAccuracy * 100)}%` }} />
                        </div>
                        <b style={{ fontSize: 13 }}>{Math.round(s.practiceAccuracy * 100)}%</b>
                      </div>
                    )}
                  </td>
                  <td>{s.mockAvgScaled === null ? <span className="ad-muted">—</span> : <span className={`ad-score ${scoreClass(s.mockAvgScaled)}`}>{s.mockAvgScaled}</span>}</td>
                  <td className="ad-muted">{timeAgo(s.lastActive)}</td>
                  <td>
                    <Icon name="arrowRight" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
