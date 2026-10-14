import React from "react";

export function Skeleton({ variant = "text", width, height, className = "" }) {
  const baseStyles = {
    background: "linear-gradient(90deg, var(--border) 25%, var(--muted) 50%, var(--border) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: "4px",
  };

  const variants = {
    text: { height: height || "16px", width: width || "100%", marginBottom: "8px" },
    title: { height: height || "24px", width: width || "40%", marginBottom: "16px" },
    card: { padding: "20px" },
    avatar: { width: width || "40px", height: height || "40px", borderRadius: "50%" },
    button: { width: width || "120px", height: height || "40px", borderRadius: "10px" },
    stat: { width: width || "80px", height: height || "32px", borderRadius: "8px" },
    circle: { width: width || "40px", height: height || "40px", borderRadius: "50%" },
    rect: { width: width || "100%", height: height || "100px", borderRadius: "12px" },
  };

  const style = { ...baseStyles, ...variants[variant], ...(typeof width === "string" && { width }), ...(typeof height === "string" && { height }) };

  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, showAvatar = false, showAction = false }) {
  return (
    <div className="card skeleton-card" style={{ padding: "20px" }}>
      {showAvatar && <Skeleton variant="avatar" style={{ marginBottom: "16px" }} />}
      <Skeleton variant="title" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
      {showAction && <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}><Skeleton variant="button" /><Skeleton variant="button" /></div>}
    </div>
  );
}

export function SkeletonList({ count = 5, showAvatar = true }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="list-row skeleton-card" style={{ padding: "16px 20px", marginBottom: "10px" }}>
          {showAvatar && <Skeleton variant="avatar" />}
          <div style={{ flex: 1, marginLeft: showAvatar ? "12px" : 0 }}>
            <Skeleton variant="title" width="30%" />
            <Skeleton variant="text" width="80%" />
          </div>
          <Skeleton variant="button" width="80px" height="32px" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="dash-shell">
      <header className="dash-header">
        <Skeleton variant="text" width="120px" height="26px" />
        <Skeleton variant="button" width="80px" />
      </header>
      <div className="dash-main">
        <div className="dash-hero" style={{ padding: "32px" }}>
          <Skeleton variant="title" width="60%" />
          <Skeleton variant="text" width="80%" />
          <div className="dash-hero-stats" style={{ marginTop: "20px" }}>
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
          </div>
        </div>
        <div className="section-grid">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonList count={4} />
      </div>
    </div>
  );
}

export function SkeletonExam() {
  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div className="exam-brand">
          <Skeleton variant="button" width="60px" height="24px" />
          <Skeleton variant="text" width="200px" height="24px" />
        </div>
        <div className="exam-header-right">
          <Skeleton variant="text" width="80px" height="28px" style={{ borderRadius: "9px" }} />
          <Skeleton variant="circle" />
        </div>
      </header>
      <Skeleton variant="rect" height="4px" style={{ margin: "0 22px" }} />
      <div className="exam-body">
        <div className="exam-pane passage" style={{ padding: "30px 40px" }}>
          <Skeleton variant="title" width="80px" />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="text" width="70%" />
        </div>
        <div className="exam-pane" style={{ padding: "30px 40px" }}>
          <div className="question-block">
            <Skeleton variant="text" width="40px" height="26px" style={{ borderRadius: "8px" }} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      </div>
      <footer className="exam-footer">
        <Skeleton variant="button" width="80px" />
        <Skeleton variant="button" width="80px" />
        <div className="question-nav">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} variant="circle" width="30px" height="30px" />
          ))}
        </div>
        <Skeleton variant="button" width="140px" />
      </footer>
    </div>
  );
}