import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { IELTS_ADMIN, adminPath } from "../paths.js";
import { Eye, EyeOff, X } from "lucide-react";
import { previewContent } from "../api.js";
import { PageLoader } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { ExamScreen } from "../exam/ExamScreen.jsx";

function buildKey(part) {
  const map = new Map();
  for (const g of part?.groups || []) {
    for (const s of g.slots || []) {
      if (s.mode === "multi") {
        const item = g.items?.find((i) => i.id === s.itemId);
        const key = item?.correct?.[s.index];
        if (key) map.set(s.id, [key]);
      } else {
        const a = g.answers?.[s.id];
        if (a?.value) map.set(s.id, [a.value, ...(a.variations || [])]);
      }
    }
  }
  return map;
}

export default function PreviewPage() {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [prefs, setPrefs] = useState({ contrast: "bow", textSize: "regular", volume: 0.8 });

  useEffect(() => {
    if (kind === "writing") return;
    previewContent(kind, id)
      .then(setData)
      .catch((err) => {
        toast.error("Preview failed", err.message);
        navigate(adminPath("tests"), { replace: true });
      });
  }, [kind, id, navigate, toast]);

  const keyOf = useMemo(() => buildKey(data?.part), [data]);
  const parts = useMemo(() => (data ? [data.part] : []), [data]);

  if (!["listening", "reading", "writing"].includes(kind)) return <Navigate to={IELTS_ADMIN} replace />;
  if (kind === "writing") return <Navigate to={adminPath("writing", id, "edit")} replace />;
  if (!data) return <PageLoader label="Loading preview..." />;

  return (
    <ExamScreen
      section={kind}
      candidateId="preview"
      parts={parts}
      preview
      reveal={reveal}
      keyOf={keyOf}
      prefs={prefs}
      onPrefs={setPrefs}
      onAutosave={async () => {}}
      onSubmit={async () => {}}
      previewExtra={
        <div className="ie-preview-tools">
          {kind === "listening" && data.part.audioUrl && <audio className="ie-preview-audio" controls preload="metadata" src={data.part.audioUrl} />}
          <button type="button" className="ie-btn ie-btn--outline ie-btn--sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? <EyeOff /> : <Eye />}
            {reveal ? "Hide answers" : "Show answers"}
          </button>
          {/* Back to wherever it was opened from: a practice test's page, section practice or the mock material. */}
          <button type="button" className="ie-btn ie-btn--soft ie-btn--sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(adminPath("tests")))}>
            <X />
            Close preview
          </button>
        </div>
      }
    />
  );
}
