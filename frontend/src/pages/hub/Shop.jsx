import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buyShopItem, getShop, updateAvatar } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import Avatar from "../../components/avatar/Avatar.jsx";
import { chunkWord } from "../../components/avatar/shopParts.js";
import { Loading } from "./Home.jsx";

// The Comet Shop: where comet chunks are spent on things for the profile picture. Comet chunks
// are their own count, separate from XP: they are earned at milestones and spent here or on
// messages to Nova, while XP only ever goes up. The server owns the balance, the prices and what
// has been bought (backend/shop.js); this page shows them and asks.

const GROUPS = [
  ["accessory", "Things to wear", "One at a time, on top of your picture."],
  ["frame", "Frames", "The ring around your picture, wherever it shows."],
  ["avatar", "Characters", "A new picture for your profile."]
];
const PART = { avatar: "id", accessory: "accessory", frame: "frame" };
const BARE = { accessory: null, frame: "none" };
// Shown wearing the item when the student hasn't chosen a picture yet: the Star.
const MODEL = "12";

function Price({ n }) {
  return (
    <span className="ns-shop-price">
      <Icon name="comet" size={15} /> {n}
    </span>
  );
}

export default function Shop() {
  const { token, user, login } = useStudentAuth();
  const { progress, refresh, burst } = useProgress();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [shop, setShop] = useState(null); // how chunks are earned and spent, and the recent ins and outs
  const [busy, setBusy] = useState(null); // the item being bought or put on

  const load = useCallback(() => {
    getShop(token)
      .then(setShop)
      .catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  if (!progress?.chunks) return <Loading />;
  const { balance, owned, items, novaCost } = progress.chunks;
  const mine = user?.avatar || null;
  const worn = { id: mine?.id || MODEL, accessory: mine?.accessory ?? null, frame: mine?.frame || "none" };

  async function buy(item) {
    const ok = await confirm({
      title: `Buy the ${item.name.toLowerCase()}?`,
      message: `It costs ${item.price} ${chunkWord(item.price)}. You will have ${balance - item.price} left.`,
      confirmLabel: "Buy it",
      danger: false
    });
    if (!ok) return;
    setBusy(item.id);
    try {
      await buyShopItem(token, item.id);
      burst();
      toast.success(`The ${item.name.toLowerCase()} is yours`);
      await refresh();
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Puts an item on the student's picture, or takes it off again.
  async function wear(item, on) {
    setBusy(item.id);
    try {
      const updated = await updateAvatar(token, { ...worn, [PART[item.kind]]: on ? item.value : BARE[item.kind] });
      login(token, updated);
      toast.success(on ? `You're wearing the ${item.name.toLowerCase()}` : `The ${item.name.toLowerCase()} is off`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ns-page ns-shop">
      <div className="ns-page-head">
        <div>
          <span className="ns-pill">COMET SHOP</span>
          <h1>Spend your comet chunks</h1>
          <p className="ns-sub">You earn comet chunks by studying and spend them here or on messages to Nova. They are a separate count from XP, which is never spent.</p>
        </div>
      </div>

      <div className="ns-shop-top">
        <section className="ns-card ns-shop-wallet" aria-label="Your comet chunks">
          <span className="ns-shop-coin">
            <Icon name="comet" size={34} />
          </span>
          <div>
            <b>{balance}</b>
            <span>{chunkWord(balance)} to spend</span>
          </div>
          <p>
            <Icon name="bolt" size={15} /> Your {progress.xp} XP is a different count. It sets your level and your league place and it stays yours.
          </p>
        </section>

        <section className="ns-card ns-shop-rules">
          <h3>How you earn them</h3>
          <ul>
            {(shop?.earn || []).map((r) => (
              <li key={r.label}>
                <b>+{r.chunks}</b>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
          <h3>What they pay for</h3>
          <ul>
            {(shop?.spend || []).map((r) => (
              <li key={r.label}>
                <b>{r.chunks}</b>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
          <p className="ns-muted ns-small">
            Free, always: Nova's hints while you solve a question, and every explanation. Only a message on the <Link to="/nova">Ask Nova</Link> page costs {novaCost} {chunkWord(novaCost)}.
          </p>
        </section>
      </div>

      {!mine && (
        <p className="ns-shop-note">
          <Icon name="users" size={18} />
          <span>You haven't chosen a profile picture yet, so there is nothing to wear these on. The Star is modelling them for now.</span>
          <Link to="/profile" className="ns-pill-btn">
            Choose a picture
          </Link>
        </p>
      )}

      {GROUPS.map(([kind, title, about]) => {
        const group = items.filter((i) => i.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind}>
            <div className="ns-section-head">
              <h2>{title}</h2>
              <span className="ns-muted">{about}</span>
            </div>
            <div className="ns-shop-grid">
              {group.map((item) => {
                const have = owned.includes(item.id);
                const on = have && mine?.[PART[kind]] === item.value;
                const short = item.price - balance;
                return (
                  <article key={item.id} className={`ns-shop-item ${have ? "owned" : ""}`}>
                    <Avatar avatar={{ ...worn, [PART[kind]]: item.value }} size={92} title={`${item.name} on ${mine ? "your picture" : "the Star"}`} />
                    <b>{item.name}</b>
                    {have ? (
                      <span className="ns-shop-owned">
                        <Icon name="check" size={14} /> {on ? "Wearing it" : "Yours"}
                      </span>
                    ) : (
                      <Price n={item.price} />
                    )}
                    {!have ? (
                      <button type="button" className="ns-btn ns-btn-primary ns-btn-sm" disabled={short > 0 || busy === item.id} onClick={() => buy(item)}>
                        {busy === item.id ? "Buying…" : short > 0 ? `${short} more to go` : "Buy"}
                      </button>
                    ) : !mine && kind !== "avatar" ? (
                      <Link to="/profile" className="ns-btn ns-btn-soft ns-btn-sm">
                        Choose a picture
                      </Link>
                    ) : (
                      <button type="button" className={`ns-btn ns-btn-sm ${on ? "ns-btn-outline" : "ns-btn-soft"}`} disabled={busy === item.id || (on && kind === "avatar")} onClick={() => wear(item, !on)}>
                        {on ? "Take it off" : "Wear it"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {shop?.log?.length > 0 && (
        <section className="ns-card">
          <h3>Lately</h3>
          <ul className="ns-shop-log">
            {shop.log.slice(0, 10).map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span>{e.why}</span>
                <small>{new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
                <b className={e.n < 0 ? "out" : "in"}>
                  {e.n > 0 ? "+" : "−"}
                  {Math.abs(e.n)}
                </b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
