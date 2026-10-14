import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "./Popover.jsx";
import { formatLongDate, toISODate } from "../lib/format.js";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// value/onChange use "YYYY-MM-DD" strings.
export function DatePicker({ value, onChange, placeholder = "Pick a date" }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [view, setView] = useState(() => {
    const d = selected || new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const triggerRef = useRef(null);
  const today = toISODate(new Date());

  const days = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);
  const rows = days.slice(35).every((d) => d.getMonth() !== view.m) ? days.slice(0, 35) : days;

  const shift = (delta) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <>
      <button ref={triggerRef} type="button" className="ie-combo-trigger ie-date-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="ie-row" style={{ gap: 10 }}>
          <CalendarDays />
          <span>{selected ? formatLongDate(value) : placeholder}</span>
        </span>
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} width={276}>
        <div className="ie-cal">
          <div className="ie-cal__head">
            <button type="button" className="ie-cal__nav" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft />
            </button>
            <span>
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" className="ie-cal__nav" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight />
            </button>
          </div>
          <div className="ie-cal__grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="ie-cal__wd">
                {w}
              </span>
            ))}
            {rows.map((d) => {
              const iso = toISODate(d);
              const cls = ["ie-cal__day", d.getMonth() !== view.m && "ie-cal__day--out", iso === today && "ie-cal__day--today", iso === value && "ie-cal__day--selected"]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={iso}
                  type="button"
                  className={cls}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </>
  );
}
