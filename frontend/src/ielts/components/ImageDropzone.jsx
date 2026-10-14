import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { uploadFile } from "../api.js";
import { Button } from "./ui.jsx";
import { useToast } from "./Toast.jsx";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

// value: { url, name } | null
export function ImageDropzone({ value, onChange, children }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      toast.error("Unsupported file", "Only jpg, jpeg, png, webp formats. GIF, video, pdf, doc, etc. are not accepted.");
      return;
    }
    setProgress(0);
    try {
      const res = await uploadFile("image", file, setProgress);
      onChange({ url: res.url, name: res.name });
      toast.success("Image uploaded successfully!");
    } catch (err) {
      toast.error("Upload failed", err.message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div
      className={`ie-dropzone ${over ? "ie-dropzone--over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <strong>{children || "Drag and drop your image here or click to select"}</strong>
      <small>Only jpg, jpeg, png, webp formats. GIF, video, pdf, doc, etc. are not accepted.</small>
      {progress !== null && (
        <div className="ie-progress" style={{ marginTop: 12 }}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {value?.url && (
        <div onClick={(e) => e.stopPropagation()}>
          <img src={value.url} alt="" />
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => onChange(null)}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
