import React from "react";
import { Link } from "react-router-dom";
import { NovaMark } from "./Nova.jsx";

// The Northstar logo: Nova's vector mark plus the wordmark (crisp at any size). Pass `to` to make it a link,
// `tag` for a small line under the name (e.g. "Teacher studio").
export default function Logo({ to, size = 34, tag, className = "" }) {
  const inner = (
    <>
      <NovaMark size={size} className="brand-mark" />
      <span className="brand-word">
        northstar
        {tag && <small>{tag}</small>}
      </span>
    </>
  );
  const style = { "--brand-size": `${size}px` };
  return to ? (
    <Link to={to} className={`brand ${className}`} style={style} aria-label="Northstar home">
      {inner}
    </Link>
  ) : (
    <span className={`brand ${className}`} style={style}>
      {inner}
    </span>
  );
}
