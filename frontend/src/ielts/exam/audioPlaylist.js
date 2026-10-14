// The four listening parts come from different source tests (per-candidate
// shuffle). They are downloaded completely before the test starts, then
// played back-to-back as one continuous recording the candidate cannot pause.

export async function downloadAudio(urls, onProgress) {
  const totals = urls.map(() => 0);
  const loaded = urls.map(() => 0);
  const report = () => {
    const total = totals.reduce((a, b) => a + b, 0);
    const done = loaded.reduce((a, b) => a + b, 0);
    onProgress(total ? Math.min(100, Math.floor((done / total) * 100)) : 0);
  };
  return Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("The listening audio could not be loaded. Please tell the invigilator.");
      totals[i] = Number(res.headers.get("content-length")) || 0;
      const type = res.headers.get("content-type") || "audio/mpeg";
      if (!res.body || !totals[i]) {
        const blob = await res.blob();
        totals[i] = loaded[i] = blob.size;
        report();
        return blob;
      }
      const reader = res.body.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded[i] += value.length;
        report();
      }
      return new Blob(chunks, { type });
    })
  );
}

export class Playlist {
  constructor(blobs, fallbackDurations = []) {
    this.items = blobs.map((blob, i) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = URL.createObjectURL(blob);
      return { audio, duration: fallbackDurations[i] || 0 };
    });
    this.index = -1;
    this.volume = 0.8;
    this.partListeners = new Set();
    this.blockedListeners = new Set();
    this.destroyed = false;
  }

  async ready() {
    await Promise.all(
      this.items.map(
        (item) =>
          new Promise((resolve) => {
            const done = () => {
              if (Number.isFinite(item.audio.duration) && item.audio.duration > 0) item.duration = item.audio.duration;
              resolve();
            };
            if (item.audio.readyState >= 1) done();
            else {
              item.audio.addEventListener("loadedmetadata", done, { once: true });
              item.audio.addEventListener("error", () => resolve(), { once: true });
            }
          })
      )
    );
    return this;
  }

  get totalDuration() {
    return this.items.reduce((sum, it) => sum + (it.duration || 0), 0);
  }

  onPart(cb) {
    this.partListeners.add(cb);
    return () => this.partListeners.delete(cb);
  }

  onBlocked(cb) {
    this.blockedListeners.add(cb);
    return () => this.blockedListeners.delete(cb);
  }

  // Starts playback `offset` seconds into the joined recording (used to resume after a refresh).
  start(offset = 0) {
    let acc = 0;
    for (let i = 0; i < this.items.length; i++) {
      const d = this.items[i].duration || 0;
      if (offset < acc + d) {
        this.playAt(i, offset - acc);
        return;
      }
      acc += d;
    }
    this.stopCurrent();
    this.index = -1;
  }

  playAt(i, time) {
    if (this.destroyed) return;
    this.stopCurrent();
    this.index = i;
    const { audio } = this.items[i];
    audio.volume = this.volume;
    audio.currentTime = Math.max(0, time);
    audio.onended = () => {
      if (i + 1 < this.items.length) this.playAt(i + 1, 0);
      else {
        this.index = -1;
        this.partListeners.forEach((cb) => cb(-1));
      }
    };
    audio.play().catch((err) => this.handlePlayError(err));
    this.partListeners.forEach((cb) => cb(i));
  }

  // Only a real autoplay refusal needs the candidate to click; an AbortError just
  // means this play() was superseded by a newer one.
  handlePlayError(err) {
    if (err?.name === "NotAllowedError") this.blockedListeners.forEach((cb) => cb());
  }

  resume() {
    const item = this.items[this.index];
    item?.audio.play().catch((err) => this.handlePlayError(err));
  }

  stopCurrent() {
    const item = this.items[this.index];
    if (item) {
      item.audio.onended = null;
      item.audio.pause();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    for (const it of this.items) it.audio.volume = this.volume;
  }

  destroy() {
    this.destroyed = true;
    this.stopCurrent();
    for (const it of this.items) {
      it.audio.pause();
      URL.revokeObjectURL(it.audio.src);
      it.audio.removeAttribute("src");
    }
    this.partListeners.clear();
    this.blockedListeners.clear();
  }
}
