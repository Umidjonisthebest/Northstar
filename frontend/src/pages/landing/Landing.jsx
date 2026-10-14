import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { publicOverview } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Logo from "../../components/Brand.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import Nova3D from "../../components/nova/Nova3D.jsx";
import Spot from "../../components/Spot.jsx";
import StoryCard from "../../components/StoryCard.jsx";
import HeroDemo from "./HeroDemo.jsx";
import NovaDemo from "./NovaDemo.jsx";
import Insights from "./Insights.jsx";
import { CountUp } from "./bits.jsx";
import { revealInView, useDemoLogin, useReveal } from "./hooks.js";
import "../../landing.css";
import "../../cover.css";

/*
 * The public cover page. New sections use the "cv-" prefix (cover.css); the three live demos
 * (HeroDemo, NovaDemo, Insights) keep their own styles from landing.css. Always light, except the
 * hero, which is a night sky drawn in CSS and SVG.
 *
 * Order: floating nav, hero (night sky, 3D Nova), how it works (4 steps), a live question,
 * Nova, an example week of the plan, an example of the analytics, the two exams, real success
 * stories (only when a teacher has published some), questions and answers, footer with Nova's
 * friends. Nothing here is a made-up number or testimonial: counts come from /api/public/overview.
 *
 * The 3D Nova is only in the hero. Below it, in other views, the 2D Nova and her friends appear.
 */

// 2026–27 SAT dates (College Board), for the countdown in the hero.
const SAT_DATES = [
  ["2026-10-03T08:00:00+05:00", "October 3"],
  ["2026-11-07T08:00:00+05:00", "November 7"],
  ["2026-12-05T08:00:00+05:00", "December 5"],
  ["2027-03-06T08:00:00+05:00", "March 6"],
  ["2027-05-01T08:00:00+05:00", "May 1"],
  ["2027-06-05T08:00:00+05:00", "June 5"]
];
const FALLBACK = { questions: 186, rw: 60, math: 126, skills: 29, vocab: 105, badges: 27, ielts: { listening: 6, reading: 4, writing: 4 } };

const PINK = ["#ffd9ec", "#f28ac4"];
const LILAC = ["#e3dbff", "#a48bf5"];
const BLUE = ["#d6e6ff", "#7fa8ff"];
const PEACH = ["#ffe6cf", "#ffb37a"];

const STEPS = [
  { spot: "telescope", c: PINK, blob: "a", title: "Find your level", text: "A 20-minute diagnostic of questions you haven't seen shows where you stand, skill by skill." },
  { spot: "rocket", c: LILAC, blob: "b", title: "Practise what matters", text: "Short sets on the skills worth the most points for you, each with a step-by-step explanation." },
  { spot: "chat", c: BLUE, blob: "c", title: "Fix your misses", text: "Every miss is saved. Nova gives a hint first, and you clear it by getting it right." },
  { spot: "hourglass", c: PEACH, blob: "a", title: "Sit a timed mock", text: "Full-length modules from your teacher, on the clock, scored the moment you hand in." }
];

// An example week, to show what the plan looks like. It is not anyone's real plan.
const WEEK = [
  ["Mon", "Words in Context", "10 questions", "rw"],
  ["Tue", "Linear functions", "10 questions", "math"],
  ["Wed", "Saved & Mistakes", "Review 6", "fix"],
  ["Thu", "Transitions", "10 questions", "rw"],
  ["Fri", "Percentages", "12 questions", "math"],
  ["Sat", "Full-length module", "35 minutes", "mock"],
  ["Sun", "Rest", "", "rest"]
];

const FAQ = [
  ["Is Northstar free?", "Yes, for students. You create an account and start practising. Your teacher can see your progress and runs the timed mock exams."],
  ["Will Nova just give me the answers?", "No. Nova starts with a hint and points to the evidence. You only get the answer if you ask a second time, and then that question counts as assisted."],
  ["Does it predict my score?", "No. You get an estimate from your latest diagnostic or mock, and a study plan built from your weak skills. The plan is a plan, not a prediction."],
  ["Where do the questions come from?", "They are written for Northstar in the format of the digital SAT and the computer-delivered IELTS. They are not official College Board or IELTS questions."],
  ["Which exams does it cover?", "The digital SAT (Reading and Writing, and Math) and IELTS Listening, Reading and Writing. One account covers both."],
  ["Does it work on a phone?", "Yes. Practice, the plan, Nova and your sky all work on a phone. For a full-length mock, a laptop is closer to the real test."]
];

function useNextSat() {
  const [now] = useState(() => Date.now());
  const next = SAT_DATES.find(([iso]) => new Date(iso).getTime() > now);
  if (!next) return null;
  return { label: next[1], days: Math.floor((new Date(next[0]).getTime() - now) / 86400000) };
}

// The hero's stars: fixed places, so the sky is the same on every visit.
function HeroStars() {
  const { dots, sparks } = useMemo(() => {
    let seed = 41;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return {
      // Mostly fine dust; every fourth star is bright enough to twinkle.
      dots: Array.from({ length: 260 }, (_, n) => [rnd() * 100, rnd() * 100, n % 4 === 0 ? 1.1 + rnd() * 1.5 : 0.4 + rnd() * 0.6, 0.25 + rnd() * 0.7]),
      // Four-point stars, kept to the edges so they don't sit behind the headline.
      sparks: Array.from({ length: 16 }, () => [rnd() * 100, rnd() * 100, 0.5 + rnd() * 0.8, rnd() > 0.5 ? "#fff3c9" : "#dcd5ff"]).map(([x, y, r, c]) => [x < 52 && y > 16 && y < 74 ? x + 48 : x, y, r, c])
    };
  }, []);
  const spark = (x, y, r) => `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;
  return (
    <svg className="cv-stars" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse className="cv-milky" cx="52" cy="46" rx="62" ry="9" transform="rotate(-18 52 46)" />
      {dots.map(([x, y, r, o], i) => (
        <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r={(r * 0.11).toFixed(3)} fill="#fff" opacity={o.toFixed(2)} className={i % 7 === 0 ? "cv-blink" : undefined} style={i % 7 === 0 ? { animationDelay: `${-(i % 5)}s` } : undefined} />
      ))}
      {sparks.map(([x, y, r, fill], i) => (
        <path key={i} d={spark(Number(x.toFixed(2)), Number(y.toFixed(2)), Number(r.toFixed(2)))} fill={fill} className="cv-blink" style={{ animationDelay: `${-(i % 6) * 0.7}s` }} />
      ))}
    </svg>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { token } = useStudentAuth();
  const demo = useDemoLogin();
  const nextSat = useNextSat();
  const [scrolled, setScrolled] = useState(false);
  const [data, setData] = useState(null);
  const stats = data?.stats || FALLBACK;
  const stories = data?.stories || [];
  useReveal([data]);

  // A signed-in student goes straight to their dashboard.
  useEffect(() => {
    if (token) nav("/dashboard", { replace: true });
  }, [token, nav]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    publicOverview()
      .then(setData)
      .catch(() => setData({ stats: null, stories: [] }));
  }, []);

  // Links like /#stories land on their section once the page has its data.
  useEffect(() => {
    if (!data || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "instant", block: "start" });
    revealInView();
  }, [data]);

  const ieltsParts = stats.ielts.listening + stats.ielts.reading + stats.ielts.writing;

  return (
    <div className="ln cv">
      <header className={`cv-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="cv-nav-in">
          <Logo to="/" size={34} />
          <nav className="cv-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#nova">Nova</a>
            <a href="#plan">Your plan</a>
            <a href="#exams">SAT &amp; IELTS</a>
            <a href="#faq">Questions</a>
          </nav>
          <div className="cv-nav-cta">
            <Link to="/login" className="cv-btn ghost sm">
              Log in
            </Link>
            <Link to="/signup" className="cv-btn ink sm">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero: night sky, 3D Nova ---------- */}
        <section className="cv-hero">
          <div className="cv-hero-sky" aria-hidden="true">
            <HeroStars />
            <i className="cv-glow g1" />
            <i className="cv-glow g2" />
            <i className="cv-horizon" />
          </div>
          <div className="cv-hero-in">
            <div className="cv-hero-copy">
              {nextSat && (
                <p className="cv-kicker">
                  <span className="cv-live" /> Next SAT: {nextSat.label} · <b>{nextSat.days} days</b> to go
                </p>
              )}
              <h1>
                Find your <span>north star.</span> <br />
                Then follow it to test day.
              </h1>
              <p className="cv-lede">Practice for the digital SAT and IELTS that shows you the next skill to work on, explains every miss, and has a tutor who gives hints instead of answers.</p>
              <div className="cv-cta-row">
                {/* The one coral thing in this view: the next step. */}
                <Link to="/signup" className="cv-btn next lg">
                  Start free <Icon name="arrowRight" size={18} />
                </Link>
                <button type="button" className="cv-btn glass lg" onClick={demo.run} disabled={demo.busy}>
                  {demo.busy ? "Opening the demo…" : "Try the demo"}
                </button>
              </div>
              {demo.error && (
                <p className="cv-note" role="alert">
                  {demo.error}
                </p>
              )}
              <p className="cv-teacher">
                Teaching a class? <Link to="/teacher/login">Open the teacher studio</Link>
              </p>
            </div>

            <div className="cv-hero-art" aria-hidden="true">
              <i className="cv-orbit o1" />
              <i className="cv-orbit o2" />
              <Nova3D size={380} className="cv-nova" />
              {/* Floating tiles: what's inside, as little solid objects around Nova. */}
              <span className="cv-tile t1">
                <Icon name="bank" size={26} />
              </span>
              <span className="cv-tile t2">
                <Icon name="calendar" size={26} />
              </span>
              <span className="cv-tile t3">
                <Icon name="chart" size={26} />
              </span>
              <span className="cv-tile t4">
                <Icon name="constellation" size={26} />
              </span>
            </div>
          </div>

          <dl className="cv-facts">
            <div>
              <dt>
                <CountUp to={stats.questions} />
              </dt>
              <dd>practice questions</dd>
            </div>
            <div>
              <dt>
                <CountUp to={stats.skills} />
              </dt>
              <dd>SAT skills, each with a lesson</dd>
            </div>
            <div>
              <dt>
                <CountUp to={ieltsParts} />
              </dt>
              <dd>IELTS mock sections</dd>
            </div>
            <div>
              <dt>
                <CountUp to={stats.vocab} />
              </dt>
              <dd>vocabulary flashcards</dd>
            </div>
          </dl>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="cv-section" id="how">
          <div className="cv-wrap">
            <div className="cv-head ln-reveal">
              <p className="cv-eyebrow">How it works</p>
              <h2>Four steps, repeated until test day</h2>
            </div>
            <ol className="cv-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="cv-step ln-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <Spot name={s.spot} accent={s.c[0]} pop={s.c[1]} blob={s.blob} size={170} />
                  <span className="cv-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- A live question ---------- */}
        <section className="cv-section tint" id="try">
          <div className="cv-wrap cv-split">
            <div className="cv-split-copy ln-reveal">
              <p className="cv-eyebrow">Try one</p>
              <h2>The practice looks like the test</h2>
              <p>One short passage or problem, four choices, a timer, and tools to cross out and highlight. When you check an answer you see why each choice is right or wrong.</p>
              <ul className="cv-ticks">
                <li>
                  <Icon name="check" size={18} strokeWidth={2.6} /> {stats.rw} Reading &amp; Writing and {stats.math} Math questions
                </li>
                <li>
                  <Icon name="check" size={18} strokeWidth={2.6} /> Remix a Math question into a new one with fresh numbers
                </li>
                <li>
                  <Icon name="check" size={18} strokeWidth={2.6} /> A strategy lesson for every skill
                </li>
              </ul>
            </div>
            <div className="cv-demo ln-reveal up">
              <HeroDemo />
            </div>
          </div>
        </section>

        {/* ---------- Nova ---------- */}
        <section className="cv-section" id="nova">
          <div className="cv-wrap">
            <div className="cv-head ln-reveal">
              <p className="cv-eyebrow">
                <Nova size={22} /> Meet Nova
              </p>
              <h2>A tutor who makes you think first</h2>
              <p>Ask about the question in front of you. Nova nudges, points to the evidence in the passage and walks through the steps. The answer comes only if you ask twice.</p>
            </div>
            <div className="ln-reveal up">
              <NovaDemo />
            </div>
          </div>
        </section>

        {/* ---------- The plan ---------- */}
        <section className="cv-section tint" id="plan">
          <div className="cv-wrap cv-split rev">
            <div className="cv-week ln-reveal up" aria-label="An example week of a study plan">
              <div className="cv-week-top">
                <b>This week</b>
                <span className="cv-tag">Example</span>
              </div>
              <ul>
                {WEEK.map(([day, what, how, kind]) => (
                  <li key={day} className={`k-${kind}`}>
                    <span className="cv-day">{day}</span>
                    <span className="cv-what">{what}</span>
                    <span className="cv-how">{how}</span>
                  </li>
                ))}
              </ul>
              <p className="cv-week-note">A study plan, not a score prediction. It changes when your answers do.</p>
            </div>
            <div className="cv-split-copy ln-reveal">
              <Spot name="calendar" accent={LILAC[0]} pop={LILAC[1]} blob="b" size={150} />
              <p className="cv-eyebrow">Your plan</p>
              <h2>A week that follows your answers</h2>
              <p>Set your test date and the plan counts back from it, giving most of the time to the skills where you lose the most questions. Miss a day and it carries over. Nothing is taken away.</p>
            </div>
          </div>
        </section>

        {/* ---------- Analytics ---------- */}
        <section className="cv-section" id="insights">
          <div className="cv-wrap">
            <div className="cv-head ln-reveal">
              <p className="cv-eyebrow">Your progress</p>
              <h2>See what is worth your next hour</h2>
              <p>Accuracy for every skill, how long each difficulty takes you, and which days you studied.</p>
            </div>
            <Insights />
          </div>
        </section>

        {/* ---------- The two exams ---------- */}
        <section className="cv-section tint" id="exams">
          <div className="cv-wrap">
            <div className="cv-head ln-reveal">
              <p className="cv-eyebrow">Two exams, one account</p>
              <h2>SAT and IELTS, side by side</h2>
            </div>
            <div className="cv-exams">
              <article className="cv-exam sat ln-reveal">
                <Spot name="book" accent="rgba(255,255,255,0.22)" pop="#ffd76a" blob="c" size={190} className="cv-exam-art" />
                <h3>Digital SAT</h3>
                <p>
                  {stats.questions} questions across {stats.skills} skills, timed modules from your teacher, and a skill map that shows what to work on next.
                </p>
                <Link to="/signup" className="cv-btn white">
                  Start SAT prep <Icon name="arrowRight" size={16} />
                </Link>
              </article>
              <article className="cv-exam ielts ln-reveal" style={{ transitionDelay: "90ms" }}>
                <Spot name="headphones" accent="rgba(255,255,255,0.22)" pop="#ffd76a" blob="a" size={190} className="cv-exam-art" />
                <h3>IELTS</h3>
                <p>
                  {ieltsParts} computer-delivered mock sections for Listening, Reading and Writing, plus section practice with a band estimate.
                </p>
                <Link to="/signup" className="cv-btn white">
                  Start IELTS prep <Icon name="arrowRight" size={16} />
                </Link>
              </article>
            </div>
          </div>
        </section>

        {stories.length > 0 && (
          <section className="cv-section" id="stories">
            <div className="cv-wrap">
              <div className="cv-head ln-reveal">
                <p className="cv-eyebrow">Students</p>
                <h2>Results our students agreed to share</h2>
              </div>
              <div className={`ln-stories ${stories.length < 3 ? "few" : ""}`}>
                {stories.map((s, i) => (
                  <div key={s.id} className="ln-reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                    <StoryCard story={s} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------- Questions ---------- */}
        <section className="cv-section" id="faq">
          <div className="cv-wrap cv-faq-wrap">
            <div className="cv-head left ln-reveal">
              <p className="cv-eyebrow">Questions</p>
              <h2>Good to know before you start</h2>
              <Spot name="planet" accent={BLUE[0]} pop={BLUE[1]} blob="b" size={200} />
            </div>
            <div className="cv-faq">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="ln-reveal" style={{ transitionDelay: `${i * 50}ms` }} open={i === 0}>
                  <summary>
                    <span className="cv-faq-n">{String(i + 1).padStart(2, "0")}</span>
                    {q}
                    <Icon name="chevronDown" size={18} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer: Nova's friends on the horizon ---------- */}
      <footer className="cv-footer">
        <div className="cv-wrap cv-last ln-reveal up">
          <h2>Your sky is waiting for its first star.</h2>
          <div className="cv-cta-row center">
            <Link to="/signup" className="cv-btn ink lg">
              Start free
            </Link>
            <Link to="/login" className="cv-btn ghost lg">
              Log in
            </Link>
          </div>
        </div>
        <div className="cv-friends" aria-hidden="true">
          <svg className="cv-hills" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0 150C180 80 330 70 520 120s330 80 520 30 280-60 400-20v90H0z" fill="#e3dbff" />
            <path d="M0 180c200-60 380-50 600-10s420 40 840-20v70H0z" fill="#cfc3fb" />
          </svg>
          <div className="cv-friend-row">
            <Nova size={84} tone="sky" />
            <Nova size={72} tone="rose" />
            <Nova size={104} mood="wave" />
            <Nova size={76} tone="gold" />
            <Nova size={84} tone="lilac" />
          </div>
        </div>
        <div className="cv-foot">
          <div className="cv-wrap cv-foot-grid">
            <div>
              <Logo to="/" size={38} />
              <p>Practice, timed mocks and a tutor who gives hints first, for the digital SAT and IELTS.</p>
            </div>
            <nav aria-label="Footer">
              <div>
                <h4>Students</h4>
                <Link to="/signup">Create an account</Link>
                <Link to="/login">Log in</Link>
                <Link to="/ielts">IELTS exam room</Link>
              </div>
              <div>
                <h4>Teachers</h4>
                <Link to="/teacher/login">Teacher studio</Link>
              </div>
              <div>
                <h4>On this page</h4>
                <a href="#how">How it works</a>
                <a href="#nova">Nova</a>
                <a href="#faq">Questions</a>
              </div>
            </nav>
          </div>
          <div className="cv-wrap cv-legal">
            <p>© {new Date().getFullYear()} Northstar.</p>
            <p>
              SAT is a trademark registered by the College Board, which is not affiliated with and does not endorse this product. IELTS is a registered trademark of the
              British Council, IDP IELTS and Cambridge University Press &amp; Assessment, which are not affiliated with this product.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
