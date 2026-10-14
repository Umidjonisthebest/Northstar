import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminPath } from "../paths.js";
import { Activity, ArrowLeft, CircleCheck, Clock3, Target, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getUserDashboard } from "../api.js";
import { Button, PageLoader, Pill } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { formatBand, formatDateTime, formatShortDate, fullName } from "../lib/format.js";
import { BAR_COLORS, SECTION_COLORS, SECTION_META } from "./sectionMeta.js";
import { panelHas, currentPanel, studioPath } from "../../studio/panels.js";

const SECTIONS = ["reading", "listening", "writing"];
const ACTIVITY_TINT = { reading: "var(--ie-skill-reading-soft)", listening: "var(--ie-skill-listening-soft)", writing: "var(--ie-skill-writing-soft)" };
const ACTIVITY_COLOR = { reading: "var(--ie-skill-reading-ink)", listening: "var(--ie-skill-listening-ink)", writing: "var(--ie-skill-writing-ink)" };
const STATUS_TONE = { created: "blue", started: "green", completed: "gray" };

function Kpi({ label, value, sub, icon: Icon }) {
  return (
    <div className="ie-card ie-kpi">
      <div className="ie-kpi__label">
        {label}
        <Icon />
      </div>
      <div className="ie-kpi__value">{value}</div>
      <div className="ie-kpi__sub">{sub}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="ie-card ie-chart-card">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <div style={{ height: 280 }}>{empty ? <div className="ie-empty">No data yet</div> : children}</div>
    </div>
  );
}

export default function UserDashboardPage() {
  const { id } = useParams();
  // The admin comes here from the IELTS users list; a teacher (who has no such list) from the
  // student's profile.
  const back = panelHas(currentPanel(), "ielts-users") ? adminPath("users") : studioPath(`/students/${id}`);
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    getUserDashboard(id)
      .then(setData)
      .catch((err) => {
        toast.error("Could not load dashboard", err.message);
        navigate(back, { replace: true });
      });
  }, [id, navigate, toast, back]);

  if (!data) return <PageLoader label="Loading dashboard..." />;
  const { user, kpis } = data;
  const hours = Math.floor(kpis.totalMinutes / 60);
  const pieData = data.completionRate.filter((d) => d.value > 0);

  return (
    <div className="ie-dash-page">
      <div className="ie-dash-top">
        <Button variant="outline" icon={ArrowLeft} onClick={() => navigate(back)}>
          Back
        </Button>
        <div className="ie-card ie-dash-hello">
          <h1>Welcome back, {fullName(user)}!</h1>
          <p>
            {user.email || user.phone || "No contact details"}
            {user.candidateId && ` · Candidate ID ${user.candidateId}`}
            {user.role === "student" && (
              <>
                {" · "}
                <Link to={studioPath(`/students/${user.id}`)} className="ie-link">
                  Northstar profile
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="ie-dash-grid ie-dash-grid--3">
        <Kpi label="Total Sessions" icon={Target} value={kpis.totalSessions} sub={`${kpis.activeSessions} active`} />
        <Kpi label="Average Score" icon={TrendingUp} value={formatBand(kpis.averageScore ?? 0)} sub={`Best: ${formatBand(kpis.bestScore ?? 0)}`} />
        <Kpi label="Total Time" icon={Clock3} value={`${hours}h ${kpis.totalMinutes % 60}m`} sub={`${kpis.attempts} attempts`} />
      </div>

      <div className="ie-dash-grid ie-dash-grid--2" style={{ marginTop: 16 }}>
        <ChartCard title="Score Over Time" subtitle="Band scores across sections for each mock" empty={!data.scoreOverTime.length}>
          <ResponsiveContainer>
            <LineChart data={data.scoreOverTime.map((d) => ({ ...d, label: formatShortDate(d.date) }))} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 9]} ticks={[0, 3, 4.5, 6, 7.5, 9]} />
              <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.session || l} formatter={(v) => (v == null ? "–" : Number(v).toFixed(1))} />
              <Legend />
              {SECTIONS.map((s) => (
                <Line key={s} type="monotone" dataKey={s} name={SECTION_META[s].label} stroke={SECTION_COLORS[s]} strokeWidth={2} connectNulls dot />
              ))}
              <Line type="monotone" dataKey="overall" name="Overall" stroke={SECTION_COLORS.overall} strokeWidth={2} connectNulls dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Section Comparison" subtitle="Average vs best band by section" empty={!data.scoreOverTime.length}>
          <ResponsiveContainer>
            <BarChart data={data.sectionComparison} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="section" />
              <YAxis domain={[0, 9]} />
              <Tooltip formatter={(v) => Number(v).toFixed(1)} />
              <Legend />
              <Bar dataKey="average" name="Average Score" fill={BAR_COLORS.average} radius={[4, 4, 0, 0]} />
              <Bar dataKey="best" name="Best Score" fill={BAR_COLORS.best} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Completion Rate" subtitle="Completed attempts by section" empty={!pieData.length}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="section" outerRadius={95} label={({ section, value }) => `${section}: ${value}`}>
                {pieData.map((d) => (
                  <Cell key={d.section} fill={SECTION_COLORS[d.section.toLowerCase()]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n, p) => [`${v} of ${p.payload.assigned} parts`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Activity" subtitle="Attempts per month by section (last 6 months)">
          <ResponsiveContainer>
            <AreaChart data={data.monthlyActivity} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {SECTIONS.map((s) => (
                <Area key={s} type="monotone" dataKey={s} name={SECTION_META[s].label} stackId="1" stroke={SECTION_COLORS[s]} fill={SECTION_COLORS[s]} fillOpacity={0.55} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <h2 className="ie-dash-section-title">Performance Metrics</h2>
      <div className="ie-dash-grid ie-dash-grid--3">
        {SECTIONS.map((s) => {
          const p = data.performance[s];
          const Icon = SECTION_META[s].icon;
          return (
            <div className="ie-card ie-metric-card" key={s}>
              <h4>
                <Icon />
                {SECTION_META[s].label}
              </h4>
              <div className="ie-metric-row">
                <span>Attempts:</span>
                <strong>
                  {p.attempts}/{p.assigned}
                </strong>
              </div>
              <div className="ie-metric-row">
                <span>Average:</span>
                <strong>{p.average == null ? "N/A" : formatBand(p.average)}</strong>
              </div>
              <div className="ie-metric-row">
                <span>Best:</span>
                <strong>{p.best == null ? "N/A" : formatBand(p.best)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="ie-dash-section-title">Your Sessions</h2>
      {data.sessions.length === 0 ? (
        <div className="ie-card ie-empty">This student has not been added to any session yet.</div>
      ) : (
        <div className="ie-dash-grid ie-dash-grid--2">
          {data.sessions.map((s) => (
            <div className="ie-card ie-session-mini" key={s.id}>
              <div className="ie-row">
                <strong style={{ fontSize: 16 }}>{s.name}</strong>
                <span className="ie-spacer" />
                <Pill tone={STATUS_TONE[s.status]} round icon={s.status === "started" ? Activity : undefined}>
                  {s.status === "started" ? "Active" : s.status[0].toUpperCase() + s.status.slice(1)}
                </Pill>
              </div>
              <div className="ie-muted" style={{ fontSize: 13 }}>
                {formatShortDate(s.date)} {s.time}
              </div>
              <div className="ie-session-mini__cols">
                {["reading", "listening", "writing", "speaking"].map((k) => {
                  const Icon = SECTION_META[k].icon;
                  return (
                    <div className="ie-session-mini__col" key={k}>
                      <small>
                        <Icon /> {SECTION_META[k].label}
                      </small>
                      <strong>
                        {s.completed[k] && <CircleCheck size={13} color="var(--ie-green-600)" style={{ marginRight: 4 }} />}
                        {formatBand(s.bands[k])}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="ie-overall">
                <span>Overall Score:</span>
                <strong>{formatBand(s.overall)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="ie-dash-section-title">Recent Activity</h2>
      <div className="ie-card">
        {data.recent.length === 0 && <div className="ie-empty">No activity yet.</div>}
        {data.recent.map((a) => {
          const Icon = SECTION_META[a.section].icon;
          return (
            <div className="ie-activity" key={a.id}>
              <span className="ie-activity__icon" style={{ background: ACTIVITY_TINT[a.section], color: ACTIVITY_COLOR[a.section] }}>
                <Icon />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ie-activity__title">{a.title}</div>
                <div className="ie-activity__time">{formatDateTime(a.completedAt)}</div>
              </div>
              {a.section === "writing" ? (
                <Pill tone="outline" round>
                  {a.words ?? 0} words
                </Pill>
              ) : (
                <Pill tone="accent" round>
                  {a.correct}/{a.total}
                </Pill>
              )}
              <Pill tone="green" round icon={CircleCheck}>
                Completed
              </Pill>
            </div>
          );
        })}
      </div>
    </div>
  );
}
