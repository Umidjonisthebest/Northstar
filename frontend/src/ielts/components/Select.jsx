import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "./Popover.jsx";

// options: [{ value, label }]. Keyboard: arrows move, Enter selects, Esc closes.
export function Select({ value, onChange, options, placeholder = "Select...", className = "", style, disabled = false, width, id, "aria-label": ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (opt) => {
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={`ie-select ${open ? "ie-select--open" : ""} ${className}`} style={{ width, ...style }}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="ie-select__trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? "" : "ie-select__placeholder"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown />
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={160}>
        <div className="ie-menu" role="listbox" ref={listRef}>
          {options.map((opt, i) => (
            <button
              type="button"
              key={String(opt.value)}
              role="option"
              aria-selected={opt.value === value}
              className={`ie-menu__item ${i === active ? "ie-menu__item--active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="ie-menu__check" />}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
