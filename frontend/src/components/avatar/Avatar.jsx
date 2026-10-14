import React, { useId } from "react";
import { Accessory } from "../nova/Accessories.jsx";
import { AVATAR_BY_ID, FRAME_BY_ID, avatarSrc } from "./avatars.js";
import "./avatar.css";

/*
 * A person's profile picture: the character they chose, what it is wearing and its frame.
 * `avatar` is { id, accessory, frame } (from the server) or null, in which case their initials are
 * shown on a soft colour picked from their name, as before. Used in the sidebar, the league table,
 * the profile page, the picker and the teacher's lists.
 */
const PALETTE = [
  ["#cfe0ff", "#1d4fb8"],
  ["#ffd9ea", "#b3246b"],
  ["#d3f4e6", "#12714d"],
  ["#e6dcff", "#5a34c4"],
  ["#ffe4d2", "#b0501c"],
  ["#fff0c2", "#8a5a00"]
];

function initialsOf(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function Avatar({ avatar, name = "", size = 40, className = "", title }) {
  const clip = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pic = avatar?.id ? AVATAR_BY_ID[avatar.id] : null;
  const frame = FRAME_BY_ID[avatar?.frame] || FRAME_BY_ID.none;
  const ring = pic && frame.id !== "none" ? Math.max(2, Math.round(size * 0.07)) : 0;
  const style = { width: size, height: size, "--av-ring": `${ring}px`, "--av-frame": frame.css, "--av-radius": `${Math.round(size * 0.3)}px` };

  if (!pic) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const [bg, ink] = PALETTE[h % PALETTE.length];
    return (
      <span className={`av av-initials ${className}`} style={{ ...style, background: bg, color: ink, fontSize: size * 0.36 }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <span className={`av ${ring ? "av-framed" : ""} ${className}`} style={style}>
      <svg viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <clipPath id={`av${clip}`}>
          <rect width="100" height="100" rx="26" />
        </clipPath>
        <g clipPath={`url(#av${clip})`}>
          <image href={avatarSrc(pic.id)} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          {avatar.accessory && <Accessory kind={avatar.accessory} face={pic.face} tilt={pic.tilt || 0} />}
        </g>
      </svg>
    </span>
  );
}
