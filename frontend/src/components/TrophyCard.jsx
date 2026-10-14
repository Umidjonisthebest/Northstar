import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBackdropClose from "./useBackdropClose.js";
import Icon, { BADGE_ART, Medal } from "./Icon.jsx";

// The card an earned trophy opens: the medal up close, its line of praise, what it was for, when
// it was won, and the next trophy on the same ladder. The words and the counts come from the
// server (`cheer` and `ladder` on each badge in GET /progress); only the art is ours.

// What a medal's shape says about the trophy (BADGE_ART sets the shapes).
const FAMILY = { disc: "Practice trophy", hex: "Streak trophy", shield: "Test trophy", burst: "Milestone trophy" };

const DAY = 86400000;
const startOfDay = (d) => new Date(d).setHours(0, 0, 0, 0);

function ago(iso) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(iso)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function ordinal(n) {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

export default function TrophyCard({ badge, badges, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const box = useRef(null);
  const doneRef = useRef(null);
  const [spins, setSpins] = useState(0);

  // Focus moves into the card and stays there, Escape closes it, and closing hands the focus back
  // to the trophy that opened it. (`onClose` has to be stable, as useTrophyCard's is.)
  useEffect(() => {
    const opener = document.activeElement;
    doneRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const stops = [...box.current.querySelectorAll("button")];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const art = BADGE_ART[badge.id] || { c: ["#c7d2fe", "#4f46e5"] };
  const earned = badges.filter((b) => b.earned).sort((a, b) => String(a.earnedAt).localeCompare(String(b.earnedAt)));
  const nth = earned.findIndex((b) => b.id === badge.id) + 1;
  const ladder = badge.ladder;
  const next = ladder?.next ? badges.find((b) => b.id === ladder.next.id) : null;

  return createPortal(
    <div className="ns-tc-back" {...backdrop}>
      <div className="ns-tc" ref={box} role="dialog" aria-modal="true" aria-labelledby="ns-tc-name" style={{ "--tc-light": art.c[0], "--tc-deep": art.c[1] }}>
        <button type="button" className="ns-tc-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>

        <div className="ns-tc-stage">
          <span className="ns-tc-halo" aria-hidden="true" />
          <span className="ns-tc-sparks" key={spins} aria-hidden="true">
            {SPARKS.map((deg, i) => (
              <i key={deg} style={{ "--tc-turn": `${deg}deg`, "--tc-wait": `${0.25 + (i % 4) * 0.06}s` }} />
            ))}
          </span>
          <button type="button" className="ns-tc-medal" onClick={() => setSpins((n) => n + 1)} aria-label="Spin the medal">
            <span key={spins} className={spins ? "ns-tc-coin again" : "ns-tc-coin"}>
              <Medal id={badge.id} size={132} />
            </span>
          </button>
        </div>

        <p className="ns-tc-kicker">{FAMILY[art.shape] || FAMILY.disc}</p>
        <h2 id="ns-tc-name">{badge.name}</h2>
        {badge.cheer && <p className="ns-tc-cheer">{badge.cheer}</p>}

        <dl className="ns-tc-facts">
          <div className="wide">
            <dt>What it's for</dt>
            <dd>{badge.desc}</dd>
          </div>
          <div>
            <dt>Earned</dt>
            <dd>
              {new Date(badge.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              <small>{ago(badge.earnedAt)}</small>
            </dd>
          </div>
          <div>
            <dt>Your collection</dt>
            <dd>
              Your {ordinal(nth)} trophy
              <small>
                {earned.length} of {badges.length} so far
              </small>
            </dd>
          </div>
        </dl>

        {next && (
          <div className="ns-tc-next">
            <Medal id={next.id} earned={false} size={46} />
            <div>
              <small>Next in this set</small>
              <b>{next.name}</b>
              <span>{next.desc}</span>
              {ladder.next.need > 0 && (
                <>
                  <div className="ns-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ladder.next.need} aria-valuenow={ladder.next.have} aria-label={ladder.next.tally}>
                    <div style={{ width: `${(ladder.next.have / ladder.next.need) * 100}%` }} />
                  </div>
                  <span className="ns-tc-tally">{ladder.next.tally}</span>
                </>
              )}
            </div>
          </div>
        )}
        {ladder && !ladder.next && (
          <div className="ns-tc-next top">
            <span className="ns-tc-crown">
              <Icon name="crown" size={24} />
            </span>
            <div>
              <small>Top of this set</small>
              <b>You hold all {ladder.size} trophies in this set</b>
            </div>
          </div>
        )}

        <button type="button" ref={doneRef} className="btn btn-primary ns-tc-done" onClick={onClose}>
          Nice
        </button>
      </div>
    </div>,
    document.body
  );
}

// For a page that shows trophies: `open(id)` from a click on an earned one, and `card` to render.
export function useTrophyCard(badges) {
  const [id, setId] = useState(null);
  const close = useCallback(() => setId(null), []);
  const badge = id ? badges?.find((b) => b.id === id && b.earned) : null;
  return { open: setId, card: badge ? <TrophyCard badge={badge} badges={badges} onClose={close} /> : null };
}
