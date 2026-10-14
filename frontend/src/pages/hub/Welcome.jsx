import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova3D from "../../components/nova/Nova3D.jsx";
import AvatarPicker from "../../components/avatar/AvatarPicker.jsx";
import Logo from "../../components/Brand.jsx";
import "../../diagnostic.css";

// First screens after sign-up (/welcome): the student chooses a profile picture (or skips), then
// picks their exam and goes straight to that exam's diagnostic test, or on to the dashboard.
// This view uses the 3D Nova and the 3D profile pictures only; no 2D Nova here.

export default function Welcome() {
  const { user } = useStudentAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(user?.avatar ? "exam" : "picture");

  useEffect(() => {
    const before = document.title;
    document.title = "Welcome · Northstar";
    return () => {
      document.title = before;
    };
  }, []);

  const pick = (exam) => {
    try {
      localStorage.setItem("ns_exam", exam);
    } catch {
      /* private mode */
    }
    nav(exam === "ielts" ? "/ielts-prep/diagnostic?welcome=1" : "/diagnostic?welcome=1");
  };

  if (step === "picture") {
    return (
      <main className="dg-welcome">
        <div className="dg-welcome-box wide">
          <Logo size={40} />
          <Nova3D size={120} float />
          <h1>Welcome, {user?.firstName || "friend"}!</h1>
          <p>First, choose a picture for your profile. You can change it any time.</p>
          <div className="dg-welcome-picker">
            <AvatarPicker saveLabel="Save and continue" onSaved={() => setStep("exam")} shopLink={false} />
          </div>
          <button className="dg-skip" onClick={() => setStep("exam")}>
            Skip, I'll choose later
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dg-welcome">
      <div className="dg-welcome-box">
        <Logo size={40} />
        <Nova3D size={132} float />
        <h1>{user?.avatar ? "Looking good" : "Welcome"}, {user?.firstName || "friend"}!</h1>
        <p>Which test are you preparing for? Start with a short diagnostic to find your level, and your practice will be built around it.</p>
        <div className="dg-exams">
          <button className="dg-exam sat" onClick={() => pick("sat")}>
            <span className="dg-exam-tag">SAT</span>
            <b>Digital SAT</b>
            <span>14 questions from Reading and Writing and Math in about 20 minutes. You get an estimated score out of 1600.</span>
            <span className="dg-exam-go">
              Find my starting score <Icon name="arrowRight" size={16} />
            </span>
          </button>
          <button className="dg-exam ielts" onClick={() => pick("ielts")}>
            <span className="dg-exam-tag">IELTS</span>
            <b>IELTS Academic</b>
            <span>One random Listening part or Reading passage in 10 to 20 minutes. You get a band estimate and your CEFR level.</span>
            <span className="dg-exam-go">
              Find my starting band <Icon name="arrowRight" size={16} />
            </span>
          </button>
        </div>
        <button className="dg-skip" onClick={() => nav("/dashboard")}>
          Skip for now and go to my dashboard
        </button>
      </div>
    </main>
  );
}
