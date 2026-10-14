import React, { useState } from "react";
import Nova, { NovaMark } from "../../components/Nova.jsx";
import Nova3D from "../../components/nova/Nova3D.jsx";
import { MOOD_SPRITE, FRIEND_SPRITES } from "../../components/nova/sprites.js";
import { NOVA_EVENTS } from "../../components/nova/moods.js";
import { ACCESSORIES } from "../../components/nova/accessoryList.js";
import Avatar from "../../components/avatar/Avatar.jsx";
import { AVATARS, AVATAR_FRAMES } from "../../components/avatar/avatars.js";
import Logo from "../../components/Brand.jsx";
import Spot from "../../components/Spot.jsx";
import Icon, { ICONS, BADGE_ART, Medal } from "../../components/Icon.jsx";
import TierBadge from "../../components/Tier.jsx";
import { BookArt, MathArt, TrailArt, TargetArt } from "../../components/Art.jsx";
import "../../diagnostic.css";

// /dev/art (development builds only): every Nova picture, mood, friend, accessory and profile
// picture on one page, on light and dark. For checking that accessories line up and that a new
// picture looks right before it ships. Not linked from anywhere and not in production builds.
const cell = { display: "grid", justifyItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center" };
const row = { display: "flex", flexWrap: "wrap", gap: 18, alignItems: "end" };
const H = ({ children }) => <h2 style={{ fontFamily: "var(--display)", fontSize: 20, margin: "30px 0 12px" }}>{children}</h2>;

export default function ArtGallery() {
  const [dark, setDark] = useState(false);
  const [extra, setExtra] = useState("cap");
  const ground = dark ? { background: "#141234", color: "#e8e6ff", "--ink-soft": "#b9b6e0", "--surface": "#1d1a45", "--border": "#34306a", "--ink": "#e8e6ff", "--art-hill": "#1d3150" } : { background: "#f5f7fc", "--surface": "#fff", "--ink": "#17152f", "--art-hill": "#d6eefd" };
  return (
    <main style={{ ...ground, minHeight: "100vh", padding: "24px clamp(16px, 4vw, 48px) 80px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Logo size={40} />
        <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setDark((d) => !d)}>
          {dark ? "Light ground" : "Dark ground"}
        </button>
        <label style={{ fontSize: 14 }}>
          Wearing{" "}
          <select value={extra} onChange={(e) => setExtra(e.target.value)}>
            <option value="">nothing</option>
            {ACCESSORIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <H>Spot illustrations (ink, two greys, one colour)</H>
      <div style={row}>
        {["telescope", "rocket", "planet", "book", "hourglass", "chart", "summit", "headphones", "chat", "calendar"].map((n, i) => (
          <div key={n} style={cell}>
            <Spot name={n} size={190} blob={"abc"[i % 3]} accent={["#ffd9ec", "#e3dbff", "#d6e6ff", "#ffe6cf"][i % 4]} pop={["#f28ac4", "#a48bf5", "#7fa8ff", "#ffb37a"][i % 4]} />
            {n}
          </div>
        ))}
      </div>

      <H>League crests</H>
      <div style={row}>
        {["Comet", "Nebula", "Pulsar", "Quasar", "Supernova"].map((n, i) => (
          <div key={n} style={cell}>
            <TierBadge tier={i} size={96} />
            <TierBadge tier={i} size={36} />
            {n}
          </div>
        ))}
      </div>

      <H>Trophies ({Object.keys(BADGE_ART).length})</H>
      <div style={row}>
        {Object.keys(BADGE_ART).map((id) => (
          <div key={id} style={{ ...cell, width: 92 }}>
            <Medal id={id} size={76} />
            {id}
          </div>
        ))}
        <div style={{ ...cell, width: 92 }}>
          <Medal id="century" earned={false} size={76} />
          locked
        </div>
      </div>

      <H>Card and page art</H>
      <div style={{ ...row, alignItems: "center" }}>
        <div style={{ width: 300, borderRadius: 22, background: "linear-gradient(118deg, #d9489a, #b34fd2 50%, #7757e0)" }}>
          <BookArt />
        </div>
        <div style={{ width: 300, borderRadius: 22, background: "linear-gradient(118deg, #1f7fe6, #3463de 48%, #433dc2)" }}>
          <MathArt />
        </div>
        <div style={{ width: 380 }}>
          <TrailArt />
        </div>
        <div style={{ width: 300 }}>
          <TargetArt />
        </div>
      </div>

      <H>Every icon</H>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {Object.keys(ICONS)
          .map((n) => (
            <div key={n} style={{ ...cell, width: 84, padding: "10px 4px", borderRadius: 16, background: "var(--surface, #fff)", color: "#4b3fd6" }}>
              <Icon name={n} size={30} />
              <span style={{ color: "var(--ink-soft)" }}>{n}</span>
            </div>
          ))}
      </div>

      <H>Moods (what the app asks for, and the picture it gets)</H>
      <div style={row}>
        {Object.entries(MOOD_SPRITE).map(([mood, sprite]) => (
          <div key={mood} style={cell}>
            <Nova size={112} mood={mood} />
            <b>{mood}</b>
            <span>picture: {sprite}</span>
          </div>
        ))}
      </div>

      <H>Events</H>
      <div style={row}>
        {Object.entries(NOVA_EVENTS).map(([event, mood]) => (
          <div key={event} style={cell}>
            <Nova size={72} mood={mood} />
            <b>{event}</b>
            <span>{mood}</span>
          </div>
        ))}
      </div>

      <H>Wearing: {extra || "nothing"}</H>
      <div style={row}>
        {["happy", "wave", "wink", "thinking", "oops", "cheer", "excited", "laugh", "surprised", "proud", "focused", "calm", "sleepy", "dim"].map((m) => (
          <div key={m} style={cell}>
            <Nova size={150} mood={m} extra={extra || undefined} />
            {m}
          </div>
        ))}
      </div>

      <H>Friends (tones)</H>
      <div style={row}>
        {Object.keys(FRIEND_SPRITES).map((tone) => (
          <div key={tone} style={cell}>
            <Nova size={150} tone={tone} extra={extra || undefined} />
            {tone}
          </div>
        ))}
      </div>

      <H>Sizes, and the vector mark under 28px</H>
      <div style={row}>
        {[14, 16, 18, 20, 22, 24, 26].map((s) => (
          <div key={s} style={cell}>
            <Nova size={s} />
            {s}
          </div>
        ))}
        {[28, 36, 48, 64, 96].map((s) => (
          <div key={s} style={cell}>
            <Nova size={s} />
            {s}
          </div>
        ))}
        <div style={cell}>
          <NovaMark size={96} />
          mark 96
        </div>
      </div>

      <H>3D Nova (hero and sign-up only)</H>
      <Nova3D size={260} />

      <H>Profile pictures, wearing: {extra || "nothing"}</H>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16 }}>
        {AVATARS.map((a, i) => (
          <div key={a.id} style={cell}>
            <Avatar avatar={{ id: a.id, accessory: extra || null, frame: AVATAR_FRAMES[i % AVATAR_FRAMES.length].id }} size={112} />
            {a.id} {a.label}
          </div>
        ))}
      </div>

      <H>Small sizes</H>
      <div style={row}>
        {[24, 30, 40, 56].map((s) => (
          <div key={s} style={cell}>
            <Avatar avatar={{ id: "12", accessory: "crown", frame: "dawn" }} size={s} />
            <Avatar name="Aziza Karimova" size={s} />
            {s}
          </div>
        ))}
      </div>
    </main>
  );
}
