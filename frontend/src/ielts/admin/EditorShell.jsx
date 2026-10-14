import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { useBeforeUnload } from "../lib/hooks.js";

export function EditorShell({ title, logo = true, backTo, dirty, saving, onSave, saveLabel, backVariant = "outline", children }) {
  const navigate = useNavigate();
  const [confirmLeave, setConfirmLeave] = useState(false);
  useBeforeUnload(dirty);

  return (
    <div className="ie-editor-page">
      <header className="ie-editor-top">
        <Button variant={backVariant} icon={ArrowLeft} onClick={() => (dirty ? setConfirmLeave(true) : navigate(backTo))}>
          Back
        </Button>
        {logo && <span className="ie-logo">IELTS</span>}
        <h1>{title}</h1>
        <div className="ie-editor-top__right">
          <Button icon={Save} loading={saving} onClick={onSave}>
            {saveLabel}
          </Button>
        </div>
      </header>
      {children}
      <ConfirmDialog
        open={confirmLeave}
        title="Are you sure you want to leave this page?"
        message="Once confirmed, you will lose your form"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => navigate(backTo)}
      />
    </div>
  );
}
