// The two staff panels and what each one has. No React in this file: the IELTS module's
// paths.js reads it too.
//
// An admin runs the platform: the content every student gets, the accounts, the public site.
// A teacher runs the Presidential School classes. FEATURES sorts every screen into one panel or
// both, and the menu, the routes (App.jsx) and the page titles are all read from it. So moving a
// screen from one panel to the other is its `for` line here, plus the guard on its API routes
// (requireAdmin / requireStaff in backend/auth.js), which is what really keeps a teacher out.
//
// The menu is also sorted by exam, so nobody has to guess whether a screen is SAT or IELTS: a
// screen that belongs to one exam is in that exam's group (`exam`), under a heading in the exam's
// own colour, and says so again in the bar at the top of the page. Each exam has one "Practice
// tests" section: the tests students take alone, their results, and the mocks a teacher runs.

export const PANELS = {
  admin: { base: "/admin", name: "Admin panel", crumb: "Admin", who: "Administrator" },
  teacher: { base: "/teacher", name: "Teacher studio", crumb: "Studio", who: "Teacher" }
};

// One sign-in page for both. The account that signs in decides which panel opens (AuthContext).
export const STAFF_LOGIN = "/teacher/login";

export const EXAMS = { sat: { name: "SAT", full: "Digital SAT" }, ielts: { name: "IELTS", full: "IELTS" } };

const ADMIN = ["admin"];
const TEACHER = ["teacher"];
const BOTH = ["admin", "teacher"];

// `path` is under the panel's base. `badge` names a count the layout keeps (StudioLayout.jsx).
// `also` lists other addresses that are part of the same screen (its editors and detail pages),
// so the menu keeps the screen lit and the bar at the top names it while one of them is open.
export const FEATURES = [
  { key: "overview", group: "Insights", path: "/overview", label: "Overview", icon: "overview", for: BOTH },
  { key: "analytics", group: "Insights", path: "/analytics", label: "Analytics", icon: "chart", for: BOTH },
  { key: "leagues", group: "Insights", path: "/leagues", label: "Leagues", icon: "podium", for: ADMIN },

  { key: "students", group: "People", path: "/students", label: "Students", icon: "users", for: BOTH, also: ["/ielts/users/"] },
  { key: "classes", group: "People", path: "/classes", label: "Classes", icon: "grid", for: BOTH, badge: "classes" },
  { key: "teachers", group: "People", path: "/teachers", label: "Teachers", icon: "key", for: ADMIN },

  { key: "sat-tests", exam: "sat", path: "/sat/tests", label: "Practice tests", icon: "mock", for: BOTH, also: ["/tests", "/sessions"] },
  { key: "practice", exam: "sat", path: "/practice", label: "Question bank", icon: "target", for: ADMIN },
  { key: "homework", exam: "sat", path: "/homework", label: "Homework", icon: "checklist", for: TEACHER },

  { key: "ielts-tests", exam: "ielts", path: "/ielts/tests", label: "Practice tests", icon: "mock", for: BOTH, also: ["/ielts/sessions", "/ielts/mock"] },
  { key: "ielts-practice", exam: "ielts", path: "/ielts/practice", label: "Section practice", icon: "layers", for: ADMIN },
  { key: "ielts-users", exam: "ielts", path: "/ielts/users", label: "Users", icon: "users", for: ADMIN },

  { key: "vocab", group: "Both exams", path: "/vocab", label: "Vocabulary", icon: "book", for: ADMIN },
  { key: "announcements", group: "Both exams", path: "/announcements", label: "Announcements", icon: "megaphone", for: BOTH },
  { key: "messages", group: "Both exams", path: "/messages", label: "Messages", icon: "chat", for: ADMIN, badge: "messages" },
  { key: "stories", group: "Both exams", path: "/stories", label: "Success stories", icon: "trophy", for: ADMIN }
];

export const panelHas = (panel, key) => FEATURES.some((f) => f.key === key && f.for.includes(panel));

const under = (rest, path) => rest === path || rest.startsWith(path.endsWith("/") ? path : `${path}/`);
// The screen an address belongs to: the feature whose own path, or one of its `also` paths,
// matches most closely. (A student's IELTS dashboard is at /ielts/users/:id and opens from
// Students; the list at /ielts/users is the admin's IELTS Users screen.)
function featureAt(panel, pathname) {
  const rest = pathname.slice(PANELS[panel].base.length);
  let hit = null;
  let depth = -1;
  for (const f of FEATURES) {
    if (!f.for.includes(panel)) continue;
    for (const p of [f.path, ...(f.also || [])]) {
      if (under(rest, p) && p.length > depth) {
        hit = f;
        depth = p.length;
      }
    }
  }
  return hit;
}

// The panel's menu: its features in their groups, in the order above. An exam's group carries the
// exam (`exam: "sat" | "ielts"`), which the layout draws as a coloured heading.
export function panelMenu(panel) {
  const groups = [];
  for (const f of FEATURES) {
    if (!f.for.includes(panel)) continue;
    const label = f.exam ? EXAMS[f.exam].name : f.group;
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, exam: f.exam || null, items: [] }));
    g.items.push({ ...f, to: PANELS[panel].base + f.path });
  }
  return groups;
}

// Which menu item is lit at `pathname` (its key), or null.
export const activeFeature = (panel, pathname) => featureAt(panel, pathname)?.key || null;

// The title of the screen at `pathname`, for the bar at the top: { exam?, title }.
export function screenTitle(panel, pathname) {
  const hit = featureAt(panel, pathname);
  if (!hit) return { title: PANELS[panel].name };
  return hit.exam ? { exam: hit.exam, title: hit.label } : { title: hit.label };
}

// A screen's panel is the first part of its address, so a page both panels show builds its links
// with studioPath("/students/…") and stays in the panel it was opened in.
export const currentPanel = () => (typeof window !== "undefined" && window.location.pathname.startsWith(PANELS.teacher.base + "/") ? "teacher" : "admin");
export const studioPath = (sub = "") => PANELS[currentPanel()].base + sub;

// Where the lists that used to be menu items of their own live now: tabs of an exam's Practice
// tests section. Their old addresses still work (App.jsx redirects them here).
export const SAT_TESTS = "/sat/tests";
export const SAT_MOCKS = "/sat/tests?tab=mocks";
export const SAT_SESSIONS = "/sat/tests?tab=mocks&view=sessions";
export const IELTS_TESTS = "/ielts/tests";
export const IELTS_SESSIONS = "/ielts/tests?tab=mocks";
