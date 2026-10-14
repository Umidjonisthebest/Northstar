import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ToastProvider } from "./components/Toast.jsx";
import { PageLoader } from "./components/ui.jsx";
import { ScopeContext } from "./scope.js";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/editor.css";
import "./styles/admin.css";
import "./styles/exam.css";
import "./styles/landing.css";

// Layout route around every IELTS screen (see App.jsx). `variant`:
//   candidate — exam-room pages; always the light, official-exam look
//   workspace — full-screen admin editors and previews
//   admin     — pages inside Northstar's teacher studio; follows its dark mode
export default function IeltsScope({ variant }) {
  return (
    <ScopeContext.Provider value={variant}>
      <div className={`ie-root ie-root--${variant}${variant === "admin" ? "" : " ie-scope--page"}`}>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ToastProvider>
      </div>
    </ScopeContext.Provider>
  );
}
