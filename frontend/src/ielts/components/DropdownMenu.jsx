import { useRef, useState } from "react";
import { Popover } from "./Popover.jsx";

// items: [{ label, icon, onSelect, danger, disabled }]
export function DropdownMenu({ trigger, items, align = "end", width = 180 }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  return (
    <>
      <span ref={anchorRef} style={{ display: "inline-flex" }} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </span>
      <Popover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={width} align={align}>
        <div className="ie-menu ie-dropdown">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`ie-dropdown__item ${item.danger ? "ie-dropdown__item--danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {Icon && <Icon />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
