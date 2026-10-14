import React, { useState } from "react";
import { Link } from "react-router-dom";
import { updateAvatar } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../Toast.jsx";
import Icon from "../Icon.jsx";
import { chunkWord, lockedItem } from "./shopParts.js";
import { Accessory } from "../nova/Accessories.jsx";
import { ACCESSORIES } from "../nova/accessoryList.js";
import Avatar from "./Avatar.jsx";
import { AVATARS, AVATAR_FRAMES } from "./avatars.js";

// A little screen wearing the accessory, for the buttons that choose one.
const DEMO_FACE = { x: 30, y: 42, w: 40, h: 30 };
function AccessoryIcon({ kind }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="30" y="42" width="40" height="30" rx="8" fill="#ece6ff" stroke="#2b2553" strokeWidth="4" />
      <Accessory kind={kind} face={DEMO_FACE} />
    </svg>
  );
}

// The price on a part that has to be bought in the Comet Shop first.
function Lock({ item }) {
  return (
    <span className="avp-lock" title={`${item.price} ${chunkWord(item.price)} in the Comet Shop`}>
      <Icon name="comet" size={13} /> {item.price}
    </span>
  );
}

/*
 * Choose a profile picture: one of the 30 characters, something for it to wear, and a frame.
 * Changes show at once in the preview; "Save" stores them on the account (and the sidebar, league
 * table and teacher's lists follow). `onSaved` is called with the updated user.
 *
 * Parts sold in the Comet Shop can't be chosen until they are bought: they show their price, and
 * `shopLink` adds the way there (off during sign-up, which shouldn't be walked away from).
 */
export default function AvatarPicker({ onSaved, saveLabel = "Save picture", shopLink = true }) {
  const { user, token, login } = useStudentAuth();
  const { progress } = useProgress();
  const locked = (kind, value) => lockedItem(progress?.chunks, kind, value);
  const anyLocked = (progress?.chunks?.items || []).some((i) => !progress.chunks.owned.includes(i.id));
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => user?.avatar || { id: null, accessory: null, frame: "none" });
  const [busy, setBusy] = useState(false);
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const same = JSON.stringify(draft.id ? draft : null) === JSON.stringify(user?.avatar || null);

  async function save(next) {
    setBusy(true);
    try {
      const updated = await updateAvatar(token, next && next.id ? next : null);
      login(token, updated);
      toast.success(next && next.id ? "Profile picture saved" : "Back to your initials");
      onSaved?.(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avp">
      <div className="avp-top">
        <Avatar avatar={draft.id ? draft : null} name={name} size={96} title="Your profile picture" />
        <p>
          <b>{draft.id ? AVATARS.find((a) => a.id === draft.id)?.label : "Your initials"}</b>
          Pick a character, then give it something to wear and a frame. Other students see it next to your name in the league.
        </p>
      </div>

      <div className="avp-group">
        <h3 id="avp-char">Character</h3>
        <div className="avp-grid" role="radiogroup" aria-labelledby="avp-char">
          {AVATARS.map((a) => {
            const lock = locked("avatar", a.id);
            return (
              <button key={a.id} type="button" role="radio" aria-checked={draft.id === a.id} aria-label={a.label} title={a.label} className={`avp-pick ${lock ? "locked" : ""}`} disabled={Boolean(lock)} onClick={() => setDraft((d) => ({ ...d, id: a.id }))}>
                <Avatar avatar={{ id: a.id, accessory: null, frame: "none" }} size={64} />
                {lock && <Lock item={lock} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="avp-group">
        <h3 id="avp-acc">Wearing</h3>
        <div className="avp-row" role="radiogroup" aria-labelledby="avp-acc">
          <button type="button" role="radio" aria-checked={!draft.accessory} className="avp-chip plain" disabled={!draft.id} onClick={() => setDraft((d) => ({ ...d, accessory: null }))}>
            Nothing
          </button>
          {ACCESSORIES.map((a) => {
            const lock = locked("accessory", a.id);
            return (
              <button key={a.id} type="button" role="radio" aria-checked={draft.accessory === a.id} className={`avp-chip ${lock ? "locked" : ""}`} disabled={!draft.id || Boolean(lock)} onClick={() => setDraft((d) => ({ ...d, accessory: a.id }))}>
                <AccessoryIcon kind={a.id} /> {a.label}
                {lock && <Lock item={lock} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="avp-group">
        <h3 id="avp-frame">Frame</h3>
        <div className="avp-row" role="radiogroup" aria-labelledby="avp-frame">
          {AVATAR_FRAMES.map((f) => {
            const lock = locked("frame", f.id);
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={(draft.frame || "none") === f.id}
                aria-label={lock ? `${f.label}: ${lock.price} ${chunkWord(lock.price)} in the Comet Shop` : f.label}
                title={lock ? `${f.label}: ${lock.price} ${chunkWord(lock.price)} in the Comet Shop` : f.label}
                className={`avp-swatch ${f.id === "none" ? "none" : ""} ${lock ? "locked" : ""}`}
                style={{ background: f.css }}
                disabled={!draft.id || Boolean(lock)}
                onClick={() => setDraft((d) => ({ ...d, frame: f.id }))}
              >
                {lock && <Icon name="lock" size={15} />}
              </button>
            );
          })}
        </div>
      </div>

      {anyLocked && (
        <p className="avp-shop">
          <Icon name="comet" size={16} />
          <span>Parts with a price are bought with comet chunks, which you earn by studying.</span>
          {shopLink && <Link to="/shop">Open the Comet Shop</Link>}
        </p>
      )}

      <div className="avp-actions">
        <button type="button" className="ns-btn ns-btn-primary" disabled={busy || same || !draft.id} onClick={() => save(draft)}>
          {busy ? "Saving…" : saveLabel}
        </button>
        {user?.avatar && (
          <button
            type="button"
            className="ns-btn ns-btn-outline"
            disabled={busy}
            onClick={() => {
              setDraft({ id: null, accessory: null, frame: "none" });
              save(null);
            }}
          >
            Use my initials
          </button>
        )}
        {!draft.id && <small>Choose a character first.</small>}
      </div>
    </div>
  );
}
