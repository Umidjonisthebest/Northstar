export function StatBanner({ icon: Icon, title, subtitle, value, unit }) {
  return (
    <div className="ie-stat-banner">
      <span className="ie-stat-banner__icon">
        <Icon />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="ie-stat-banner__value">
        <strong>{value ?? "–"}</strong>
        <span>{unit}</span>
      </div>
    </div>
  );
}
