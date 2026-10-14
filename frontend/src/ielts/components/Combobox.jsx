import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover } from "./Popover.jsx";

// "Select or type source name": pick an existing value or create a new one.
export function CreatableCombobox({ value, onChange, options, placeholder = "Select or type source name", searchPlaceholder = "Search or type source name...", emptyText = "No source found." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  const q = query.trim();
  const filtered = useMemo(() => options.filter((o) => o.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const canCreate = q && !options.some((o) => o.toLowerCase() === q.toLowerCase());
  const rows = [...(canCreate ? [{ create: true, label: q }] : []), ...filtered.map((o) => ({ label: o }))];

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const choose = (label) => {
    onChange(label === value ? "" : label);
    setOpen(false);
  };

  return (
    <>
      <button ref={triggerRef} type="button" className="ie-combo-trigger" onClick={() => setOpen((o) => !o)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || placeholder}</span>
        <ChevronsUpDown />
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <input
          ref={inputRef}
          className="ie-menu__search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(rows.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (rows[active]) choose(rows[active].label);
            }
          }}
        />
        <div className="ie-menu">
          {rows.length === 0 && <div className="ie-menu__empty">{emptyText}</div>}
          {rows.map((row, i) => (
            <button
              key={(row.create ? "create:" : "") + row.label}
              type="button"
              className={`ie-menu__item ${i === active ? "ie-menu__item--active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(row.label)}
            >
              {row.create ? <Plus /> : null}
              <span>{row.create ? `Create "${row.label}"` : row.label}</span>
              {!row.create && row.label === value && <Check className="ie-menu__check" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// Free-text input with suggestions from existing values (e.g. global reading titles).
export function AutocompleteInput({ value, onChange, suggestions, placeholder, id }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const matches = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(q) && s !== value).slice(0, 8);
  }, [suggestions, value]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        id={id}
        className="ie-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            onChange(matches[active]);
            setOpen(false);
          }
        }}
      />
      <Popover anchorRef={wrapRef} open={open && matches.length > 0} onClose={() => setOpen(false)} width={260}>
        <div className="ie-menu">
          {matches.map((m, i) => (
            <button
              type="button"
              key={m}
              className={`ie-menu__item ${i === active ? "ie-menu__item--active" : ""}`}
              style={{ fontWeight: 500 }}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m}</span>
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
