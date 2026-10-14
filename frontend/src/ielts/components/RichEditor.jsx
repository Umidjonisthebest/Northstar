import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { newId } from "../lib/ids.js";

const Embed = Quill.import("blots/embed");
const BlockEmbed = Quill.import("blots/block/embed");
const Delta = Quill.import("delta");

// Inline answer gap. Stored as <span class="ql-blank" data-id="..."></span>;
// the number shown in the editor comes from a CSS counter.
class BlankBlot extends Embed {
  static blotName = "blank";
  static tagName = "span";
  static className = "ql-blank";
  static create(value) {
    const node = super.create(value);
    node.setAttribute("data-id", value);
    return node;
  }
  static value(node) {
    return node.getAttribute("data-id");
  }
  html() {
    return `<span class="ql-blank" data-id="${this.domNode.getAttribute("data-id")}"></span>`;
  }
}

// Paragraph heading gap for "Matching Headings" (inserted with Ctrl+H).
class HeadingSlotBlot extends BlockEmbed {
  static blotName = "headingSlot";
  static tagName = "div";
  static className = "ql-heading-slot";
  static create(value) {
    const node = super.create(value);
    node.setAttribute("data-id", value);
    node.setAttribute("contenteditable", "false");
    return node;
  }
  static value(node) {
    return node.getAttribute("data-id");
  }
  html() {
    return `<div class="ql-heading-slot" data-id="${this.domNode.getAttribute("data-id")}"></div>`;
  }
}

Quill.register(BlankBlot, true);
Quill.register(HeadingSlotBlot, true);

// Pasted blanks always get fresh ids so answers never collide; ids are kept
// only while loading saved content.
let preserveIds = false;

const TOOLBARS = {
  full: [
    [{ header: [1, 2, 3, false] }, { size: [] }],
    ["bold", "italic", "underline", "strike"],
    [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["code-block"]
  ],
  compact: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }]],
  none: false
};

const FORMATS = ["font", "size", "bold", "italic", "underline", "strike", "align", "list", "code-block", "header", "blank", "headingSlot"];

function normalizeHtml(html) {
  const cleaned = html.replace(/&nbsp;/g, " ");
  return cleaned === "<p></p>" || cleaned === "<p><br></p>" ? "" : cleaned;
}

export function RichEditor({
  value = "",
  onChange,
  placeholder,
  toolbar = "full",
  enableBlanks = false,
  enableHeadingSlots = false,
  blankStart = 1,
  headingStart = 1,
  minHeight = 90,
  className = "",
  variant = "default",
  autoFocus = false
}) {
  const hostRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastHtml = useRef(value);

  useEffect(() => {
    const host = hostRef.current;
    const el = document.createElement("div");
    host.appendChild(el);
    const bindings = {};
    if (enableBlanks) {
      bindings.insertBlank = {
        key: ["k", "K"],
        shortKey: true,
        handler(range) {
          const q = this.quill;
          const at = range ? range.index : q.getLength() - 1;
          if (range?.length) q.deleteText(range.index, range.length, "user");
          q.insertEmbed(at, "blank", newId("b"), "user");
          q.setSelection(at + 1, 0, "user");
          return false;
        }
      };
    }
    if (enableHeadingSlots) {
      bindings.insertHeading = {
        key: ["h", "H"],
        shortKey: true,
        handler(range) {
          const q = this.quill;
          const index = range ? range.index : 0;
          const [, offset] = q.getLine(index);
          const lineStart = index - (offset || 0);
          q.insertEmbed(lineStart, "headingSlot", newId("h"), "user");
          q.setSelection(lineStart + 1, 0, "user");
          return false;
        }
      };
    }
    const quill = new Quill(el, {
      theme: "snow",
      placeholder,
      formats: FORMATS,
      modules: { toolbar: TOOLBARS[toolbar], keyboard: { bindings } }
    });
    quill.clipboard.addMatcher("span.ql-blank", (node, delta) => (preserveIds ? delta : new Delta().insert({ blank: newId("b") })));
    quill.clipboard.addMatcher("div.ql-heading-slot", (node, delta) => (preserveIds ? delta : new Delta().insert({ headingSlot: newId("h") })));

    if (value) {
      preserveIds = true;
      try {
        quill.setContents(quill.clipboard.convert({ html: value }), "silent");
      } finally {
        preserveIds = false;
      }
    }
    lastHtml.current = normalizeHtml(quill.getSemanticHTML());

    quill.on("text-change", () => {
      const html = normalizeHtml(quill.getSemanticHTML());
      lastHtml.current = html;
      onChangeRef.current?.(html);
    });
    quillRef.current = quill;
    if (autoFocus) quill.focus();
    return () => {
      quillRef.current = null;
      host.innerHTML = "";
    };
    // Editor is created once; later `value` changes from outside are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value replacement (e.g. switching parts) — ignored when it is
  // just the echo of what the editor itself produced.
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastHtml.current) return;
    preserveIds = true;
    try {
      quill.setContents(quill.clipboard.convert({ html: value || "" }), "silent");
    } finally {
      preserveIds = false;
    }
    lastHtml.current = normalizeHtml(quill.getSemanticHTML());
  }, [value]);

  return (
    <div
      ref={hostRef}
      className={`ie-rich-editor ie-rich-editor--${variant} ${toolbar === "none" ? "ie-rich-editor--no-toolbar" : ""} ${className}`}
      style={{ "--ie-editor-min": `${minHeight}px`, "--ie-blank-start": blankStart - 1, "--ie-heading-start": headingStart - 1 }}
    />
  );
}
