import { ChevronLeft, ChevronRight } from "lucide-react";

export function Button({ variant = "primary", size, icon: Icon, iconRight: IconRight, loading = false, block = false, className = "", children, type = "button", disabled, ...rest }) {
  const cls = ["ie-btn", `ie-btn--${variant}`, size && `ie-btn--${size}`, block && "ie-btn--block", !children && "ie-btn--icon", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="ie-spinner" /> : Icon ? <Icon /> : null}
      {children}
      {IconRight && !loading ? <IconRight /> : null}
    </button>
  );
}

export function Spinner({ size = 16, style }) {
  return <span className="ie-spinner" style={{ width: size, height: size, ...style }} />;
}

export function Field({ label, hint, help, error, success, children, className = "", htmlFor, style }) {
  return (
    <div className={`ie-field ${className}`} style={style}>
      {label && (
        <label className="ie-label" htmlFor={htmlFor}>
          {label} {hint && <small>{hint}</small>}
        </label>
      )}
      {children}
      {error ? <div className="ie-help ie-help--error">{error}</div> : success ? <div className="ie-help ie-help--success">{success}</div> : help ? <div className="ie-help">{help}</div> : null}
    </div>
  );
}

export function IconInput({ icon: Icon, className = "", ...props }) {
  return (
    <div className={`ie-input-wrap ${className}`}>
      <Icon />
      <input className="ie-input" {...props} />
    </div>
  );
}

export function Pill({ tone = "gray", round = false, size, icon: Icon, children, className = "" }) {
  return (
    <span className={["ie-pill", `ie-pill--${tone}`, round && "ie-pill--round", size && `ie-pill--${size}`, className].filter(Boolean).join(" ")}>
      {Icon && <Icon />}
      {children}
    </span>
  );
}

export function Avatar({ name = "", size, tone, initials }) {
  const letters = initials || (name.trim()[0] || "?");
  return <span className={["ie-avatar", size && `ie-avatar--${size}`, tone && `ie-avatar--${tone}`].filter(Boolean).join(" ")}>{letters}</span>;
}

export function Skeleton({ width = "100%", height = 14, radius, style, className = "" }) {
  return <div className={`ie-skeleton ${className}`} style={{ width, height, borderRadius: radius, ...style }} />;
}

export function Pagination({ page, pages, total, perPage, onPage, noun = "entries", compact = false }) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className="ie-pagination">
      <span>
        Showing {from} to {to} of {total} {noun}
      </span>
      <div className="ie-pagination__controls">
        <Button variant={compact ? "outline" : "ghost"} size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {compact ? "Prev" : "Previous"}
        </Button>
        <span>
          Page {page} of {Math.max(1, pages)}
        </span>
        <Button variant={compact ? "outline" : "ghost"} size="sm" iconRight={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ children, action }) {
  return (
    <div className="ie-empty">
      <div>{children}</div>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function PageLoader({ label = "Loading..." }) {
  return (
    <div className="ie-page-loader">
      <Spinner /> {label}
    </div>
  );
}
