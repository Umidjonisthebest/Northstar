import React from "react";
import { NOVA_3D } from "./sprites.js";
import b1 from "../../assets/nova/nova-3d-bubble-1.webp";
import b2 from "../../assets/nova/nova-3d-bubble-2.webp";
import b3 from "../../assets/nova/nova-3d-bubble-3.webp";
import b4 from "../../assets/nova/nova-3d-bubble-4.webp";
import b5 from "../../assets/nova/nova-3d-bubble-5.webp";
import b6 from "../../assets/nova/nova-3d-bubble-6.webp";
import b7 from "../../assets/nova/nova-3d-bubble-7.webp";
import "./nova3d.css";

/*
 * The 3D Nova, for big moments only: the cover page hero, sign-up and the first welcome.
 * Never put it in a view that also shows the 2D Nova (<Nova>): the two styles clash.
 *
 * The picture is in pieces (tools/art/bubbles.mjs): the star itself, and each of the seven little
 * bubbles that float around her. Each bubble sits where it was in the owner's render (x, y, w in
 * percent of the square) and drifts on its own path and timing, so they move one by one instead
 * of as a single picture. `float` bobs the star. Reduced motion stops everything.
 */
const BUBBLES = [
  { src: b1, x: 71.7, y: 15.5, w: 11.2, dx: 6, dy: -10, t: 5.2, d: 0 },
  { src: b2, x: 4, y: 63.8, w: 8.8, dx: -7, dy: -8, t: 6.4, d: -1.6 },
  { src: b3, x: 90.6, y: 58.8, w: 7.5, dx: 8, dy: 9, t: 5.8, d: -2.9 },
  { src: b4, x: 8.2, y: 75.7, w: 5.9, dx: -5, dy: 10, t: 4.6, d: -0.7 },
  { src: b5, x: 83.2, y: 22.9, w: 5.8, dx: 9, dy: -5, t: 4.2, d: -2.1 },
  { src: b6, x: 1.8, y: 73.5, w: 4, dx: -8, dy: -6, t: 3.8, d: -1.2 },
  { src: b7, x: 85.3, y: 16.3, w: 3.8, dx: 5, dy: -9, t: 3.4, d: -2.6 }
];

export default function Nova3D({ size = 220, float = false, className = "", title }) {
  return (
    <span className={`n3d ${className}`} style={{ "--n3d": `${size}px` }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <img className={`n3d-star ${float ? "n3d-float" : ""}`} src={NOVA_3D.src} alt="" decoding="async" draggable="false" />
      {BUBBLES.map((b, i) => (
        <img
          key={i}
          className="n3d-bubble"
          src={b.src}
          alt=""
          draggable="false"
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, animationDuration: `${b.t}s`, animationDelay: `${b.d}s` }}
        />
      ))}
    </span>
  );
}
