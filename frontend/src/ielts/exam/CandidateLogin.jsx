import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BookOpen, Headphones, SquarePen, Timer } from "lucide-react";
import { candidateLogin, candidateToken, startCandidateSession } from "../api.js";
import { Button } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { IELTS_EXAM } from "../paths.js";

const FEATURES = [
  { icon: BookOpen, title: "Academic & General Reading", text: "Passage-based tasks that mirror real IELTS reading sections." },
  { icon: Headphones, title: "Realistic Listening Audio", text: "Simulated audio tracks with clear instructions and sections." },
  { icon: SquarePen, title: "Writing exam simulation", text: "Develop your Writing skills with exam-style writing tasks." },
  { icon: Timer, title: "Exam-style timing", text: "Built-in timers that follow official IELTS timing rules." }
];

export default function CandidateLogin() {
  const navigate = useNavigate();
  const toast = useToast();
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);

  if (candidateToken()) return <Navigate to={IELTS_EXAM} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!id.trim()) return;
    setBusy(true);
    try {
      startCandidateSession(await candidateLogin(id.trim()));
      navigate(IELTS_EXAM);
    } catch (err) {
      toast.error("Login failed", err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ie-landing">
      <div className="ie-landing__inner">
        <section>
          <span className="ie-landing__pill">IELTS-style mock exam platform</span>
          <h1>
            Step into your <em>IELTS</em> exam room.
          </h1>
          <p className="ie-landing__lead">Practice in a realistic exam environment with timed sections, authentic-style tasks, and detailed feedback on your performance.</p>
          <div className="ie-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="ie-feature" key={title}>
                <span className="ie-feature__icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>
        <form className="ie-login-card" onSubmit={submit}>
          <span className="ie-login-card__pill">Candidate login</span>
          <h2>Log in to your mock exam</h2>
          <p className="ie-login-card__sub">Enter your candidate ID to access your mock exam session.</p>
          <label className="ie-label" htmlFor="candidate-id">
            Candidate ID
          </label>
          <input
            id="candidate-id"
            className="ie-input ie-login-card__input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="E.g. 12345678"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 12))}
            autoFocus
          />
          <Button type="submit" block size="lg" loading={busy} disabled={!id.trim()} style={{ marginTop: 22 }}>
            Continue to exam
          </Button>
        </form>
      </div>
    </div>
  );
}
