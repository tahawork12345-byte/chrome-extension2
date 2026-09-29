/* ATLAS NEW TAB — alarm sounds
   The built-in alarms are synthesised with Web Audio (no files to ship).
   A custom alarm sound is the user's own audio file, kept in IndexedDB
   next to the uploaded background. Used by alarm.html (the offscreen page
   the background worker rings from) and by the Reminders panel's preview. */

(function (root) {
  "use strict";

  const BUILTIN = [
    { id: "chime", label: "Chime" },
    { id: "bell", label: "Bell" },
    { id: "digital", label: "Digital" },
    { id: "pulse", label: "Soft pulse" },
  ];

  /* each pattern schedules one bar at time t and returns its length (s) */
  function tone(ctx, out, t, freq, dur, type, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak || 0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const PATTERNS = {
    /* a rising three-note arpeggio with a soft overtone */
    chime(ctx, out, t) {
      [659.25, 830.61, 987.77].forEach((f, i) => {
        tone(ctx, out, t + i * 0.18, f, 1.1, "sine", 0.45);
        tone(ctx, out, t + i * 0.18, f * 2, 0.5, "sine", 0.08);
      });
      return 1.6;
    },
    /* a struck bell: inharmonic partials, long decay */
    bell(ctx, out, t) {
      [[523.25, 0.5, 2.2], [1316, 0.18, 1.2], [1864, 0.1, 0.8], [2698, 0.05, 0.5]].forEach(([f, p, d]) =>
        tone(ctx, out, t, f, d, "sine", p));
      return 2.2;
    },
    /* the classic bedside alarm: four quick beeps, then a pause */
    digital(ctx, out, t) {
      for (let i = 0; i < 4; i++) tone(ctx, out, t + i * 0.14, 2093, 0.09, "square", 0.16);
      return 1.0;
    },
    /* a gentle swell for quiet rooms */
    pulse(ctx, out, t) {
      tone(ctx, out, t, 440, 0.9, "triangle", 0.35);
      tone(ctx, out, t + 0.45, 554.37, 0.9, "triangle", 0.3);
      return 1.8;
    },
  };

  /* ---------- the custom sound (IndexedDB "atlas" / "media") ---------- */
  const SOUND_KEY = "alarm-sound";
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("atlas", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("media");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function run(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const tx = d.transaction("media", mode);
      const req = fn(tx.objectStore("media"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    }));
  }
  const getCustom = () => run("readonly", (s) => s.get(SOUND_KEY)).catch(() => null);
  const setCustom = (blob) => run("readwrite", (s) => s.put(blob, SOUND_KEY));
  const clearCustom = () => run("readwrite", (s) => s.delete(SOUND_KEY)).catch(() => {});

  /* ---------- playback ----------
     play(id, { volume 0-100, loop, maxMs }) -> Promise<stop()>. A missing
     custom file falls back to the chime. */
  async function play(id, opts) {
    const o = Object.assign({ volume: 80, loop: false, maxMs: 60000 }, opts);
    const vol = Math.max(0, Math.min(1, o.volume / 100));
    let stopped = false;
    let timer = 0;
    let cleanup = () => {};
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      cleanup();
    };

    if (id === "custom") {
      const blob = await getCustom();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.loop = !!o.loop;
        audio.volume = vol;
        cleanup = () => { audio.pause(); URL.revokeObjectURL(url); };
        audio.addEventListener("ended", () => { if (!o.loop) stop(); });
        try { await audio.play(); } catch { stop(); }
        timer = setTimeout(stop, o.maxMs);
        return stop;
      }
      id = "chime";
    }

    const pattern = PATTERNS[id] || PATTERNS.chime;
    const ctx = new (root.AudioContext || root.webkitAudioContext)();
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(ctx.destination);
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
    let t = ctx.currentTime + 0.05;
    let bars = 0;
    /* schedule a bar at a time, a little ahead, so stop() is prompt */
    const loop = () => {
      if (stopped) return;
      while (t < ctx.currentTime + 1.5) {
        t += pattern(ctx, out, t) + (o.loop ? 0.35 : 0);
        bars++;
        if (!o.loop && bars >= 1) break;
      }
      if (o.loop) timer = setTimeout(loop, 400);
      else timer = setTimeout(stop, (t - ctx.currentTime) * 1000 + 200);
    };
    cleanup = () => { out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => ctx.close().catch(() => {}), 250); };
    loop();
    if (o.loop) setTimeout(stop, o.maxMs);
    return stop;
  }

  root.AtlasSounds = { BUILTIN, play, getCustom, setCustom, clearCustom };
})(globalThis);
