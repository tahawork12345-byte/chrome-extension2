/* ATLAS NEW TAB — media bridge (runs in the page's own JS world)
   Any site that plays music through the Media Session API (Spotify,
   YouTube Music, YouTube, SoundCloud, Deezer, Apple Music, ...) exposes its
   track info and its own next / previous / play handlers there. This script
   reads that, and keeps a copy of the handlers so the new tab can press
   the site's own buttons. Sites that don't use it still get picked up from
   their playing <audio>/<video> element, with the title and artwork taken
   from the page. Runs in every frame, so embedded players count too. media-relay.js carries the messages to the
   extension. */
(() => {
  "use strict";
  if (window.__atlasMediaBridge) return;
  window.__atlasMediaBridge = true;

  const ms = navigator.mediaSession || { setActionHandler() {}, metadata: null, playbackState: "none" };
  const TAG = "atlas-media";

  /* remember the handlers the site registers so they can be invoked later */
  const handlers = {};
  const setHandler = ms.setActionHandler.bind(ms);
  ms.setActionHandler = function (action, fn) {
    handlers[action] = fn;
    return setHandler(action, fn);
  };

  /* sites that don't use an <audio>/<video> in the DOM report progress here */
  let posState = null;
  if (ms.setPositionState) {
    const setPos = ms.setPositionState.bind(ms);
    ms.setPositionState = function (s) {
      posState = s && s.duration
        ? { duration: s.duration, position: s.position || 0, rate: s.playbackRate || 1, at: Date.now() }
        : null;
      return setPos(s);
    };
  }

  /* <audio>/<video> elements, including ones created with `new Audio()`
     that never get attached to the DOM (caught through their play event) */
  const detached = new Set();
  document.addEventListener("play", (e) => {
    const m = e.target;
    if (m instanceof HTMLMediaElement && !m.isConnected) detached.add(m);
    setTimeout(send, 0);
  }, true);
  document.addEventListener("pause", () => setTimeout(send, 0), true);
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!this.isConnected) detached.add(this);
    setTimeout(send, 0);
    return origPlay.apply(this, arguments);
  };

  /* a muted autoplaying background loop or a tiny preview isn't "playing" */
  function audible(m) {
    return !m.muted && m.volume > 0 && !(isFinite(m.duration) && m.duration > 0 && m.duration < 8);
  }

  function allMedia() {
    const list = Array.from(document.querySelectorAll("audio, video"));
    detached.forEach((m) => { if (!list.includes(m)) list.push(m); });
    return list;
  }

  function mediaEl() {
    const all = allMedia();
    return all.find((m) => !m.paused && audible(m)) ||
      all.find((m) => !m.paused) ||
      all.find((m) => m.currentTime > 0 && audible(m)) ||
      all.find((m) => m.currentTime > 0) || null;
  }

  /* for sites that never fill in navigator.mediaSession: build the track
     info from the page itself */
  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") || "" : "";
  }
  function abs(u) {
    try { return u ? new URL(u, location.href).href : ""; } catch { return ""; }
  }
  function pageMetadata(m) {
    let title = meta("og:title") || meta("twitter:title") || document.title || "";
    title = title.replace(/^\(\d+\)\s*/, "").trim();
    const host = location.hostname.replace(/^www\./, "");
    const site = meta("og:site_name") || host;
    /* "Song name - Site" / "Song name | Site" -> "Song name" */
    const parts = title.split(/\s+[-|–—•]\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1].toLowerCase();
      if (last.includes(site.toLowerCase()) || site.toLowerCase().includes(last) || host.includes(last.replace(/\s+/g, ""))) {
        parts.pop();
        title = parts.join(" - ");
      }
    }
    if (!title && m) {
      const src = m.currentSrc || m.src || "";
      try { title = decodeURIComponent(new URL(src).pathname.split("/").pop() || ""); } catch {}
    }
    if (!title) title = site;
    return {
      title,
      artist: meta("og:audio:artist") || meta("music:musician") || meta("author") || site,
      album: "",
      art: abs(meta("og:image") || meta("twitter:image") || (m && m.poster) || ""),
    };
  }

  function bestArt(list) {
    if (!list || !list.length) return "";
    let best = list[list.length - 1];
    let bestSize = 0;
    list.forEach((a) => {
      const n = parseInt(String(a.sizes || "").split("x")[0], 10) || 0;
      if (n > bestSize) { bestSize = n; best = a; }
    });
    try { return new URL(best.src, location.href).href; } catch { return ""; }
  }

  function isPlaying(m) {
    if (ms.metadata) {
      if (ms.playbackState === "playing") return true;
      if (ms.playbackState === "paused") return false;
    }
    return !!(m && !m.paused);
  }

  function snapshot() {
    const m = mediaEl();
    let info;
    const md = ms.metadata;
    if (md && md.title) {
      info = { title: md.title, artist: md.artist || "", album: md.album || "", art: bestArt(md.artwork) };
    } else {
      /* no Media Session: only report a real, audible element that has
         actually been started, never an idle or muted one */
      if (!m || !audible(m) || (m.paused && m.currentTime === 0)) return null;
      info = pageMetadata(m);
    }
    const playing = isPlaying(m);

    let duration = 0, position = 0, rate = 1;
    if (m && isFinite(m.duration) && m.duration > 0) {
      duration = m.duration; position = m.currentTime; rate = m.playbackRate || 1;
    } else if (posState) {
      duration = posState.duration;
      rate = posState.rate;
      position = posState.position + (playing ? ((Date.now() - posState.at) / 1000) * rate : 0);
      position = Math.min(position, duration);
    }

    return {
      title: info.title,
      artist: info.artist,
      album: info.album,
      art: info.art,
      playing,
      duration,
      position,
      rate,
      at: Date.now(),
      can: {
        prev: !!handlers.previoustrack || !!m,
        next: !!handlers.nexttrack,
        seek: !!handlers.seekto || !!(m && duration),
      },
    };
  }

  let lastKey = "";
  let lastSent = 0;
  function send(force) {
    const s = snapshot();
    const key = s
      ? [s.title, s.artist, s.art, s.playing, Math.round(s.duration), s.can.prev, s.can.next].join("|")
      : "";
    const now = Date.now();
    /* on any change, plus a periodic resync while playing so the progress
       bar on the new tab doesn't drift */
    if (!force && key === lastKey && !(s && s.playing && now - lastSent > 5000)) return;
    if (!force && !s && !lastKey) return;
    lastKey = key;
    lastSent = now;
    window.postMessage({ [TAG]: "state", data: s }, "*");
  }
  setInterval(send, 1000);

  function run(action, time) {
    const m = mediaEl();
    const call = (name, extra) => {
      const fn = handlers[name];
      if (typeof fn !== "function") return false;
      try { fn(Object.assign({ action: name }, extra)); } catch {}
      return true;
    };
    if (action === "toggle") action = isPlaying(m) ? "pause" : "play";

    if (action === "play") { if (!call("play") && m) m.play().catch(() => {}); }
    else if (action === "pause") { if (!call("pause") && m) m.pause(); }
    else if (action === "next") call("nexttrack");
    else if (action === "prev") { if (!call("previoustrack") && m) m.currentTime = 0; }
    else if (action === "seek" && isFinite(time)) {
      if (!call("seekto", { seekTime: time, fastSeek: false }) && m) m.currentTime = time;
    }
    setTimeout(() => send(true), 350);
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data[TAG] === "cmd") run(e.data.action, e.data.time);
    else if (e.data[TAG] === "resync") send(true);
  });
})();
