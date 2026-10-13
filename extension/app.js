/* ATLAS NEW TAB — app logic
   All user-editable content lives in config.js                */

(() => {
  "use strict";

  /* border light for cards; same markup as the one inside the search form */
  const TRACE_SVG =
    '<svg class="trace" aria-hidden="true">' +
    '<rect class="trace-line" pathLength="100"/></svg>';

  /* ---------- storage (chrome.storage.local with localStorage fallback) --- */
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const store = {
    get(keys) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.get(keys, r));
      const out = {};
      keys.forEach((k) => {
        const v = localStorage.getItem("atlas:" + k);
        if (v !== null) out[k] = v;
      });
      return Promise.resolve(out);
    },
    set(obj) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.set(obj, r));
      Object.entries(obj).forEach(([k, v]) => localStorage.setItem("atlas:" + k, v));
      return Promise.resolve();
    },
  };

  const $ = (id) => document.getElementById(id);

  /* appearance + widget settings (customize.js). Style is applied there;
     this file only reads the settings that change behaviour. */
  const AS = window.AtlasSettings;

  /* ================= CLOCK (12- or 24-hour) ============================== */
  const timeEl = $("time");
  const meridiemEl = $("meridiem");
  const dateEl = $("date");
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function renderClock(animate = false) {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    const h24 = AS.get().widgets.clock.h24;
    h = h24 ? String(h).padStart(2, "0") : h % 12 || 12;
    const next = `${h}:${m}`;
    if (animate && timeEl.textContent !== next) {
      timeEl.classList.remove("is-tick");
      void timeEl.offsetWidth; // restart the animation
      timeEl.classList.add("is-tick");
    }
    timeEl.textContent = next;
    meridiemEl.textContent = ap;
    dateEl.textContent = `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  renderClock();
  // tick exactly on the next minute, then every minute
  setTimeout(function tick() {
    renderClock(true);
    setInterval(() => renderClock(true), 60000);
  }, (60 - new Date().getSeconds()) * 1000);

  /* the rail and launcher sit below the clock block; its height depends on
     the clamped font sizes and the weather card, so measure the real thing
     instead of guessing an offset */
  const clockEl = document.querySelector(".clock");
  function syncClockHeight() {
    if (!clockEl) return;
    const h = Math.ceil(clockEl.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty("--clock-h", h + "px");
  }
  syncClockHeight();
  addEventListener("resize", syncClockHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncClockHeight);
  if (clockEl && typeof ResizeObserver !== "undefined") new ResizeObserver(syncClockHeight).observe(clockEl);

  /* ================= WALLPAPER ===========================================
     The background is one of: a built-in live wallpaper, one from the
     online library (library.js: a 4K image or a Pixabay video, shown
     from their servers), the user's own uploaded image / video, a solid
     colour or a gradient (Customize > Background).

     Two video layers and two image layers, each in a .wp-slot. A new
     wallpaper is loaded first, then its layer comes up over the old one,
     fading in as it settles from a slight zoom; the old one drops only once
     covered, so a switch never flashes black. An online image with a small
     preview shows that at once, blurred, and sharpens when the full picture
     has arrived. The image and colour layers sit above the videos. */
  const layers = [$("videoA"), $("videoB")];
  const imgs = [$("wpImage"), $("wpImageB")];
  const wallEl = document.querySelector(".wallpaper");
  const wpFill = $("wpFill");
  const SETTLE = 1600;  // ms: the incoming layer's fade and settle (style.css)
  let front = 0;        // the video layer on screen
  let imgFront = 0;     // the image layer on screen
  let currentWp = null;
  let shownVideo = "";  // src the video layers are showing, "" when none
  let shownImage = "";  // likewise for the image layers
  let loadingVideo = ""; // src on its way in, "" when none
  let loadingImage = "";
  let want = null;      // what the latest applyBackground asked for
  let videoHideTimer = 0;
  let imageHideTimer = 0;
  let upload = { id: 0, url: "", kind: "" }; // the uploaded file, as an object URL
  let bgToken = 0;      // drops stale async loads when settings change fast

  function playSafe(v) {
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* online live wallpapers are big 4K files (often 100+ MB). Waiting for
     the whole file before showing anything took minutes, so instead:
       1. its thumbnail goes up at once, softly blurred (applyBackground);
       2. a light preview clip (720p/1080p, from the server) streams and
          plays within a second or two;
       3. the full 4K file downloads behind it into Cache Storage, by one
          tab at a time, and then takes over from the clip with a crossfade.
     Next time the cached file plays straight from disk, with no stalls and
     no fetching it again on every loop.
     The file kept is the one the screen can use: on a screen under ~2K
     pixels wide a 4K file looks no sharper than full HD, but is 4–5× the
     download and the decoding, so the full-HD copy (`hd`) is kept there. */
  const VIDEO_CACHE = "atlas-live-videos";
  const VIDEO_CACHE_MAX = 3; // files kept on disk
  const videoBlobs = new Set(); // object URLs made here, revoked on unload
  const isOnline = (src) => /^https:\/\//.test(src) && typeof caches !== "undefined";
  const BIG_SCREEN = (screen.width || 0) * (window.devicePixelRatio || 1) > 2200;
  const keepFile = (src, hd) => (hd && !BIG_SCREEN ? hd : src);

  /* the wallpaper on screen has run out of data and is waiting for more */
  const starving = () => layers.some((v) => v.classList.contains("is-active") && v.src && !v.paused && !v.error && v.readyState < 3);

  /* the download yields to playback: while the clip on screen waits for
     data it stops reading (the connection goes to the clip), and picks up
     again once it plays. Two downloads sharing the line was what made a new
     live wallpaper stutter until the full file had arrived. */
  function yielding(res) {
    if (!res.body) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream({
      async pull(ctl) {
        /* not forever: a clip that never recovers shouldn't hold it up */
        for (let i = 0; i < 50 && starving(); i++) await new Promise((r) => setTimeout(r, 300));
        const { done, value } = await reader.read();
        if (done) ctl.close();
        else ctl.enqueue(value);
      },
      cancel: (why) => reader.cancel(why),
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  }

  /* the full file from Cache Storage as an object URL, or "" */
  async function cachedVideo(src) {
    if (!isOnline(src)) return "";
    try {
      const res = await (await caches.open(VIDEO_CACHE)).match(src);
      if (!res) return "";
      let blob = await res.blob();
      /* some hosts send it as a download (application/octet-stream) */
      if (!/^video\//.test(blob.type)) blob = new Blob([blob], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      videoBlobs.add(url);
      return url;
    } catch (_) {
      return "";
    }
  }

  /* downloads the full file into the cache; true once it's there. A Web
     Lock lets open tabs share one download: the others wait, then find it
     cached. */
  const caching = new Map();
  function cacheVideo(src) {
    if (!isOnline(src)) return Promise.resolve(false);
    if (caching.has(src)) return caching.get(src);
    const work = async () => {
      const cache = await caches.open(VIDEO_CACHE);
      if (await cache.match(src)) return true;
      const res = await fetch(src, { referrerPolicy: "no-referrer", priority: "low" });
      if (!res.ok) return false;
      await cache.put(src, yielding(res));
      const keys = await cache.keys(); // oldest first
      await Promise.all(keys.slice(0, Math.max(0, keys.length - VIDEO_CACHE_MAX)).map((k) => cache.delete(k)));
      return true;
    };
    const job = (navigator.locks ? navigator.locks.request("atlas-video:" + src, work) : work())
      .catch(() => false) // no room, or offline: keep streaming
      .finally(() => caching.delete(src));
    caching.set(src, job);
    return job;
  }

  /* once the 4K file is cached, it takes over from the clip on screen at
     the same moment, fading in on the other layer */
  async function upgradeVideo(src, keep) {
    /* a head start: the clip gets the line to itself until it can play
       through, before the full file starts coming in behind it */
    await playsThrough(layers[front], 8000);
    if (shownVideo !== src || loadingVideo) return;
    if (!(await cacheVideo(keep)) || shownVideo !== src || loadingVideo) return;
    const url = await cachedVideo(keep);
    if (!url) return;
    const cur = layers[front];
    const next = layers[1 - front];
    if (shownVideo !== src || loadingVideo) return dropBlob(url);
    next.src = url;
    playSafe(next);
    const ok = await videoReady(next, 20000);
    if (next.src !== url) return; // another wallpaper took this layer
    if (ok !== true || shownVideo !== src || loadingVideo || layers[front] !== cur) {
      if (!next.classList.contains("is-active")) unloadVideo(next);
      return;
    }
    if (cur.duration && next.duration) {
      next.currentTime = cur.currentTime % next.duration;
      await new Promise((r) => { next.addEventListener("seeked", r, { once: true }); setTimeout(r, 1500); });
      if (shownVideo !== src || loadingVideo || layers[front] !== cur) return;
    }
    front = 1 - front;
    raise(next, cur, false);
    /* the same picture on both, so a short handover is enough; two videos
       decoding at once is the costly part */
    setTimeout(() => {
      if (layers[front] === cur) return;
      cur.classList.remove("is-active");
      unloadVideo(cur);
    }, 1000);
  }

  /* resolves once `v` has enough to play to the end, or after `ms` */
  function playsThrough(v, ms) {
    return new Promise((resolve) => {
      if (!v || v.readyState >= 4) return resolve();
      const done = () => {
        clearTimeout(t);
        v.removeEventListener("canplaythrough", done);
        resolve();
      };
      const t = setTimeout(done, ms);
      v.addEventListener("canplaythrough", done);
    });
  }

  /* a tab nobody is looking at waits, so it doesn't share the connection
     with the one that is */
  const whenVisible = () => new Promise((resolve) => {
    if (!document.hidden) return resolve();
    const on = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", on);
      resolve();
    };
    document.addEventListener("visibilitychange", on);
  });

  function dropBlob(url) {
    if (!videoBlobs.has(url)) return;
    videoBlobs.delete(url);
    URL.revokeObjectURL(url);
  }

  function unloadVideo(v) {
    const was = v.src;
    v.pause();
    v.removeAttribute("src");
    v.load();
    dropBlob(was);
  }

  /* resolves once the video can play: true, false when it failed, null
     when it took too long */
  function videoReady(v, ms = 12000) {
    return new Promise((resolve) => {
      if (v.readyState >= 3) return resolve(true);
      const done = (e) => {
        clearTimeout(t);
        v.removeEventListener("canplay", done);
        v.removeEventListener("error", done);
        resolve(e ? e.type === "canplay" : null);
      };
      const t = setTimeout(done, ms);
      v.addEventListener("canplay", done);
      v.addEventListener("error", done);
    });
  }

  /* downloads and decodes a picture, so it appears whole */
  function imageReady(src) {
    const im = new Image();
    im.referrerPolicy = "no-referrer";
    im.src = src;
    return im.decode().then(() => true, () => false);
  }

  /* the thin line at the top while a wallpaper is on its way; Customize
     listens too (a spinner on the picked card) */
  function syncLoading() {
    const on = !!(loadingVideo || loadingImage);
    if (wallEl.classList.contains("is-loading") === on) return;
    wallEl.classList.toggle("is-loading", on);
    document.dispatchEvent(new CustomEvent("atlas:wallpaper", { detail: { loading: on } }));
  }

  const slot = (el) => el.parentElement;
  /* `el` comes up over `other`; `animate` plays the fade-and-settle */
  function raise(el, other, animate) {
    if (other && other !== el) slot(other).classList.remove("is-top");
    const s = slot(el);
    s.classList.add("is-top");
    s.classList.remove("is-entering");
    if (animate) {
      void s.offsetWidth; // restart the animation
      s.classList.add("is-entering");
    }
    el.classList.add("is-active");
  }

  /* false when the wallpaper changed again before this one was ready.
     `light`: an online video's preview clip, streamed until the full file
     is cached; `hd`: its full-HD copy, kept instead of the 4K one on a
     screen that can't show 4K */
  async function showVideo(src, instant, light, hd) {
    if (shownVideo === src) return true;
    if (loadingVideo === src) return false; // already on its way
    clearTimeout(videoHideTimer);
    const cur = layers[front];
    const next = shownVideo ? layers[1 - front] : cur;
    loadingVideo = src;
    syncLoading();
    const stale = () => loadingVideo !== src || !want || want.video !== src;
    const online = isOnline(src);
    const keep = online ? keepFile(src, hd) : src;
    /* either size, if it was kept before (a 4K file from another screen) */
    const cached = online ? (await cachedVideo(keep)) || (keep !== src && !stale() ? await cachedVideo(src) : "") : "";
    if (stale()) {
      dropBlob(cached);
      if (loadingVideo === src) { loadingVideo = ""; syncLoading(); }
      return false;
    }
    /* not cached yet: stream, starting on the light clip */
    const tries = cached ? [cached] : online ? [...new Set([light, keep, src].filter(Boolean))] : [src];
    let ok = null;
    for (const play of tries) {
      if (stale()) break;
      next.src = play;
      playSafe(next);
      ok = instant && !online ? true : await videoReady(next);
      if (ok !== false) break; // playing, or just slow: keep it
    }
    /* the host won't stream to the page: download it whole, as a last resort */
    if (ok === false && online && !cached && !stale() && (await cacheVideo(keep)) && !stale()) {
      const url = await cachedVideo(keep);
      if (url) {
        next.src = url;
        playSafe(next);
        await videoReady(next);
      }
    }
    if (stale()) {
      if (loadingVideo === src) { loadingVideo = ""; syncLoading(); }
      if (!next.classList.contains("is-active")) unloadVideo(next);
      return false;
    }
    loadingVideo = "";
    syncLoading();
    shownVideo = src;
    if (next !== cur) front = 1 - front;
    raise(next, next === cur ? null : cur, !instant);
    if (next !== cur) {
      setTimeout(() => {
        if (layers[front] === cur) return; // switched back meanwhile
        cur.classList.remove("is-active");
        unloadVideo(cur);
      }, SETTLE);
    }
    if (online && !videoBlobs.has(next.src)) upgradeVideo(src, keep);
    return true;
  }

  function hideVideo() {
    loadingVideo = "";
    syncLoading();
    if (!shownVideo) return;
    shownVideo = "";
    layers.forEach((v) => v.classList.remove("is-active"));
    /* let the fade finish before dropping the frames */
    clearTimeout(videoHideTimer);
    videoHideTimer = setTimeout(() => {
      if (!shownVideo && !loadingVideo) layers.forEach(unloadVideo);
    }, 1000);
  }

  /* `soft`: keep it blurred (a live wallpaper's thumbnail, until the video
     comes) */
  async function showImage(src, preview, instant, soft) {
    if (shownImage === src) return true;
    if (loadingImage === src) return false;
    clearTimeout(imageHideTimer);
    const cur = imgs[imgFront];
    const next = cur.classList.contains("is-active") ? imgs[1 - imgFront] : cur;
    const stale = () => !want || want.image !== src || loadingImage !== src;
    const bringIn = () => {
      imgFront = imgs.indexOf(next);
      raise(next, cur, !instant);
      if (next !== cur) {
        setTimeout(() => { if (imgs[imgFront] !== cur) cur.classList.remove("is-active"); }, SETTLE);
      }
    };
    loadingImage = src;
    syncLoading();
    let shown = false;
    /* blur-up: the preview first, if it comes quickly */
    if (preview && preview !== src && (await imageReady(preview)) && !stale()) {
      next.classList.add("is-preview");
      next.src = preview;
      bringIn();
      shown = true;
    }
    const ok = await imageReady(src);
    if (stale()) return false;
    loadingImage = "";
    syncLoading();
    if (!ok && !shown) return false; // keep what's on screen
    shownImage = src;
    if (ok) next.src = src;
    if (shown) requestAnimationFrame(() => next.classList.toggle("is-preview", !!soft));
    else {
      next.classList.toggle("is-preview", !!soft);
      bringIn();
    }
    return true;
  }

  function hideImages() {
    loadingImage = "";
    syncLoading();
    if (!shownImage) return;
    shownImage = "";
    imgs.forEach((i) => i.classList.remove("is-active"));
    clearTimeout(imageHideTimer);
    imageHideTimer = setTimeout(() => {
      if (shownImage || loadingImage) return;
      imgs.forEach((i) => { i.removeAttribute("src"); i.classList.remove("is-preview"); });
    }, 1000);
  }

  function builtInFile() {
    const wp = WALLPAPERS.find((w) => w.id === currentWp) || WALLPAPERS[0];
    return wp ? wp.file : "";
  }

  /* the uploaded file, read once per upload and kept as an object URL */
  async function uploadedMedia(id) {
    if (upload.id === id && upload.url) return upload;
    const blob = await AS.media.get();
    if (upload.url) URL.revokeObjectURL(upload.url);
    upload = blob
      ? { id, url: URL.createObjectURL(blob), kind: /^video\//.test(blob.type) ? "video" : "image" }
      : { id: 0, url: "", kind: "" };
    return upload;
  }

  /* bring the page background in line with the settings */
  async function applyBackground(instant) {
    const bg = AS.get().background;
    const token = ++bgToken;
    let video = "";
    let image = "";
    let preview = "";
    let light = "";  // an online video's quick-start clip
    let hd = "";     // its full-HD copy, for screens that can't show 4K
    let poster = ""; // and its thumbnail, shown while it comes
    let fill = "";

    if (bg.mode === "color") fill = bg.color;
    else if (bg.mode === "gradient") fill = `linear-gradient(${bg.gradAngle}deg, ${bg.gradA}, ${bg.gradB})`;
    else if (bg.mode === "online" && /^https:\/\//.test(bg.online.src)) {
      if (bg.online.kind === "video") {
        video = bg.online.src;
        if (/^https:\/\//.test(bg.online.preview)) light = bg.online.preview;
        if (/^https:\/\//.test(bg.online.hd)) hd = bg.online.hd;
        if (/^https:\/\//.test(bg.online.thumb)) poster = bg.online.thumb;
      } else {
        image = bg.online.src;
        if (/^https:\/\//.test(bg.online.thumb)) preview = bg.online.thumb;
      }
    } else if (bg.mode === "upload" && bg.customId) {
      const file = await uploadedMedia(bg.customId);
      if (token !== bgToken) return;
      if (file.kind === "video") video = file.url;
      else if (file.kind === "image") image = file.url;
    }
    /* nothing else to show (or the upload went missing): the live wallpaper */
    if (!video && !image && !fill) video = builtInFile();

    const rate = Math.min(2, Math.max(0.25, (bg.speed || 100) / 100));
    layers.forEach((v) => {
      v.defaultPlaybackRate = rate; // survives a src change
      v.playbackRate = rate;
    });

    if (video && isOnline(video) && video !== shownVideo && document.hidden) {
      await whenVisible();
      if (token !== bgToken) return;
    }

    want = { video, image: image || poster };
    const still = () => want.video === video && want.image === (image || poster);
    /* a moving wallpaper: style.css drops the glass blurs that would be
       redrawn on every one of its frames */
    document.body.classList.toggle("wp-live", !!video && !fill);
    /* a colour covers everything at once; otherwise it stays up until the
       new picture is ready underneath */
    if (fill) {
      wpFill.style.background = fill;
      wpFill.classList.add("is-active");
      hideImages();
      hideVideo();
      return;
    }
    if (video) {
      if (poster && video !== shownVideo) {
        showImage(poster, "", instant, true).then((up) => {
          if (up && still() && shownVideo !== video) wpFill.classList.remove("is-active");
        });
      }
      if (!(await showVideo(video, instant, light, hd)) || !still()) return;
      wpFill.classList.remove("is-active");
      hideImages(); // fades out over the video, which is ready underneath
    } else {
      if (!(await showImage(image, preview, instant)) || !still()) return;
      wpFill.classList.remove("is-active");
      hideVideo();
    }
  }

  /* pick a built-in wallpaper; also switches the background back to it.
     A pick by hand holds off the schedule until its next change. */
  function setWallpaper(id, instant = false, scheduled = false) {
    const wp = WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
    if (!wp) return;
    currentWp = wp.id;
    store.set({ wallpaper: wp.id });
    if (!scheduled) markManual();
    wpScheduling = scheduled;
    if (AS.get().background.mode !== "video") AS.set("background.mode", "video"); // re-applies via the listener
    else applyBackground(instant);
    wpScheduling = false;
  }
  AS.app.setWallpaper = (id) => setWallpaper(id);

  /* --- wallpaper schedule (Customize > Background > Schedule) -----------
     Each rule says "from this moment, show this wallpaper". The rule whose
     latest occurrence is most recent is in charge — unless the user picked
     a background by hand after it, which then holds until the next change.
     Checked every 20 s and whenever the tab comes back into view. */
  const WP_MANUAL_KEY = "wallpaperManualAt";
  let wpManualAt = 0;
  let wpScheduling = false; // true while the schedule itself changes things

  function markManual() {
    wpManualAt = Date.now();
    store.set({ [WP_MANUAL_KEY]: String(wpManualAt) });
  }

  function scheduledWallpaper(now) {
    const bg = AS.get().background;
    if (!bg.scheduleOn || typeof AtlasSchedule === "undefined") return null;
    let best = null;
    bg.schedule.forEach((r) => {
      if (!r.enabled || !WALLPAPERS.some((w) => w.id === r.wallpaper)) return;
      const t = AtlasSchedule.last(r, now);
      if (t != null && (!best || t > best.t)) best = { t, id: r.wallpaper };
    });
    return best && best.t > wpManualAt ? best : null;
  }

  function applyWallpaperSchedule(instant) {
    const hit = scheduledWallpaper(Date.now());
    /* a wallpaper a free account hasn't chosen (pro.js) is left out */
    const allowed = hit && (!window.AtlasPro || AtlasPro.canUseBuiltIn(hit.id));
    if (allowed && !(AS.get().background.mode === "video" && currentWp === hit.id)) setWallpaper(hit.id, instant, true);
    armWallpaperTimer();
  }

  /* a timer for the very next change, so it lands on the minute rather
     than up to 20 s late; the interval below is the safety net */
  let wpTimer = 0;
  function armWallpaperTimer() {
    clearTimeout(wpTimer);
    const bg = AS.get().background;
    if (!bg.scheduleOn || typeof AtlasSchedule === "undefined") return;
    const now = Date.now();
    let soonest = null;
    bg.schedule.forEach((r) => {
      if (!r.enabled) return;
      const t = AtlasSchedule.next(r, now);
      if (t != null && (soonest == null || t < soonest)) soonest = t;
    });
    /* setTimeout can't wait longer than ~24 days; the interval covers the rest */
    if (soonest != null && soonest - now < 2 ** 31 - 1) wpTimer = setTimeout(() => applyWallpaperSchedule(false), soonest - now + 250);
  }
  setInterval(() => applyWallpaperSchedule(false), 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) applyWallpaperSchedule(false); });
  AS.app.currentWallpaper = () => currentWp;

  /* step through the wallpaper list — used by the wallpaper commands so they
     share one implementation with the menu above */
  function stepWallpaper(delta) {
    if (!WALLPAPERS.length) return;
    const i = WALLPAPERS.findIndex((w) => w.id === currentWp);
    const next = (((i < 0 ? 0 : i + delta) % WALLPAPERS.length) + WALLPAPERS.length) % WALLPAPERS.length;
    if (window.AtlasPro && !AtlasPro.builtIn(WALLPAPERS[next].id)) return;
    setWallpaper(WALLPAPERS[next].id);
  }

  // save power when the tab isn't visible
  document.addEventListener("visibilitychange", () => {
    layers.forEach((v) => {
      if (!v.src) return;
      if (document.hidden) v.pause();
      else if (v.classList.contains("is-active")) playSafe(v);
    });
  });

  /* ================= ICONS =============================================== */
  function iconSrc(key) {
    if (!key) return "";
    if (key.includes("/") || key.includes(".")) return key; // direct path
    const file = (typeof ICONS !== "undefined" && ICONS[key]) || "";
    return file ? (typeof ICON_DIR !== "undefined" ? ICON_DIR : "assets/icons/") + file : "";
  }
  function makeIcon(item, cls) {
    const src = iconSrc(item.icon);
    if (src) {
      const img = document.createElement("img");
      img.className = cls;
      img.src = src;
      img.alt = "";
      img.loading = "eager";
      img.addEventListener("error", () => {
        const fb = document.createElement("span");
        fb.className = "tile-fallback";
        fb.textContent = item.name[0];
        img.replaceWith(fb);
      });
      return img;
    }
    const fb = document.createElement("span");
    fb.className = "tile-fallback";
    fb.textContent = item.name[0];
    return fb;
  }

  /* ================= LAYOUT DATA =========================================
     config.js ships the defaults; anything the user changes is persisted
     under the "layout" key and replaces them from then on. The shape is the
     same one config.js already uses, so every consumer below (launcher, rail,
     command center) reads it exactly as before — only the source changes. */
  const LAYOUT_KEY = "layout";
  const LAYOUT_VERSION = 1;

  /* the live model. Seeded from config.js, replaced by stored data at boot.
     Mutated in place so existing references stay valid. */
  const WORKSPACES = [];

  const uid = (p) =>
    p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

  const clone = (v) => JSON.parse(JSON.stringify(v));

  /* Defaults come from config.js. It is only read here, never written. */
  function defaultLayout() {
    const src = typeof DEFAULT_WORKSPACES !== "undefined" ? DEFAULT_WORKSPACES : [];
    return clone(src);
  }

  /* Normalising keeps the rest of the app free of defensive checks: every
     workspace has an id and a cards array, every card an id and items, every
     item a name and url. Anything unusable is dropped rather than rendered
     broken. Unknown fields are preserved so a future version can add some. */
  function normalizeLayout(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    const wsIds = new Set();

    list.forEach((ws) => {
      if (!ws || typeof ws !== "object") return;
      let id = typeof ws.id === "string" && ws.id ? ws.id : uid("ws");
      while (wsIds.has(id)) id = uid("ws");
      wsIds.add(id);

      const cardIds = new Set();
      const cards = (Array.isArray(ws.cards) ? ws.cards : []).reduce((acc, card) => {
        if (!card || typeof card !== "object") return acc;
        let cid = typeof card.id === "string" && card.id ? card.id : uid("card");
        while (cardIds.has(cid)) cid = uid("card");
        cardIds.add(cid);

        const items = (Array.isArray(card.items) ? card.items : []).reduce((ia, it) => {
          if (!it || typeof it !== "object") return ia;
          const name = typeof it.name === "string" ? it.name.trim() : "";
          const url = typeof it.url === "string" ? it.url.trim() : "";
          if (!name || !url) return ia;
          ia.push(
            Object.assign({}, it, {
              id: typeof it.id === "string" && it.id ? it.id : uid("item"),
              name,
              url,
              icon: typeof it.icon === "string" ? it.icon : "",
            })
          );
          return ia;
        }, []);

        acc.push(
          Object.assign({}, card, {
            id: cid,
            title: typeof card.title === "string" && card.title.trim() ? card.title.trim() : "Untitled",
            hint: typeof card.hint === "string" ? card.hint : "",
            items,
          })
        );
        return acc;
      }, []);

      out.push(Object.assign({}, ws, { id, name: typeof ws.name === "string" && ws.name.trim() ? ws.name.trim() : "Workspace", cards }));
    });

    /* never hand back something with no workspace to render */
    if (!out.length) return normalizeLayout(defaultLayout());
    return out;
  }

  /* Replace the contents of WORKSPACES without breaking references to it.
     The private workspace only survives while the vault is unlocked (an
     Undo snapshot taken before a lock must not bring it back). */
  function applyLayout(list) {
    WORKSPACES.length = 0;
    const open = V && V.isUnlocked();
    normalizeLayout(list).forEach((ws) => {
      if (!ws.private || open) WORKSPACES.push(ws);
    });
  }

  let saveTimer = 0;
  function saveLayout() {
    /* coalesce bursts (e.g. a rename typed then confirmed) into one write */
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushLayout, 120);
  }
  /* the private workspace never goes into the plain layout — it is
     encrypted into the vault instead */
  function flushLayout() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    store.set({
      [LAYOUT_KEY]: JSON.stringify({ v: LAYOUT_VERSION, workspaces: WORKSPACES.filter((w) => !w.private) }),
    });
    const vault = vaultWs();
    if (vault) V.save(vault);
  }

  /* ================= PRIVATE SPACE =======================================
     vault.js decrypts the private workspace on unlock; it is then just one
     more entry in WORKSPACES (flagged `private`), so the rail, launcher,
     editing and drag and drop all work on it unchanged. It adds a Notes tab
     and "Save open tabs", and never feeds Quick Peek. Locking takes it out
     of WORKSPACES again. */
  const V = window.AtlasVault;
  const VAULT_ID = "atlas-private";
  const vaultWs = () => WORKSPACES.find((w) => w.private) || null;
  let vaultArriving = false; // the rail animates its icon in once, on unlock
  const isPrivateItem = (item) => {
    const v = vaultWs();
    return !!v && v.cards.some((c) => c.items.includes(item));
  };

  function normalizeNotes(list) {
    return (Array.isArray(list) ? list : []).reduce((acc, n) => {
      if (!n || typeof n !== "object") return acc;
      acc.push({
        id: typeof n.id === "string" && n.id ? n.id : uid("note"),
        title: typeof n.title === "string" ? n.title : "",
        text: typeof n.text === "string" ? n.text : "",
        at: isFinite(n.at) ? Number(n.at) : Date.now(),
      });
      return acc;
    }, []);
  }

  function mountVault(data) {
    const i = WORKSPACES.findIndex((w) => w.private);
    if (i >= 0) WORKSPACES.splice(i, 1);
    const src = data && typeof data === "object" ? data : {};
    const ws = normalizeLayout([Object.assign({ name: "Private", cards: [] }, src)])[0];
    ws.id = VAULT_ID;
    ws.private = true;
    ws.notes = normalizeNotes(src.notes);
    WORKSPACES.push(ws);
    vaultArriving = true;
    renderRail();
    if (launcherOpen) renderLauncher();
  }

  function unmountVault() {
    const i = WORKSPACES.findIndex((w) => w.private);
    if (i >= 0) WORKSPACES.splice(i, 1);
    /* nothing private may stay on screen */
    toastEl.hidden = true;
    closeDialog();
    closeMenu();
    closeCommandCenter();
    if (activeWs === VAULT_ID) {
      activeWs = WORKSPACES[0] ? WORKSPACES[0].id : null;
      if (launcherOpen) setLauncherOpen(false);
    }
    renderRail();
    renderLauncher();
  }

  /* the starting content for a new private space: empty, or a copy of one
     of the workspaces (Customize > Privacy) */
  function vaultSeed(fromId) {
    const src = WORKSPACES.find((w) => w.id === fromId && !w.private);
    return {
      id: VAULT_ID,
      name: "Private",
      private: true,
      cards: src
        ? clone(src.cards)
        : [{ id: uid("card"), title: "Work", hint: "Private", items: [] }],
      notes: [],
    };
  }

  /* adding shortcuts, sections or open tabs to the private space is part
     of Atlas Pro (pro.js opens the upgrade box); what's in it stays usable */
  function privateLocked(ws) {
    if (!ws || !ws.private || !window.AtlasPro) return false;
    return AtlasPro.need("Adding tabs and shortcuts to the private space is part of Atlas Pro.");
  }

  /* the private space is part of Atlas Pro; what's in it stays encrypted
     until the account is Pro again */
  const vaultPro = () => !!window.AtlasPro && AtlasPro.need("The private space is part of Atlas Pro.");

  function openVault() {
    if (!vaultWs() || vaultPro()) return;
    setWorkspace(VAULT_ID);
    setLauncherOpen(true);
  }

  function promptUnlock() {
    if (vaultPro()) return;
    if (!V || !V.exists()) return AS.open("privacy");
    if (V.isUnlocked()) return openVault();
    return openPrivateFolder();
  }

  if (V) {
    V.on((type, data) => {
      if (type === "unlock") mountVault(data);
      else if (type === "beforelock") { if (saveTimer) flushLayout(); }
      else if (type === "lock") unmountVault();
      else renderRail(); // created / deleted / password changed
    });
  }
  AS.app.workspaces = () => WORKSPACES.filter((w) => !w.private).map((w) => ({ id: w.id, name: w.name }));
  AS.app.vaultSeed = vaultSeed;
  AS.app.vaultData = () => { const v = vaultWs(); return v ? clone(v) : null; };
  AS.app.openVault = openVault;

  /* ================= PRIVATE FOLDER ======================================
     The private space as a phone's hidden folder: a screen of its own over
     the page. Locked, it's a password screen; unlocked, the private
     shortcuts as an app grid (by section), and the private notes. Opened
     from the dock's lock button, the Command Center, Customize > Privacy
     and Customize > Notes. Everything shown comes from the unlocked vault
     workspace, and it all goes (back to the lock screen) the moment the
     vault locks. */
  const pf = document.createElement("div");
  pf.className = "pf";
  pf.hidden = true;
  pf.setAttribute("role", "dialog");
  pf.setAttribute("aria-modal", "true");
  pf.setAttribute("aria-label", "Private folder");
  document.body.append(pf);
  let pfView = "apps"; // apps | notes
  let pfEditing = false;
  let pfLastFocus = null;

  const pfEl = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const pfBtn = (cls, text, onClick, label) => {
    const b = pfEl("button", cls, text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    b.addEventListener("click", onClick);
    return b;
  };
  const pfWhen = (at) => new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  function openPrivateFolder(view) {
    if (vaultPro()) return;
    if (view === "apps" || view === "notes") pfView = view;
    if (pf.hidden) pfLastFocus = document.activeElement;
    pfEditing = false;
    pf.hidden = false;
    renderPrivateFolder();
  }
  function closePrivateFolder() {
    if (pf.hidden) return;
    if (saveTimer) flushLayout();
    pf.hidden = true;
    pf.textContent = "";
    if (pfLastFocus && document.contains(pfLastFocus)) pfLastFocus.focus();
    pfLastFocus = null;
  }

  /* the backdrop and box are built once per opening, so their entrance
     plays once; a redraw (a tab switch, an edit, lock / unlock) only swaps
     what's inside. `switched`: the contents fade in, the tab keeps focus. */
  function renderPrivateFolder(switched) {
    if (pf.hidden) return;
    let box = pf.querySelector(".pf-box");
    if (!box) {
      box = pfEl("div", "pf-box");
      const backdrop = pfEl("div", "pf-backdrop");
      backdrop.addEventListener("click", closePrivateFolder);
      pf.append(backdrop, box);
    }
    const oldMain = box.querySelector(".pf-main");
    const scroll = oldMain ? oldMain.scrollTop : 0;
    const ws = vaultWs();
    const oldHead = box.querySelector(".pf-head");

    /* a tab switch keeps the header, so the pill slides across */
    if (switched && oldHead && oldMain) {
      oldHead.querySelectorAll(".pf-seg-btn").forEach((b) => {
        const on = b.dataset.view === pfView;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", String(on));
      });
      const seg = oldHead.querySelector(".pf-seg");
      if (seg) seg.dataset.on = pfView;
      const main = pfEl("div", "pf-main is-switching");
      if (pfView === "notes") pfNotes(main, ws);
      else pfApps(main, ws);
      oldMain.replaceWith(main);
      return;
    }
    box.textContent = "";

    const head = pfEl("div", "pf-head");
    const title = pfEl("div", "pf-title");
    title.innerHTML = svgIcon(ws ? "unlock" : "lock");
    title.append(pfEl("span", "", "Private"));
    head.append(title);
    if (ws) {
      const seg = pfEl("div", "pf-seg");
      seg.setAttribute("role", "tablist");
      seg.dataset.on = pfView;
      seg.append(pfEl("span", "pf-seg-pill"));
      [["apps", "Shortcuts"], ["notes", "Notes"]].forEach(([v, t]) => {
        const b = pfBtn("pf-seg-btn" + (pfView === v ? " is-on" : ""), t, () => {
          if (pfView === v) return;
          pfView = v;
          pfEditing = false;
          renderPrivateFolder(true);
        });
        b.dataset.view = v;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(pfView === v));
        seg.append(b);
      });
      head.append(seg, pfBtn("pf-lock", "Lock", () => V.lock(), "Lock the private folder"));
    }
    head.append(pfBtn("pf-x", "✕", closePrivateFolder, "Close"));
    box.append(head);

    const main = pfEl("div", "pf-main");
    box.append(main);
    if (!V || !V.supported) {
      main.append(pfEl("p", "pf-empty", "This browser can't encrypt data here, so the private folder isn't available."));
    } else if (!V.exists()) {
      const intro = pfEl("div", "pf-lockscreen");
      const icon = pfEl("div", "pf-bigicon");
      icon.innerHTML = svgIcon("lock");
      intro.append(icon, pfEl("h2", "pf-h", "Private folder"),
        pfEl("p", "pf-sub", "Hide shortcuts and notes behind a password, like a hidden folder on your phone. Everything inside is encrypted."),
        pfBtn("pf-primary", "Set it up", () => { closePrivateFolder(); AS.open("privacy"); }));
      main.append(intro);
    } else if (!ws) {
      main.append(pfLockScreen());
    } else if (pfView === "notes") {
      pfNotes(main, ws);
    } else {
      pfApps(main, ws);
    }
    main.scrollTop = scroll; // an edit keeps your place
    const first = pf.querySelector(".pf-pw") || pf.querySelector(".pf-x");
    if (first) first.focus();
  }

  function pfLockScreen() {
    const form = pfEl("form", "pf-lockscreen");
    form.autocomplete = "off";
    const icon = pfEl("div", "pf-bigicon");
    icon.innerHTML = svgIcon("lock");
    const pw = pfEl("input", "pf-input pf-pw");
    pw.type = "password";
    pw.placeholder = "Password";
    pw.autocomplete = "current-password";
    pw.setAttribute("aria-label", "Password");
    const go = pfEl("button", "pf-primary", "Unlock");
    go.type = "submit";
    const msg = pfEl("p", "pf-err");
    msg.hidden = true;
    msg.setAttribute("role", "alert");
    form.append(icon, pfEl("h2", "pf-h", "Private folder is locked"), pfEl("p", "pf-sub", "Enter your password to open it."), pw, go, msg);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!pw.value) { msg.textContent = "Enter your password."; msg.hidden = false; return; }
      go.disabled = true;
      go.textContent = "Unlocking…";
      try {
        await V.unlock(pw.value); // the unlock event redraws this as the folder
      } catch (err) {
        msg.textContent = err.code === "wrong" ? "That password isn't right." : "Couldn't unlock: " + err.message;
        msg.hidden = false;
        form.classList.remove("is-shake");
        void form.offsetWidth; // replay the shake
        form.classList.add("is-shake");
        go.disabled = false;
        go.textContent = "Unlock";
        pw.select();
      }
    });
    return form;
  }

  /* the shortcuts, section by section, as app icons */
  function pfApps(main, ws) {
    const bar = pfEl("div", "pf-bar");
    bar.append(
      pfEl("span", "pf-count", ws.cards.reduce((n, c) => n + c.items.length, 0) + " shortcuts"),
      pfBtn("pf-chip" + (pfEditing ? " is-on" : ""), pfEditing ? "Done" : "Edit", () => { pfEditing = !pfEditing; renderPrivateFolder(); }),
      pfBtn("pf-chip", "Open on the dock", () => { closePrivateFolder(); openVault(); }));
    main.append(bar);

    if (!ws.cards.length) ws.cards.push({ id: uid("card"), title: "Private", hint: "", items: [] });
    ws.cards.forEach((card) => {
      const sec = pfEl("section", "pf-sec");
      sec.append(pfEl("h3", "pf-sec-title", card.title || "Section"));
      const grid = pfEl("div", "pf-grid" + (pfEditing ? " is-editing" : ""));
      card.items.forEach((item) => {
        const a = pfEl("a", "pf-app");
        a.href = item.url;
        a.title = item.name + "\n" + item.url;
        const ic = pfEl("span", "pf-app-icon");
        ic.append(makeIcon(item, "pf-app-img"));
        a.append(ic, pfEl("span", "pf-app-name", item.name));
        a.addEventListener("click", (e) => {
          if (pfEditing) return e.preventDefault();
          if (e.ctrlKey || e.metaKey || e.shiftKey) return; // a new tab / window, as usual
          e.preventDefault();
          if (saveTimer) flushLayout();
          openShortcut(item);
        });
        if (pfEditing) {
          a.append(pfBtn("pf-app-del", "✕", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!confirm('Remove "' + item.name + '" from the private folder?')) return;
            card.items.splice(card.items.indexOf(item), 1);
            saveLayout();
            if (launcherOpen) renderLauncher();
            renderPrivateFolder();
          }, "Remove " + item.name));
        }
        grid.append(a);
      });
      const add = pfBtn("pf-app pf-app-add", "", () => privateLocked(ws) || pfAddForm(sec, card), "Add a shortcut to " + (card.title || "this section"));
      add.append(pfEl("span", "pf-app-icon", "+"), pfEl("span", "pf-app-name", "Add"));
      grid.append(add);
      sec.append(grid);
      main.append(sec);
    });
  }

  function pfAddForm(sec, card) {
    const old = pf.querySelector(".pf-add");
    if (old) old.remove();
    const form = pfEl("form", "pf-add");
    form.autocomplete = "off";
    const name = pfEl("input", "pf-input");
    name.placeholder = "Name";
    name.maxLength = 60;
    name.setAttribute("aria-label", "Name");
    const url = pfEl("input", "pf-input");
    url.placeholder = "example.com";
    url.spellcheck = false;
    url.setAttribute("aria-label", "Web address");
    const save = pfEl("button", "pf-primary", "Add");
    save.type = "submit";
    const msg = pfEl("p", "pf-err");
    msg.hidden = true;
    form.append(name, url, save, pfBtn("pf-chip", "Cancel", () => form.remove()), msg);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const u = normalizeUrl(url.value);
      const n = name.value.trim() || hostOf(u);
      if (!u || !n) {
        msg.textContent = "Give it a web address, like github.com";
        msg.hidden = false;
        return url.focus();
      }
      card.items.push({ id: uid("item"), name: n.slice(0, 60), url: u, icon: "" });
      saveLayout();
      if (launcherOpen) renderLauncher();
      renderPrivateFolder();
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); form.remove(); }
    });
    sec.append(form);
    name.focus();
  }

  /* the private notes: a title and text each, saved (encrypted) as typed */
  function pfNotes(main, ws) {
    const bar = pfEl("div", "pf-bar");
    bar.append(
      pfEl("span", "pf-count", ws.notes.length + " notes"),
      pfBtn("pf-chip is-on", "+ New note", () => {
        ws.notes.unshift({ id: uid("note"), title: "", text: "", at: Date.now() });
        saveLayout();
        renderPrivateFolder();
        const first = pf.querySelector(".pf-note-title");
        if (first) first.focus();
      }));
    main.append(bar);
    if (!ws.notes.length) main.append(pfEl("p", "pf-empty", "No private notes yet. They're encrypted along with everything else here."));
    const list = pfEl("div", "pf-notes");
    ws.notes.forEach((n) => {
      const title = pfEl("input", "pf-note-title");
      title.value = n.title;
      title.placeholder = "Title";
      title.setAttribute("aria-label", "Note title");
      const text = pfEl("textarea", "pf-note-text");
      text.value = n.text;
      text.placeholder = "Write something…";
      text.rows = 3;
      text.setAttribute("aria-label", "Note");
      const fit = () => { text.style.height = "auto"; text.style.height = text.scrollHeight + "px"; };
      const time = pfEl("span", "", pfWhen(n.at));
      const foot = pfEl("div", "pf-note-foot");
      foot.append(time, pfBtn("pf-chip", "Delete", () => {
        if ((n.title || n.text) && !confirm('Delete "' + (n.title || "Untitled") + '"?')) return;
        ws.notes.splice(ws.notes.indexOf(n), 1);
        saveLayout();
        renderPrivateFolder();
      }));
      const edit = () => {
        n.title = title.value;
        n.text = text.value;
        n.at = Date.now();
        time.textContent = pfWhen(n.at);
        saveLayout();
      };
      title.addEventListener("input", edit);
      text.addEventListener("input", () => { fit(); edit(); });
      const card = pfEl("div", "pf-note");
      card.append(title, text, foot);
      list.append(card);
      requestAnimationFrame(fit);
    });
    main.append(list);
  }

  pf.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePrivateFolder(); }
  });
  if (V) V.on((type) => {
    if (type === "beforelock" || pf.hidden) return;
    /* a lock swaps the contents for the password screen at once */
    if (type === "destroy") closePrivateFolder();
    else renderPrivateFolder();
  });
  AS.app.openPrivateFolder = openPrivateFolder;

  /* auto-lock after the idle time picked in Customize > Privacy */
  let lastActive = Date.now();
  ["pointerdown", "pointermove", "keydown", "wheel"].forEach((ev) =>
    addEventListener(ev, () => (lastActive = Date.now()), { capture: true, passive: true }));
  setInterval(() => {
    const mins = AS.get().privacy.autoLock;
    if (mins > 0 && V && V.isUnlocked() && Date.now() - lastActive > mins * 60000) V.lock();
  }, 15000);

  /* Reads whatever is in storage and works out what to do with it:
       - nothing stored            -> config.js defaults (first launch)
       - versioned {v, workspaces} -> use as-is
       - a bare array              -> data from before versioning; adopt it
     Corrupt JSON falls back to defaults rather than throwing.              */
  function loadLayout(stored) {
    if (!stored) return defaultLayout();
    let parsed;
    try {
      parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
    } catch {
      return defaultLayout();
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.workspaces)) return parsed.workspaces;
    return defaultLayout();
  }

  /* --- lookups used by the editing UI --- */
  const findWs = (id) => WORKSPACES.find((w) => w.id === id) || null;
  const currentWs = () => findWs(activeWs) || WORKSPACES[0] || null;
  function findCard(cardId) {
    const ws = currentWs();
    if (!ws) return null;
    return ws.cards.find((c) => c.id === cardId) || null;
  }

  /* move an element within its array; returns true when something moved */
  function moveBy(arr, index, delta) {
    const to = index + delta;
    if (index < 0 || to < 0 || to >= arr.length) return false;
    const [el] = arr.splice(index, 1);
    arr.splice(to, 0, el);
    return true;
  }

  /* ================= WORKSPACE RAIL + LAUNCHER ===========================
     The rail (left edge) switches workspaces. The launcher next to it shows
     the active workspace's sections as tabs — "All" plus one per section —
     and their shortcuts as a grid of round app icons. */
  const rail = $("rail");
  const tabsEl = $("launcherTabs");
  const toolsEl = $("launcherTools");
  const gridEl = $("launcherGrid");
  let activeWs = null; // set at boot, once the layout is loaded
  let tabs = {};       // workspace id -> "all" | section id, persisted
  let launcherOpen = false; // hidden until a rail icon is clicked
  const launcherEl = $("launcher");

  const ICON_PATHS = {
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
    work: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M4 13h16"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
    game: '<path d="M7.5 8h9a4 4 0 0 1 3.9 4.9l-.8 3.4a2 2 0 0 1-3.4.9L14.5 15h-5l-1.7 2.2a2 2 0 0 1-3.4-.9l-.8-3.4A4 4 0 0 1 7.5 8z"/><path d="M8.5 11v3M7 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17" cy="13.2" r=".6"/>',
    folder: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
    music: '<path d="M9 17V6l10-2v11"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="15" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
    palette: '<path d="M12 4a8 8 0 1 0 0 16c1 0 1.6-.7 1.6-1.5 0-.9-.9-1.4-.9-2.4 0-.9.7-1.6 1.6-1.6H16a4 4 0 0 0 4-4C20 6.9 16.4 4 12 4z"/><circle cx="7.8" cy="11.2" r=".9"/><circle cx="10.2" cy="7.9" r=".9"/><circle cx="14.2" cy="7.9" r=".9"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.2v1.8"/>',
    unlock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/><path d="M12 14.2v1.8"/>',
    shield: '<path d="M12 3.5 5.5 6v5.5c0 4 2.8 7.3 6.5 8.5 3.7-1.2 6.5-4.5 6.5-8.5V6z"/><circle cx="12" cy="11" r="1.6"/><path d="M12 12.6v2.6"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    tabs: '<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M4 10h16M8 6v4"/><path d="M12 13v4M10 15h4"/>',
  };
  const svgIcon = (key) =>
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON_PATHS[key] + "</svg>";

  /* a workspace may name its own icon (ws.icon); otherwise guess from the name */
  function railIconKey(ws) {
    if (ws.private) return "shield";
    if (ws.icon && ICON_PATHS[ws.icon]) return ws.icon;
    const n = ws.name.toLowerCase();
    if (/personal|home|\bme\b|main/.test(n)) return "home";
    if (/work|office|job|business/.test(n)) return "work";
    if (/game|play|fun/.test(n)) return "game";
    if (/music|media|video|watch/.test(n)) return "music";
    if (/dev|code|build|eng/.test(n)) return "code";
    if (/study|read|learn|school|uni/.test(n)) return "book";
    if (/file|doc|project/.test(n)) return "folder";
    if (/web|browse|social|news/.test(n)) return "globe";
    return "";
  }

  function renderRail() {
    rail.textContent = "";
    rail.insertAdjacentHTML("afterbegin", TRACE_SVG); // border light
    WORKSPACES.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rail-btn";
      b.dataset.label = w.name;
      b.setAttribute("aria-label", w.name);
      const key = railIconKey(w);
      if (key) b.innerHTML = svgIcon(key);
      else {
        const letter = document.createElement("span");
        letter.className = "rail-letter";
        letter.textContent = w.name[0].toUpperCase();
        b.appendChild(letter);
      }
      if (w.private) b.classList.add("is-private");
      if (w.private && vaultArriving) b.classList.add("is-arriving");
      if (w.id === activeWs) {
        b.classList.add("is-on");
        b.setAttribute("aria-current", "true");
      }
      b.setAttribute("aria-expanded", String(launcherOpen && w.id === activeWs));
      b.setAttribute("aria-controls", "launcher");
      /* the active workspace's icon opens / closes the launcher; another
         workspace's icon switches to it and opens */
      b.addEventListener("click", () => {
        if (w.id === activeWs) return setLauncherOpen(!launcherOpen);
        setWorkspace(w.id);
        setLauncherOpen(true);
      });
      rail.appendChild(b);
    });

    const sep = document.createElement("span");
    sep.className = "rail-sep";
    rail.appendChild(sep);

    /* the private space's lock: unlocks it (password), or locks it again */
    if (V && V.exists() && AS.get().privacy.dock) {
      const open = V.isUnlocked();
      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "rail-btn rail-lock" + (open ? " is-open" : "") + (open && vaultArriving ? " is-arriving" : "");
      lock.dataset.label = open ? "Private folder (right-click to lock)" : "Private folder";
      lock.setAttribute("aria-label", open ? "Open the private folder" : "Unlock the private folder");
      lock.innerHTML = svgIcon(open ? "unlock" : "lock");
      /* the hidden folder: a password screen, then the private shortcuts
         and notes; right-click locks it straight away */
      lock.addEventListener("click", () => (pf.hidden ? openPrivateFolder() : closePrivateFolder()));
      lock.addEventListener("contextmenu", (e) => { if (open) { e.preventDefault(); V.lock(); } });
      rail.appendChild(lock);
    }
    vaultArriving = false;

    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "rail-btn";
    gear.dataset.label = "Command Center (Ctrl+Space)";
    gear.setAttribute("aria-label", "Open Command Center");
    gear.innerHTML = svgIcon("settings");
    gear.addEventListener("click", () => openCommandCenter());
    rail.appendChild(gear);

    const paint = document.createElement("button");
    paint.type = "button";
    paint.className = "rail-btn";
    paint.dataset.label = "Customize";
    paint.setAttribute("aria-label", "Customize appearance");
    paint.innerHTML = svgIcon("palette");
    paint.addEventListener("click", () => (AS.isOpen() ? AS.close() : AS.open()));
    rail.appendChild(paint);

    /* reminders.js loads after this file, so it is looked up on click */
    const bell = document.createElement("button");
    bell.type = "button";
    bell.className = "rail-btn rail-bell";
    bell.id = "railBell";
    bell.dataset.label = "Reminders";
    bell.setAttribute("aria-label", "Reminders");
    bell.innerHTML = svgIcon("bell");
    if (window.AtlasReminders && AtlasReminders.isOpen()) bell.classList.add("is-lit");
    bell.addEventListener("click", () => window.AtlasReminders && AtlasReminders.toggle());
    rail.appendChild(bell);
  }

  function setLauncherOpen(open) {
    launcherOpen = open;
    document.body.classList.toggle("launcher-open", open);
    launcherEl.inert = !open; // nothing inside is focusable while hidden
    if (open) renderLauncher(); // replays the icons' entrance
    else closeMenu();
    renderRail();
  }
  launcherEl.inert = true;

  /* the section tab to show; falls back to "All" if it was deleted */
  function activeTab(ws) {
    const t = tabs[ws.id];
    if (t === "notes" && ws.private) return "notes";
    return t && ws.cards.some((c) => c.id === t) ? t : "all";
  }

  function setTab(id) {
    const ws = currentWs();
    if (!ws) return;
    tabs[ws.id] = id;
    if (!ws.private) store.set({ launcherTabs: JSON.stringify(tabs) });
    renderLauncher();
  }

  function renderLauncher() {
    const ws = currentWs();
    /* any open ⋮ menu is anchored to a button that is about to be removed */
    if (typeof closeMenu === "function") closeMenu();
    tabsEl.textContent = "";
    toolsEl.textContent = "";
    gridEl.textContent = "";
    launcherEl.classList.toggle("is-private", !!(ws && ws.private));
    if (!ws) return;
    const tab = activeTab(ws);

    const addTab = (id, label, hint) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ltab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.textContent = label;
      if (hint) b.title = hint;
      if (id === "notes") b.classList.add("ltab-notes");
      else if (id !== "all") {
        /* right-click on a section tab opens the same menu as its ⋮ */
        b.dataset.kind = "card";
        b.dataset.id = id;
        b.draggable = true;
      }
      if (id === tab) b.classList.add("is-on");
      b.addEventListener("click", () => setTab(id));
      tabsEl.appendChild(b);
    };
    addTab("all", "All");
    ws.cards.forEach((c) => addTab(c.id, c.title, c.hint));
    if (ws.private) addTab("notes", "Notes", "Private notes");

    const notes = tab === "notes";
    if (tab !== "all" && !notes) toolsEl.appendChild(menuButton("card", tab, "Section options"));
    if (ws.private && !notes && canReadTabs) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "ltool ltool-icon";
      save.dataset.act = "save-tabs";
      save.setAttribute("aria-label", "Save this window's open tabs");
      save.title = tab === "all" ? "Save open tabs as a new section" : "Save open tabs to this section";
      save.innerHTML = svgIcon("tabs");
      toolsEl.appendChild(save);
    }
    const addSection = document.createElement("button");
    addSection.type = "button";
    addSection.className = "ltool";
    addSection.dataset.act = notes ? "add-note" : "add-card";
    addSection.setAttribute("aria-label", notes ? "New note" : "Add section");
    addSection.title = notes ? "New note" : "Add section";
    addSection.textContent = "+";
    toolsEl.appendChild(addSection);

    const on = tabsEl.querySelector(".is-on");
    if (on) {
      /* keep the chosen tab visible when the row overflows (measured once
         the tools beside the row are in, since they narrow it) */
      const l = on.offsetLeft, r = l + on.offsetWidth;
      if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = l - 8;
      else if (r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = r - tabsEl.clientWidth + 8;
    }

    gridEl.classList.toggle("is-notes", notes);
    if (notes) return renderNotes(ws);

    const shown = tab === "all" ? ws.cards : ws.cards.filter((c) => c.id === tab);
    const entries = shown.flatMap((c) => c.items.map((it) => [c, it]));
    entries.forEach(([c, it], i) => gridEl.appendChild(renderApp(c, it, i)));

    /* "Add" goes into the open section, or the first one from "All" */
    const target = tab === "all" ? ws.cards[0] : findCard(tab);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "app app-add";
    add.style.setProperty("--i", Math.min(entries.length, 18));
    if (target) {
      add.dataset.act = "add-item";
      add.dataset.card = target.id;
    } else {
      add.dataset.act = "add-card";
    }
    add.innerHTML = '<span class="app-bubble" aria-hidden="true">+</span>';
    const addName = document.createElement("span");
    addName.className = "app-name";
    addName.textContent = target ? "Add" : "Add section";
    add.appendChild(addName);
    gridEl.appendChild(add);
  }

  function renderApp(card, it, i) {
    const cell = document.createElement("div");
    cell.className = "app";
    cell.style.setProperty("--i", Math.min(i, 18)); // entrance stagger
    cell.draggable = true;
    cell.dataset.card = card.id;
    cell.dataset.item = it.id;

    const a = document.createElement("a");
    a.className = "app-link";
    a.href = it.url;
    a.title = it.name;
    a.draggable = false; // the whole cell is dragged, not the link
    const bubble = document.createElement("span");
    bubble.className = "app-bubble";
    bubble.appendChild(makeIcon(it, "app-icon"));
    const nm = document.createElement("span");
    nm.className = "app-name";
    nm.textContent = it.name;
    a.append(bubble, nm);
    a.addEventListener("click", () => bumpUsage(it));

    cell.append(a, menuButton("item", it.id, "Shortcut options", card.id));
    return cell;
  }

  /* --- private notes: editable cards in the private space's Notes tab.
     Typing saves (encrypted, debounced through saveLayout) without a
     redraw, so the caret never jumps. */
  function renderNotes(ws) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "note-add";
    add.dataset.act = "add-note";
    add.innerHTML = '<span aria-hidden="true">+</span>';
    add.append(ws.notes.length ? "New note" : "Write your first private note");
    gridEl.appendChild(add);
    ws.notes.forEach((n, i) => gridEl.appendChild(renderNote(n, i)));
  }

  const noteTime = (at) =>
    new Date(at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: !AS.get().widgets.clock.h24 });

  function renderNote(n, i) {
    const el = document.createElement("article");
    el.className = "note";
    el.style.setProperty("--i", Math.min(i + 1, 18));
    const title = document.createElement("input");
    title.className = "note-title";
    title.type = "text";
    title.placeholder = "Untitled";
    title.value = n.title;
    title.spellcheck = false;
    title.setAttribute("aria-label", "Note title");
    const text = document.createElement("textarea");
    text.className = "note-text";
    text.placeholder = "Write something…";
    text.value = n.text;
    text.rows = 4;
    text.setAttribute("aria-label", "Note");
    const foot = document.createElement("div");
    foot.className = "note-foot";
    const time = document.createElement("span");
    time.className = "note-time";
    time.textContent = noteTime(n.at);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "note-del";
    del.dataset.act = "del-note";
    del.dataset.id = n.id;
    del.setAttribute("aria-label", "Delete note");
    del.title = "Delete note";
    del.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 12h9l1-12"/></svg>';
    foot.append(time, del);
    const edit = () => {
      n.title = title.value;
      n.text = text.value;
      n.at = Date.now();
      time.textContent = noteTime(n.at);
      saveLayout();
    };
    title.addEventListener("input", edit);
    text.addEventListener("input", edit);
    el.append(title, text, foot);
    return el;
  }

  function addNote() {
    const ws = vaultWs();
    if (!ws) return;
    ws.notes.unshift({ id: uid("note"), title: "", text: "", at: Date.now() });
    tabs[ws.id] = "notes";
    commit();
    const first = gridEl.querySelector(".note-title");
    if (first) first.focus();
  }

  function deleteNote(id) {
    const ws = vaultWs();
    if (!ws) return;
    const i = ws.notes.findIndex((n) => n.id === id);
    if (i < 0) return;
    const n = ws.notes[i];
    if ((n.title || n.text) && !confirm('Delete "' + (n.title || "Untitled") + '"?')) return;
    ws.notes.splice(i, 1);
    commit();
  }

  /* --- "Save open tabs": every web page open in this window becomes a
     shortcut. Without the "tabs" permission Chrome still reports the URL
     and title of pages the extension has host access to (all http/https). */
  const canReadTabs = typeof chrome !== "undefined" && !!(chrome.tabs && chrome.tabs.query);

  async function saveOpenTabs() {
    const ws = vaultWs();
    if (!ws || !canReadTabs || currentWs() !== ws || privateLocked(ws)) return;
    let list = [];
    try { list = await chrome.tabs.query({ currentWindow: true }); } catch { list = []; }
    const tab = activeTab(ws);
    let card = tab !== "all" && tab !== "notes" ? findCard(tab) : null;
    const have = new Set(card ? card.items.map((it) => it.url) : []);
    const items = [];
    list.forEach((t) => {
      const url = t.url || "";
      if (!/^https?:\/\//i.test(url) || have.has(url)) return;
      have.add(url);
      items.push({
        id: uid("item"),
        name: (t.title || hostOf(url) || url).trim().slice(0, 60),
        url,
        icon: /^https:\/\//i.test(t.favIconUrl || "") ? t.favIconUrl : "",
      });
    });
    if (!items.length) return toast("No new web pages open in this window");
    if (!card) {
      const day = new Date().toLocaleDateString([], { day: "numeric", month: "short" });
      card = { id: uid("card"), title: "Tabs · " + day, hint: "Saved tabs", items: [] };
      ws.cards.push(card);
      tabs[ws.id] = card.id;
    }
    card.items.push(...items);
    commit();
    toast("Saved " + items.length + " tab" + (items.length === 1 ? "" : "s") + ' to "' + card.title + '"');
  }

  /* the ⋮ trigger; the menu itself is built on demand in openMenu() */
  function menuButton(kind, id, label, parent) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dots";
    b.dataset.act = "menu";
    b.dataset.kind = kind;
    b.dataset.id = id;
    if (parent) b.dataset.parent = parent;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.textContent = "⋮";
    return b;
  }

  /* the single place a workspace change happens — the rail and the command
     center both go through here, so persistence stays in one spot */
  function setWorkspace(id) {
    if (!WORKSPACES.some((w) => w.id === id) || id === activeWs) return;
    activeWs = id;
    if (id !== VAULT_ID) store.set({ workspace: id }); // a new tab always opens outside it
    renderRail();
    renderLauncher();
  }

  /* right-click anywhere on an app or a section tab = its ⋮ menu */
  gridEl.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest(".app:not(.app-add)");
    const dots = cell && cell.querySelector(".dots");
    if (!dots) return;
    e.preventDefault();
    openMenu(dots);
  });
  tabsEl.addEventListener("contextmenu", (e) => {
    const t = e.target.closest(".ltab[data-kind]");
    if (!t) return;
    e.preventDefault();
    openMenu(t);
  });
  /* a mouse wheel scrolls the tab row sideways */
  tabsEl.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    tabsEl.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  /* --- drag and drop ---------------------------------------------------
     Apps: drag within the grid to reorder, onto a section tab to move them
     there, or onto the remove bar to delete (with undo).
     Tabs: drag sideways to reorder sections, or onto the remove bar.
     The DOM is rearranged live while dragging; the data is updated once on
     drop, and a cancelled drag simply re-renders the saved order. */
  const trash = $("launcherTrash");
  let drag = null; // { type: "app" | "tab", el, card, item?, done }

  const apps = () => Array.from(gridEl.querySelectorAll(".app[data-item]"));

  function startDrag(e, info) {
    drag = Object.assign({ done: false }, info);
    closeMenu();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    /* let the browser grab its drag image before the source goes faint */
    requestAnimationFrame(() => {
      if (!drag) return;
      drag.el.classList.add("is-dragging");
      document.body.classList.add("is-dragging");
    });
  }

  function endDrag() {
    if (!drag) return;
    const redraw = !drag.done;
    drag = null;
    document.body.classList.remove("is-dragging");
    trash.classList.remove("is-over");
    tabsEl.querySelectorAll(".is-drop").forEach((t) => t.classList.remove("is-drop"));
    if (redraw) renderLauncher(); // cancelled: put everything back
  }

  /* clean up before re-rendering: the redraw removes the dragged element,
     and a removed element's dragend never reaches the document */
  function finishDrop() {
    drag.done = true;
    endDrag();
    commit();
  }

  gridEl.addEventListener("dragstart", (e) => {
    const cell = e.target.closest(".app[data-item]");
    if (!cell) return;
    startDrag(e, { type: "app", el: cell, card: cell.dataset.card, item: cell.dataset.item });
  });
  tabsEl.addEventListener("dragstart", (e) => {
    const t = e.target.closest(".ltab[data-id]");
    if (!t) return;
    startDrag(e, { type: "tab", el: t, card: t.dataset.id });
  });
  document.addEventListener("dragend", endDrag);

  /* grid: live reorder under the pointer */
  gridEl.addEventListener("dragover", (e) => {
    if (!drag || drag.type !== "app") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const over = e.target.closest(".app");
    if (!over || over === drag.el) return;
    if (over.classList.contains("app-add")) {
      gridEl.insertBefore(drag.el, over); // never past the Add tile
      return;
    }
    const r = over.getBoundingClientRect();
    const before = e.clientX < r.left + r.width / 2;
    gridEl.insertBefore(drag.el, before ? over : over.nextSibling);
  });
  gridEl.addEventListener("drop", (e) => {
    if (!drag || drag.type !== "app") return;
    e.preventDefault();
    placeApp(drag.card, drag.item, drag.el);
    finishDrop();
  });

  /* tabs: reorder sections, or receive an app */
  tabsEl.addEventListener("dragover", (e) => {
    if (!drag) return;
    const t = e.target.closest(".ltab[data-id]");
    if (drag.type === "tab") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!t || t === drag.el) return;
      const r = t.getBoundingClientRect();
      tabsEl.insertBefore(drag.el, e.clientX < r.left + r.width / 2 ? t : t.nextSibling);
      return;
    }
    tabsEl.querySelectorAll(".is-drop").forEach((x) => x !== t && x.classList.remove("is-drop"));
    if (!t || t.dataset.id === drag.card) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    t.classList.add("is-drop");
  });
  tabsEl.addEventListener("dragleave", (e) => {
    const t = e.target.closest(".ltab");
    if (t && !t.contains(e.relatedTarget)) t.classList.remove("is-drop");
  });
  tabsEl.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    const ws = currentWs();
    if (drag.type === "tab") {
      const order = Array.from(tabsEl.querySelectorAll(".ltab[data-id]")).map((x) => x.dataset.id);
      ws.cards.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else {
      const t = e.target.closest(".ltab[data-id]");
      const from = findCard(drag.card);
      const to = t && findCard(t.dataset.id);
      if (!from || !to || from === to) return;
      const i = from.items.findIndex((it) => it.id === drag.item);
      if (i < 0) return;
      to.items.push(from.items.splice(i, 1)[0]);
    }
    finishDrop();
  });

  /* remove bar */
  trash.addEventListener("dragover", (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    trash.classList.add("is-over");
  });
  trash.addEventListener("dragleave", () => trash.classList.remove("is-over"));
  trash.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    const d = drag;
    d.done = true;
    endDrag();
    if (d.type === "tab") {
      renderLauncher();
      deleteCard(d.card); // asks first: a section can hold many shortcuts
      return;
    }
    const card = findCard(d.card);
    const i = card ? card.items.findIndex((it) => it.id === d.item) : -1;
    if (i < 0) return renderLauncher();
    const before = clone(WORKSPACES);
    const [gone] = card.items.splice(i, 1);
    commit();
    toast('Removed "' + gone.name + '"', () => {
      applyLayout(before);
      saveLayout();
      renderLauncher();
    });
  });

  /* put the dragged item into the data where it now sits in the grid: after
     the app before it, or before the app after it. In "All" this is also how
     an app changes section — it joins the section of its new neighbour. */
  function placeApp(cardId, itemId, cell) {
    const from = findCard(cardId);
    if (!from) return;
    const i = from.items.findIndex((it) => it.id === itemId);
    if (i < 0) return;
    const list = apps();
    const at = list.indexOf(cell);
    const prev = list[at - 1];
    const next = list[at + 1];
    const [item] = from.items.splice(i, 1);
    const anchor = prev || next;
    const card = anchor && findCard(anchor.dataset.card);
    if (!card) { from.items.splice(i, 0, item); return; }
    const j = card.items.findIndex((it) => it.id === anchor.dataset.item);
    card.items.splice(prev ? j + 1 : j, 0, item);
  }

  /* small "Removed … Undo" note above the search bar */
  const toastEl = $("toast");
  let toastTimer = 0;
  function toast(text, undo, label) {
    clearTimeout(toastTimer);
    toastEl.textContent = "";
    const msg = document.createElement("span");
    msg.textContent = text;
    toastEl.appendChild(msg);
    if (undo) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label || "Undo";
      b.addEventListener("click", () => { toastEl.hidden = true; undo(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    toastTimer = setTimeout(() => (toastEl.hidden = true), 6000);
  }

  /* ================= EDITING =============================================
     Sections and shortcuts are edited in place. Every mutation goes through
     one of the apply* helpers below so that persisting and re-rendering
     happen in exactly one place.                                          */

  /* --- the ⋮ context menu --- */
  const ctxMenu = $("ctxMenu");
  let ctxOwner = null; // the ⋮ button the menu belongs to

  function closeMenu() {
    if (!ctxOwner) return;
    ctxOwner.setAttribute("aria-expanded", "false");
    ctxOwner = null;
    ctxMenu.hidden = true;
    ctxMenu.textContent = "";
  }

  function openMenu(btn) {
    const sameOwner = ctxOwner === btn;
    closeMenu();
    if (sameOwner) return; // clicking the same ⋮ twice closes it

    const { kind, id, parent } = btn.dataset;
    const entries = kind === "card" ? cardMenu(id) : itemMenu(parent, id);
    if (!entries.length) return;

    entries.forEach((e) => {
      if (e.sep) {
        const hr = document.createElement("div");
        hr.className = "ctx-sep";
        hr.setAttribute("role", "separator");
        ctxMenu.appendChild(hr);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.textContent = e.label;
      if (e.danger) b.className = "is-danger";
      if (e.disabled) b.disabled = true;
      else b.addEventListener("click", () => { closeMenu(); e.run(); });
      ctxMenu.appendChild(b);
    });

    ctxOwner = btn;
    btn.setAttribute("aria-expanded", "true");
    ctxMenu.hidden = false;
    positionMenu(btn);
    const first = ctxMenu.querySelector("button:not([disabled])");
    if (first) first.focus();
  }

  /* anchor under the ⋮, flipped when it would leave the viewport */
  function positionMenu(btn) {
    const r = btn.getBoundingClientRect();
    const m = ctxMenu.getBoundingClientRect();
    let left = r.right - m.width;
    let top = r.bottom + 6;
    if (left < 8) left = 8;
    if (left + m.width > innerWidth - 8) left = innerWidth - 8 - m.width;
    if (top + m.height > innerHeight - 8) top = r.top - m.height - 6;
    ctxMenu.style.left = Math.max(8, left) + "px";
    ctxMenu.style.top = Math.max(8, top) + "px";
  }

  function cardMenu(cardId) {
    const ws = currentWs();
    if (!ws) return [];
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (i < 0) return [];
    return [
      { label: "Rename section", run: () => editCard(cardId) },
      { label: "Add shortcut", run: () => editItem(cardId, null) },
      { label: "Move left", disabled: i === 0, run: () => moveCard(cardId, -1) },
      { label: "Move right", disabled: i === ws.cards.length - 1, run: () => moveCard(cardId, 1) },
      { sep: true },
      { label: "Delete section", danger: true, run: () => deleteCard(cardId) },
    ];
  }

  function itemMenu(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return [];
    const i = card.items.findIndex((it) => it.id === itemId);
    if (i < 0) return [];
    return [
      { label: "Edit shortcut", run: () => editItem(cardId, itemId) },
      { label: "Move left", disabled: i === 0, run: () => moveItem(cardId, itemId, -1) },
      { label: "Move right", disabled: i === card.items.length - 1, run: () => moveItem(cardId, itemId, 1) },
      { sep: true },
      { label: "Delete shortcut", danger: true, run: () => deleteItem(cardId, itemId) },
    ];
  }

  /* --- the add/edit dialog --------------------------------------------
     One dialog serves sections and shortcuts; fields are shown or hidden
     to suit. It resolves through onSubmit rather than returning a value. */
  const dlg = $("editDialog");
  const dlgForm = $("editForm");
  const dlgTitle = $("editTitle");
  const dlgFields = $("editFields");
  const dlgError = $("editError");
  let dlgSubmit = null;
  let dlgLastFocus = null;

  function field(label, name, value, placeholder, hintText, type) {
    const wrap = document.createElement("label");
    wrap.className = "ed-field";
    const span = document.createElement("span");
    span.className = "ed-label";
    span.textContent = label;
    const input = document.createElement("input");
    input.type = type || "text";
    input.name = name;
    input.value = value || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    if (placeholder) input.placeholder = placeholder;
    wrap.append(span, input);
    if (hintText) {
      const h = document.createElement("span");
      h.className = "ed-hint";
      h.textContent = hintText;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function openDialog(title, fields, onSubmit) {
    dlgLastFocus = document.activeElement;
    dlgTitle.textContent = title;
    dlgFields.textContent = "";
    fields.forEach((f) => dlgFields.appendChild(f));
    dlgError.textContent = "";
    dlgError.hidden = true;
    dlgSubmit = onSubmit;
    dlg.hidden = false;
    const first = dlgFields.querySelector("input");
    if (first) { first.focus(); first.select(); }
  }

  function closeDialog() {
    if (dlg.hidden) return;
    dlg.hidden = true;
    dlgSubmit = null;
    dlgFields.textContent = "";
    if (dlgLastFocus && document.contains(dlgLastFocus)) dlgLastFocus.focus();
    dlgLastFocus = null;
  }

  function dialogError(msg) {
    dlgError.textContent = msg;
    dlgError.hidden = false;
  }

  /* a bare "github.com" should still work */
  function normalizeUrl(raw) {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
    return "https://" + v.replace(/^\/+/, "");
  }

  /* --- section actions --- */
  function editCard(cardId) {
    const card = findCard(cardId);
    if (!card) return;
    openDialog("Rename section", [
      field("Name", "title", card.title, "Quick Links"),
      field("Label", "hint", card.hint, "Jump to", "Optional, shown when hovering the tab"),
    ], (data) => {
      const title = data.title.trim();
      if (!title) return dialogError("Give the section a name.");
      card.title = title;
      card.hint = data.hint.trim();
      commit();
    });
  }

  function addCard() {
    const ws = currentWs();
    if (!ws || privateLocked(ws)) return;
    openDialog("New section", [
      field("Name", "title", "", "Reading"),
      field("Label", "hint", "", "Later", "Optional, shown when hovering the tab"),
    ], (data) => {
      const title = data.title.trim();
      if (!title) return dialogError("Give the section a name.");
      const card = { id: uid("card"), title, hint: data.hint.trim(), items: [] };
      ws.cards.push(card);
      tabs[ws.id] = card.id; // jump to the new section
      store.set({ launcherTabs: JSON.stringify(tabs) });
      commit();
    });
  }

  function deleteCard(cardId) {
    const ws = currentWs();
    if (!ws) return;
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (i < 0) return;
    const card = ws.cards[i];
    const n = card.items.length;
    const msg = n
      ? 'Delete "' + card.title + '" and its ' + n + " shortcut" + (n === 1 ? "" : "s") + "?"
      : 'Delete "' + card.title + '"?';
    if (!confirm(msg)) return;
    ws.cards.splice(i, 1);
    commit();
  }

  function moveCard(cardId, delta) {
    const ws = currentWs();
    if (!ws) return;
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (moveBy(ws.cards, i, delta)) commit();
  }

  /* --- shortcut actions --- */
  function editItem(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return;
    const item = itemId ? card.items.find((it) => it.id === itemId) : null;
    if (itemId && !item) return;
    if (!item && privateLocked(currentWs())) return;

    openDialog(item ? "Edit shortcut" : "New shortcut", [
      field("Name", "name", item ? item.name : "", "GitHub"),
      field("URL", "url", item ? item.url : "", "github.com"),
      field("Icon", "icon", item ? item.icon : "", "github", "Optional icon name from config.js, or an image path"),
    ], (data) => {
      const name = data.name.trim();
      const url = normalizeUrl(data.url);
      if (!name) return dialogError("Give the shortcut a name.");
      if (!url) return dialogError("Give the shortcut a URL.");
      if (item) {
        item.name = name;
        item.url = url;
        item.icon = data.icon.trim();
      } else {
        card.items.push({ id: uid("item"), name, url, icon: data.icon.trim() });
      }
      commit();
    });
  }

  function deleteItem(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return;
    const i = card.items.findIndex((it) => it.id === itemId);
    if (i < 0) return;
    if (!confirm('Delete "' + card.items[i].name + '"?')) return;
    card.items.splice(i, 1);
    commit();
  }

  function moveItem(cardId, itemId, delta) {
    const card = findCard(cardId);
    if (!card) return;
    const i = card.items.findIndex((it) => it.id === itemId);
    if (moveBy(card.items, i, delta)) commit();
  }

  /* every mutation ends here: persist, redraw, close the dialog */
  function commit() {
    saveLayout();
    renderLauncher();
    closeDialog();
  }

  /* --- wiring ---------------------------------------------------------
     One delegated listener covers every ⋮, add button and dock control,
     so re-rendering never leaves stale listeners behind.                */
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-act]");
    if (!trigger) return;
    const act = trigger.dataset.act;
    if (act === "menu") { e.preventDefault(); openMenu(trigger); }
    else if (act === "add-item") { e.preventDefault(); editItem(trigger.dataset.card, null); }
    else if (act === "add-card") { e.preventDefault(); addCard(); }
    else if (act === "add-note") { e.preventDefault(); addNote(); }
    else if (act === "del-note") { e.preventDefault(); deleteNote(trigger.dataset.id); }
    else if (act === "save-tabs") { e.preventDefault(); saveOpenTabs(); }
  });

  /* close the menu on an outside click, and on scroll/resize where the
     anchored position would otherwise drift away from its button */
  document.addEventListener("mousedown", (e) => {
    if (!ctxOwner) return;
    if (ctxMenu.contains(e.target) || e.target.closest('[data-act="menu"]')) return;
    closeMenu();
  });
  addEventListener("resize", closeMenu);
  [gridEl, tabsEl].forEach((d) => d.addEventListener("scroll", closeMenu, { passive: true }));

  dlgForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!dlgSubmit) return;
    const data = {};
    dlgFields.querySelectorAll("input").forEach((i) => (data[i.name] = i.value));
    dlgSubmit(data);
  });
  $("editCancel").addEventListener("click", closeDialog);
  $("editBackdrop").addEventListener("click", closeDialog);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!dlg.hidden) { e.preventDefault(); closeDialog(); }
    else if (ctxOwner) { e.preventDefault(); closeMenu(); }
  });

  /* ================= QUICK PEEK (most-used shortcuts) ==================== */
  let usage = {};
  function bumpUsage(item) {
    /* usage is stored in the clear and shown by Quick Peek — private
       shortcuts stay out of it */
    if (isPrivateItem(item)) return;
    const k = item.url;
    usage[k] = usage[k] || { name: item.name, icon: item.icon, url: item.url, n: 0 };
    usage[k].n += 1;
    store.set({ usage: JSON.stringify(usage) });
  }
  /* opening a shortcut anywhere but a plain link click goes through here so
     usage tracking stays consistent with the tiles */
  function openShortcut(item) {
    if (!item || !item.url) return;
    bumpUsage(item);
    window.location.href = item.url;
  }

  function renderPeek() {
    const panel = $("peekPanel");
    const top = Object.values(usage).sort((a, b) => b.n - a.n).slice(0, 5);
    panel.innerHTML = "";
    if (!top.length) {
      const p = document.createElement("div");
      p.style.cssText = "padding:8px 9px;font-size:12px;color:var(--ink-faint)";
      p.textContent = "Open a few shortcuts and they'll show up here.";
      panel.appendChild(p);
      return;
    }
    top.forEach((t) => {
      const a = document.createElement("a");
      a.href = t.url;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = t.name;
      a.append(makeIcon(t, "g"), n);
      panel.appendChild(a);
    });
  }
  $("peekToggle").addEventListener("click", () => {
    const panel = $("peekPanel");
    if (panel.hidden) renderPeek();
    panel.hidden = !panel.hidden;
  });

  /* ================= SEARCH ==============================================
     The bar searches the default engine (Customize > Widgets > Search bar),
     switched from the engine button on its left. "!yt cats" sends a single
     search to another engine by its keyword. An engine URL may mark the
     query with %s; otherwise the query is appended.
     History is kept apart: it is only shown in its own panel (the clock
     button), never as suggestions under the field. */
  const qEl = $("q");
  const engineBtn = $("searchEngine");
  const engineIconEl = $("searchEngineIcon");
  const engineMenu = $("engineMenu");
  const histBtn = $("searchHist");
  const histPanel = $("histPanel");
  const HISTORY_KEY = "searchHistory";
  const HISTORY_MAX = 100;
  let searches = [];    // history: [{ q, engine, at }], newest first
  let shownEngine = ""; // engine id the icon currently shows

  function searchUrl(q, eng) {
    const url = (eng || AS.engine()).url;
    const term = encodeURIComponent(q);
    return url.includes("%s") ? url.split("%s").join(term) : url + term;
  }

  /* "!yt cats" -> { engine: YouTube, term: "cats" }; anything else goes to
     the default engine unchanged */
  function parseQuery(raw) {
    const q = raw.trim();
    const m = q.match(/^!(\S+)(?:\s+([\s\S]*))?$/);
    if (m) {
      const key = m[1].toLowerCase();
      const eng = AS.engines().find((e) => e.key && e.key === key);
      if (eng) return { engine: eng, term: (m[2] || "").trim(), bang: true };
    }
    return { engine: AS.engine(), term: q, bang: false };
  }

  /* an engine's badge: its icon from config.js, or a letter on its colour */
  function engineBadge(eng, cls) {
    if (eng.icon && iconSrc(eng.icon)) return makeIcon({ name: eng.label, icon: eng.icon }, cls + " is-img");
    const b = document.createElement("span");
    b.className = cls + " is-mono";
    b.textContent = eng.mono || eng.label[0];
    b.style.setProperty("--tint", eng.tint || "var(--accent)");
    return b;
  }

  function showEngine(eng, bang) {
    engineBtn.classList.toggle("is-bang", !!bang);
    if (shownEngine === eng.id) return;
    shownEngine = eng.id;
    engineIconEl.textContent = "";
    engineIconEl.appendChild(engineBadge(eng, "sx-badge"));
    engineBtn.setAttribute("aria-label", "Search engine: " + eng.label + ". Change");
    engineBtn.title = eng.label;
    /* a small hop so the switch registers */
    engineIconEl.classList.remove("is-swap");
    void engineIconEl.offsetWidth;
    engineIconEl.classList.add("is-swap");
  }

  function syncSearchLabel() {
    const label = "Search " + AS.engine().label;
    qEl.placeholder = label + "...";
    qEl.setAttribute("aria-label", label);
    const p = parseQuery(qEl.value);
    showEngine(p.engine, p.bang);
    histBtn.hidden = !AS.get().widgets.search.history;
    if (histBtn.hidden) closeSearchPop(true);
  }
  /* the icon previews a !keyword as it is typed */
  qEl.addEventListener("input", () => {
    const p = parseQuery(qEl.value);
    showEngine(p.engine, p.bang);
  });

  /* every search — the bar, history, the Command Center — ends here */
  function runSearch(term, eng) {
    const t = String(term || "").trim();
    if (!t) return;
    const e = eng || AS.engine();
    remember(t, e.id);
    window.location.href = searchUrl(t, e);
  }

  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = parseQuery(qEl.value);
    if (!p.term) return;
    runSearch(p.term, p.engine);
  });

  /* --- voice typing: the mic on the bar (Customize > Language). What
     you say fills the field as you speak; when you stop, it searches
     (or waits for Enter, if "Search when I stop talking" is off). --- */
  const Voice = window.AtlasVoice;
  /* voice typing and spoken answers are part of Atlas Pro: a free account
     gets the upgrade box (pro.js) instead */
  const voicePro = () => !!window.AtlasPro && AtlasPro.need("Voice typing and the assistant's voice are part of Atlas Pro.");
  const voiceAllowed = () => !window.AtlasPro || AtlasPro.isPro();
  const searchMic = $("searchMic");
  let searchRec = null;

  /* the language voice typing listens for: its own setting, else the one
     passed in (the assistant's answer language), else the translation
     language, else Chrome's */
  function listenTag(fallback) {
    const L = AS.get().language;
    const code = L.voiceLang !== "auto" ? L.voiceLang : fallback && fallback !== "auto" ? fallback : L.lang;
    return Voice.speechTag(code);
  }
  function micTrouble(err, show) {
    const text = Voice.errorText(err);
    if (!text) return;
    const blocked = err === "not-allowed" || err === "service-not-allowed";
    show(text, blocked ? () => Voice.openMicSetup() : null, "Allow microphone");
  }
  function syncSearchMic() {
    searchMic.hidden = !Voice || !Voice.canListen || !AS.get().language.searchMic;
    if (searchMic.hidden && searchRec) searchRec.abort();
  }
  function searchByVoice() {
    if (searchRec) return searchRec.stop();
    if (!Voice || voicePro()) return;
    const before = qEl.value;
    searchMic.classList.add("is-live");
    searchMic.setAttribute("aria-pressed", "true");
    qEl.placeholder = "Listening…";
    searchRec = Voice.listen({
      lang: listenTag(),
      onText: (t) => {
        qEl.value = t;
        qEl.dispatchEvent(new Event("input"));
      },
      onEnd: (t, err) => {
        searchRec = null;
        searchMic.classList.remove("is-live");
        searchMic.setAttribute("aria-pressed", "false");
        syncSearchLabel();
        qEl.focus();
        if (!t) {
          qEl.value = before;
          qEl.dispatchEvent(new Event("input"));
          if (err && err !== "aborted") micTrouble(err, toast);
          return;
        }
        qEl.value = t;
        qEl.dispatchEvent(new Event("input"));
        if (AS.get().language.searchAuto) $("search").requestSubmit();
      },
    });
  }
  searchMic.addEventListener("click", searchByVoice);
  qEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchRec) searchRec.abort();
  });

  /* --- history --- */
  function remember(q, engineId) {
    if (!AS.get().widgets.search.history) return;
    searches = searches.filter((h) => !(h.q === q && h.engine === engineId));
    searches.unshift({ q, engine: engineId, at: Date.now() });
    if (searches.length > HISTORY_MAX) searches.length = HISTORY_MAX;
    saveHistory();
  }
  function saveHistory() {
    store.set({ [HISTORY_KEY]: JSON.stringify(searches) });
  }
  function loadHistory(raw) {
    try {
      const list = typeof raw === "string" ? JSON.parse(raw) : raw;
      searches = (Array.isArray(list) ? list : [])
        .filter((h) => h && typeof h.q === "string" && h.q.trim())
        .map((h) => ({ q: h.q, engine: typeof h.engine === "string" ? h.engine : "google", at: Number(h.at) || 0 }))
        .slice(0, HISTORY_MAX);
    } catch { searches = []; }
  }
  AS.app.clearSearchHistory = () => {
    searches = [];
    saveHistory();
    if (!histPanel.hidden) renderHistory();
  };

  function ago(at) {
    const s = Math.max(0, (Date.now() - at) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
    return new Date(at).toLocaleDateString([], { day: "numeric", month: "short" });
  }

  /* --- the two pop-ups (engine menu, history panel) ---------------------
     They sit outside the bar (its backdrop blur would flatten theirs) and
     are placed against it: above when the bar is low on the screen, below
     when it has been moved up. */
  let popOpen = null; // the pop-up showing, if any

  function placePop(pop, alignRight) {
    const r = $("search").getBoundingClientRect();
    const below = r.top + r.height / 2 < innerHeight / 2;
    pop.classList.toggle("is-below", below);
    pop.style.top = below ? r.bottom + 10 + "px" : "auto";
    pop.style.bottom = below ? "auto" : innerHeight - r.top + 10 + "px";
    const w = pop.offsetWidth;
    const left = alignRight ? r.right - w : r.left;
    pop.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + "px";
  }

  function openSearchPop(pop, btn) {
    closeSearchPop(true);
    popOpen = pop;
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    btn.classList.add("is-open");
    placePop(pop, pop === histPanel);
  }
  function closeSearchPop(silent) {
    if (!popOpen) return;
    const pop = popOpen;
    popOpen = null;
    const hadFocus = pop.contains(document.activeElement);
    pop.hidden = true;
    [engineBtn, histBtn].forEach((b) => { b.setAttribute("aria-expanded", "false"); b.classList.remove("is-open"); });
    if (!silent && hadFocus) qEl.focus();
  }

  /* engine menu: every engine, the default marked, its !keyword beside it */
  function renderEngineMenu() {
    engineMenu.textContent = "";
    const current = AS.engine().id;
    const all = AS.engines();
    const add = (list, title) => {
      if (!list.length) return;
      const g = document.createElement("div");
      g.className = "sx-group";
      g.textContent = title;
      engineMenu.appendChild(g);
      list.forEach((eng, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sx-item" + (eng.id === current ? " is-on" : "");
        b.setAttribute("role", "menuitemradio");
        b.setAttribute("aria-checked", String(eng.id === current));
        b.style.setProperty("--i", i);
        b.appendChild(engineBadge(eng, "sx-badge"));
        const name = document.createElement("span");
        name.className = "sx-name";
        name.textContent = eng.label;
        b.appendChild(name);
        if (eng.key) {
          const k = document.createElement("kbd");
          k.textContent = "!" + eng.key;
          b.appendChild(k);
        }
        b.addEventListener("click", () => {
          AS.set("widgets.search.engine", eng.id); // the settings listener re-syncs the bar
          closeSearchPop(true);
          qEl.focus();
        });
        engineMenu.appendChild(b);
      });
    };
    add(all.filter((e) => !e.custom), "Search with");
    add(all.filter((e) => e.custom), "Your engines");
    const more = document.createElement("button");
    more.type = "button";
    more.className = "sx-more";
    more.textContent = "+ Add a custom engine";
    more.addEventListener("click", () => { closeSearchPop(true); AS.open("widgets"); });
    engineMenu.appendChild(more);
  }

  engineBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popOpen === engineMenu) return closeSearchPop();
    renderEngineMenu();
    openSearchPop(engineMenu, engineBtn);
    const on = engineMenu.querySelector(".sx-item.is-on") || engineMenu.querySelector(".sx-item");
    if (on) on.focus();
  });

  /* history panel: a filter, the list, and Clear all */
  let histFilter = "";
  function renderHistory() {
    histPanel.textContent = "";
    const head = document.createElement("div");
    head.className = "sx-hist-head";
    const title = document.createElement("span");
    title.className = "sx-hist-title";
    title.textContent = "Recent searches";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "sx-link";
    clear.textContent = "Clear all";
    clear.disabled = !searches.length;
    clear.addEventListener("click", () => {
      if (confirm("Clear your search history?")) AS.app.clearSearchHistory();
    });
    head.append(title, clear);

    const filter = document.createElement("input");
    filter.type = "text";
    filter.className = "sx-filter";
    filter.placeholder = "Filter history…";
    filter.setAttribute("aria-label", "Filter search history");
    filter.spellcheck = false;
    filter.value = histFilter;

    const list = document.createElement("div");
    list.className = "sx-hist-list";
    const paint = () => {
      list.textContent = "";
      const f = histFilter.trim().toLowerCase();
      const rows = f ? searches.filter((h) => h.q.toLowerCase().includes(f)) : searches;
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "sx-empty";
        empty.textContent = searches.length ? "Nothing matches." : "Your searches will show up here.";
        list.appendChild(empty);
        return;
      }
      rows.slice(0, 50).forEach((h, i) => list.appendChild(historyRow(h, i)));
    };
    filter.addEventListener("input", () => { histFilter = filter.value; paint(); });
    paint();
    histPanel.append(head, filter, list);
  }

  function historyRow(h, i) {
    const eng = AS.findEngine(h.engine) || AS.engine();
    const row = document.createElement("div");
    row.className = "sx-row";
    row.style.setProperty("--i", Math.min(i, 12));
    const go = document.createElement("button");
    go.type = "button";
    go.className = "sx-row-go";
    go.title = "Search " + eng.label + " again";
    go.appendChild(engineBadge(eng, "sx-badge"));
    const text = document.createElement("span");
    text.className = "sx-row-q";
    text.textContent = h.q;
    const when = document.createElement("span");
    when.className = "sx-row-when";
    when.textContent = ago(h.at);
    go.append(text, when);
    go.addEventListener("click", () => runSearch(h.q, eng));

    const put = document.createElement("button");
    put.type = "button";
    put.className = "sx-row-btn";
    put.title = "Edit in the search bar";
    put.setAttribute("aria-label", "Put “" + h.q + "” in the search bar");
    put.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17 7 7M7 15V7h8"/></svg>';
    put.addEventListener("click", () => {
      /* a search made on another engine comes back as its !keyword */
      const other = eng.id !== AS.engine().id && eng.key;
      qEl.value = (other ? "!" + eng.key + " " : "") + h.q;
      qEl.dispatchEvent(new Event("input"));
      closeSearchPop(true);
      qEl.focus();
      qEl.setSelectionRange(qEl.value.length, qEl.value.length);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "sx-row-btn is-del";
    del.title = "Remove from history";
    del.setAttribute("aria-label", "Remove “" + h.q + "” from history");
    del.textContent = "✕";
    del.addEventListener("click", () => {
      searches = searches.filter((x) => x !== h);
      saveHistory();
      row.classList.add("is-leaving");
      setTimeout(() => { if (popOpen === histPanel) renderHistory(); }, 180);
    });
    row.append(go, put, del);
    return row;
  }

  histBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popOpen === histPanel) return closeSearchPop();
    histFilter = "";
    renderHistory();
    openSearchPop(histPanel, histBtn);
    const f = histPanel.querySelector(".sx-filter");
    if (f) f.focus();
  });

  /* close on an outside click, Esc, or a resize (the bar may have moved) */
  document.addEventListener("mousedown", (e) => {
    if (!popOpen) return;
    if (popOpen.contains(e.target) || engineBtn.contains(e.target) || histBtn.contains(e.target)) return;
    closeSearchPop(true);
  });
  document.addEventListener("keydown", (e) => {
    if (!popOpen) return;
    if (e.key === "Escape") { e.preventDefault(); closeSearchPop(); return; }
    /* arrow keys walk the menu / list */
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = Array.from(popOpen.querySelectorAll(".sx-item, .sx-more, .sx-row-go"));
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next].focus();
    }
  });
  addEventListener("resize", () => closeSearchPop(true));

  /* ================= AI CHAT =============================================
     The panel talks to AI_CONFIG.endpoint (server/chat.js). While a reply is
     on its way a "typing" bubble shows and the status reads Thinking…      */
  const aiPanel = $("aiPanel");
  const aiLog = $("aiLog");
  const aiInput = $("aiInput");
  const aiSend = $("aiSend");
  const aiStatus = $("aiStatus");
  const aiStatusText = $("aiStatusText");
  const aiMic = $("aiMic");
  const aiTalk = $("aiTalk");
  const aiVoiceBtn = $("aiVoice");
  const aiHint = $("aiHint");
  const AI_HINT = aiHint.textContent;
  let aiSeeded = false;
  let aiBusy = false;
  let typingRow = null;
  const history = [];

  aiPanel.insertAdjacentHTML("afterbegin", TRACE_SVG); // border light

  const clockTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: !AS.get().widgets.clock.h24,
    });

  function msgRow(who) {
    const row = document.createElement("div");
    row.className = "msg-row " + who;
    if (who === "bot") {
      const av = document.createElement("span");
      av.className = "msg-av";
      av.setAttribute("aria-hidden", "true");
      av.textContent = "✦";
      row.appendChild(av);
    }
    const col = document.createElement("div");
    col.className = "msg-col";
    row.appendChild(col);
    return [row, col];
  }

  /* Gemini answers in light markdown. Render just **bold**, `code` and
     bullet lines; everything is escaped first, so no HTML gets through. */
  function formatReply(text) {
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    return text
      .split("\n")
      .map((line) => {
        const html = esc(line)
          .replace(/^#{1,6}\s+(.*)$/, "<strong>$1</strong>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        const bullet = html.match(/^\s*[*\-•]\s+(.*)$/);
        return bullet ? '<span class="li">' + bullet[1] + "</span>" : html + "\n";
      })
      .join("")
      .replace(/\n+$/, "");
  }

  function addMsg(text, who, isError) {
    const [row, col] = msgRow(who);
    const d = document.createElement("div");
    d.className = "msg " + who + (isError ? " is-error" : "");
    if (who === "bot" && !isError) d.innerHTML = formatReply(text);
    else d.textContent = text;
    /* the page translator leaves the conversation itself alone */
    if (who === "me" || !isError) d.setAttribute("translate", "no");
    const t = document.createElement("span");
    t.className = "msg-time";
    t.textContent = clockTime();
    t.setAttribute("translate", "no");
    col.append(d, t);
    /* any answer can be read out loud */
    let say = null;
    if (who === "bot" && !isError && Voice && Voice.canSpeak) {
      say = document.createElement("button");
      say.type = "button";
      say.className = "msg-say";
      say.title = "Read out loud";
      say.setAttribute("aria-label", "Read out loud");
      say.innerHTML = SPEAK_SVG;
      say.addEventListener("click", () => (speakingBtn === say ? stopSpeaking() : voicePro() ? null : sayReply(text, say)));
      const meta = document.createElement("span");
      meta.className = "msg-meta";
      meta.append(t, say);
      col.append(meta);
    }
    aiLog.appendChild(row);
    aiLog.scrollTop = aiLog.scrollHeight;
    return say;
  }

  function setStatus(state) {
    aiStatus.classList.toggle("is-busy", state === "busy");
    aiStatus.classList.toggle("is-off", state === "off");
    aiStatusText.textContent =
      state === "busy" ? "Thinking…" : state === "off" ? "Not connected" : "Online";
  }

  function setBusy(on) {
    aiBusy = on;
    setStatus(on ? "busy" : AI_CONFIG.endpoint ? "on" : "off");
    syncSend();
    if (on) {
      const [row, col] = msgRow("bot");
      row.classList.add("is-typing");
      const d = document.createElement("div");
      d.className = "msg bot typing";
      d.setAttribute("aria-label", "Atlas is typing");
      d.innerHTML = "<i></i><i></i><i></i>";
      col.appendChild(d);
      aiLog.appendChild(row);
      typingRow = row;
      aiLog.scrollTop = aiLog.scrollHeight;
    } else if (typingRow) {
      typingRow.remove();
      typingRow = null;
    }
  }

  /* the box grows with what you type, up to a few lines */
  function fitInput() {
    aiInput.style.height = "auto";
    aiInput.style.height = Math.min(aiInput.scrollHeight, 120) + "px";
    aiInput.style.overflowY = aiInput.scrollHeight > 120 ? "auto" : "hidden";
  }
  function syncSend() {
    aiSend.disabled = aiBusy || !aiInput.value.trim();
  }
  aiInput.addEventListener("input", () => { fitInput(); syncSend(); });
  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("aiForm").requestSubmit();
    }
  });

  /* ---- voice: speaking answers, voice typing, talk mode ----
     Settings live in Customize > Language (language.ai.*); the ◖) button
     in the header has the quick ones. */
  const SPEAK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  let speakingBtn = null;
  let chatRec = null;
  let talk = false;
  let hintTimer = 0;

  /* the line under the box doubles as the voice status */
  function setHint(text, action, label) {
    clearTimeout(hintTimer);
    aiHint.textContent = text || AI_HINT;
    aiHint.classList.toggle("is-live", !!text);
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", action);
      aiHint.append(" ", b);
    }
  }
  const flashHint = (text, action, label) => {
    setHint(text, action, label);
    hintTimer = setTimeout(() => setHint(), 8000);
  };

  /* the language an answer is spoken in: the one it was asked for, or the
     one it is written in */
  async function sayReply(text, btn) {
    stopSpeaking();
    const L = AS.get().language;
    const code = L.ai.reply !== "auto" ? L.ai.reply : (await Voice.detect(text)) || L.lang;
    speakingBtn = btn || null;
    if (btn) btn.classList.add("is-on");
    if (!chatRec) setHint("Speaking…", stopSpeaking, "Stop");
    const done = await Voice.speak(text, { voiceId: L.ai.voice, custom: L.ai.custom, lang: Voice.speechTag(code) });
    if (btn) btn.classList.remove("is-on");
    if (speakingBtn === btn) speakingBtn = null;
    if (!chatRec) setHint();
    return done;
  }
  function stopSpeaking() {
    if (Voice) Voice.stop();
    if (speakingBtn) speakingBtn.classList.remove("is-on");
    speakingBtn = null;
    if (!chatRec) setHint();
  }

  /* voice typing into the box; in talk mode it sends by itself */
  function listenChat() {
    if (chatRec || !Voice || !Voice.canListen) return;
    if (voicePro()) { if (talk) setTalk(false); return; }
    stopSpeaking();
    const before = talk ? "" : aiInput.value.trim();
    const put = (t) => {
      aiInput.value = before && t ? before + " " + t : before || t;
      fitInput();
      syncSend();
    };
    aiMic.classList.add("is-live");
    aiMic.setAttribute("aria-pressed", "true");
    setHint(talk ? "Talk mode · listening…" : "Listening… click the mic to stop");
    chatRec = Voice.listen({
      lang: listenTag(AS.get().language.ai.reply),
      onText: put,
      onEnd: (t, err) => {
        chatRec = null;
        aiMic.classList.remove("is-live");
        aiMic.setAttribute("aria-pressed", "false");
        setHint();
        if (!t) {
          if (talk) setTalk(false);
          if (err && err !== "aborted") micTrouble(err, flashHint);
          return;
        }
        put(t);
        if (talk) $("aiForm").requestSubmit();
        else aiInput.focus();
      },
    });
  }
  aiMic.addEventListener("click", () => (chatRec ? chatRec.stop() : listenChat()));

  /* talk mode: listen → send → speak the answer → listen again */
  function setTalk(on) {
    if (on && voicePro()) return;
    talk = on;
    aiTalk.classList.toggle("is-on", on);
    aiTalk.setAttribute("aria-pressed", String(on));
    $("ai").classList.toggle("is-talking", on);
    if (on) {
      if (aiPanel.hidden) openAi();
      if (!aiBusy) listenChat();
    } else {
      if (chatRec) chatRec.abort();
      stopSpeaking();
    }
  }
  aiTalk.addEventListener("click", () => setTalk(!talk));

  /* after an answer: read it out if asked to, then carry on talking */
  function afterReply(reply, sayBtn) {
    const ai = AS.get().language.ai;
    if ((talk || ai.speak) && Voice && Voice.canSpeak && voiceAllowed()) {
      sayReply(reply, sayBtn).then((finished) => { if (talk && finished) listenChat(); });
    } else if (talk) listenChat();
  }

  /* the chosen answer language rides along with the question */
  function withReplyLang(msgs) {
    const code = AS.get().language.ai.reply;
    const L = code !== "auto" && window.AtlasLangs && AtlasLangs.find(code);
    if (!L || !msgs.length) return msgs;
    const out = msgs.slice();
    const last = out[out.length - 1];
    out[out.length - 1] = { role: last.role, content: last.content + "\n\n(Answer in " + L.name + ".)" };
    return out;
  }

  /* the quick voice menu under the header */
  const vmenu = document.createElement("div");
  vmenu.className = "ai-vmenu";
  vmenu.hidden = true;
  vmenu.setAttribute("role", "dialog");
  vmenu.setAttribute("aria-label", "Voice and language");
  aiPanel.append(vmenu);

  function buildVoiceMenu() {
    const L = AS.get().language;
    const langs = window.AtlasLangs ? AtlasLangs.list : [];
    vmenu.textContent = "";
    const field = (label, control) => {
      const row = document.createElement("label");
      row.className = "ai-vrow";
      const span = document.createElement("span");
      span.textContent = label;
      row.append(span, control);
      vmenu.append(row);
      return control;
    };
    const select = (options, value, onChange, langNames) => {
      const sel = document.createElement("select");
      options.forEach(([v, text, groupLabel]) => {
        const o = new Option(text, v);
        sel.append(o);
        if (groupLabel) o.dataset.group = groupLabel;
      });
      sel.value = value;
      sel.addEventListener("change", () => onChange(sel.value));
      /* language names stay in their own words */
      if (langNames) [...sel.options].slice(1).forEach((o) => o.setAttribute("translate", "no"));
      return sel;
    };
    const langOpts = (first) => [first].concat(langs.map((l) => [l.code, AtlasLangs.label(l)]));

    if (Voice && Voice.canSpeak) {
      const sw = document.createElement("input");
      sw.type = "checkbox";
      sw.className = "cz-switch";
      sw.checked = L.ai.speak;
      sw.addEventListener("change", () => {
        if (sw.checked && voicePro()) { sw.checked = false; return; }
        AS.set("language.ai.speak", sw.checked);
        if (!sw.checked) stopSpeaking();
      });
      field("Read answers out loud", sw);
      const voices = Voice.PRESETS.map((p) => [p.id, p.name + " — " + p.hint])
        .concat(L.ai.custom.map((c) => [c.id, c.name + " — custom"]));
      field("Voice", select(voices, L.ai.voice, (v) => {
        AS.set("language.ai.voice", v);
        sayReply(AI_CONFIG.greeting);
      }));
    }
    field("Answers in", select(langOpts(["auto", "The language I use"]), L.ai.reply, (v) => AS.set("language.ai.reply", v), true));
    if (Voice && Voice.canListen) {
      field("Listen for", select(langOpts(["auto", "Automatic"]), L.voiceLang, (v) => AS.set("language.voiceLang", v), true));
    }
    const more = document.createElement("button");
    more.type = "button";
    more.className = "ai-vmore";
    more.textContent = "Custom voices & translation…";
    more.addEventListener("click", () => { closeVoiceMenu(); AS.open("language"); });
    vmenu.append(more);
  }
  function closeVoiceMenu() {
    vmenu.hidden = true;
    aiVoiceBtn.setAttribute("aria-expanded", "false");
    aiVoiceBtn.classList.remove("is-open");
  }
  aiVoiceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!vmenu.hidden) return closeVoiceMenu();
    buildVoiceMenu();
    vmenu.hidden = false;
    aiVoiceBtn.setAttribute("aria-expanded", "true");
    aiVoiceBtn.classList.add("is-open");
  });
  document.addEventListener("pointerdown", (e) => {
    if (!vmenu.hidden && !vmenu.contains(e.target) && !aiVoiceBtn.contains(e.target)) closeVoiceMenu();
  });
  vmenu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeVoiceMenu(); aiVoiceBtn.focus(); }
  });

  function syncVoiceUi() {
    const L = AS.get().language;
    const listen = !!(Voice && Voice.canListen);
    aiMic.hidden = !listen || !L.ai.mic;
    aiTalk.hidden = !listen || !(Voice && Voice.canSpeak);
    aiVoiceBtn.hidden = !Voice;
    if (aiMic.hidden && chatRec && !talk) chatRec.abort();
    syncSearchMic();
  }

  function greet() {
    addMsg(AI_CONFIG.endpoint ? AI_CONFIG.greeting : AI_CONFIG.notConfigured, "bot");
    /* ...except the greeting, which reads in the page's language */
    const g = aiLog.lastElementChild && aiLog.lastElementChild.querySelector(".msg");
    if (g) g.removeAttribute("translate");
  }

  function openAi() {
    aiPanel.hidden = false;
    if (!aiSeeded) {
      aiSeeded = true;
      setStatus(AI_CONFIG.endpoint ? "on" : "off");
      greet();
    }
    syncSend();
    aiInput.focus();
  }
  function closeAi() {
    aiPanel.hidden = true;
    closeVoiceMenu();
    setTalk(false);
  }
  $("aiToggle").addEventListener("click", () => (aiPanel.hidden ? openAi() : closeAi()));
  $("aiClose").addEventListener("click", closeAi);
  $("aiClear").addEventListener("click", () => {
    if (aiBusy) return;
    stopSpeaking();
    history.length = 0;
    aiLog.textContent = "";
    greet();
    aiInput.focus();
  });

  $("aiForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = aiInput.value.trim();
    if (!text || aiBusy) return;
    stopSpeaking();
    if (chatRec) chatRec.abort();
    addMsg(text, "me");
    history.push({ role: "user", content: text });
    aiInput.value = "";
    fitInput();
    if (!AI_CONFIG.endpoint) {
      addMsg(AI_CONFIG.notConfigured, "bot", true);
      syncSend();
      if (talk) setTalk(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(AI_CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: withReplyLang(history) }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok || !data.reply) {
        /* the failed question leaves the history, so it can simply be asked again */
        history.pop();
        addMsg("Assistant error: " + (data.error || "the server answered " + res.status), "bot", true);
        if (talk) setTalk(false);
        return;
      }
      history.push({ role: "assistant", content: data.reply });
      afterReply(data.reply, addMsg(data.reply, "bot"));
    } catch (err) {
      setBusy(false);
      setStatus("off");
      if (talk) setTalk(false);
      history.pop();
      addMsg("Couldn't reach the assistant server. Check your connection and AI_CONFIG.endpoint in config.js.", "bot", true);
    }
    aiInput.focus();
  });

  /* ================= COMMAND CENTER ======================================
     A keyboard-first palette over the existing UI. Every command delegates
     to the functions above — no second state, storage or search system.   */
  const cc = $("cc");
  const ccPanel = $("ccPanel");
  const ccInput = $("ccInput");
  const ccList = $("ccList");
  const ccEmpty = $("ccEmpty");

  let ccCommands = [];      // rebuilt whenever the palette opens
  let ccShown = [];         // the commands currently rendered, in order
  let ccSel = 0;            // index into ccShown
  let ccOpen = false;
  let ccLastFocus = null;
  let ccRaf = 0;

  /* --- command builders --- */

  /* every shortcut in every workspace, so search reaches past the active one */
  function createShortcutCommands() {
    const out = [];
    const seen = new Set();
    WORKSPACES.forEach((ws) => {
      (ws.cards || []).forEach((card) => {
        (card.items || []).forEach((item) => {
          if (!item || !item.name || !item.url) return;
          const key = item.url + "|" + item.name;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            id: "open:" + key,
            title: "Open " + item.name,
            description: ws.name + " · " + (card.title || ""),
            category: "Shortcuts",
            keywords: [item.name, ws.name, card.title || "", hostOf(item.url)],
            item,
            usageKey: item.url,
            run: () => openShortcut(item),
          });
        });
      });
    });
    return out;
  }

  function createWorkspaceCommands() {
    return WORKSPACES.map((ws) => ({
      id: "ws:" + ws.id,
      title: "Switch to " + ws.name,
      description: ws.id === activeWs ? "Current workspace" : "Workspace",
      category: "Workspaces",
      keywords: [ws.name, "workspace", "switch"],
      mark: "◈",
      run: () => setWorkspace(ws.id),
    }));
  }

  function createWallpaperCommands() {
    if (!WALLPAPERS.length) return [];
    return [
      {
        id: "wp:next",
        title: "Next Wallpaper",
        description: "Cycle forward through the wallpapers",
        category: "Wallpaper",
        keywords: ["wallpaper", "background", "video", "next", "change"],
        mark: "◑",
        run: () => stepWallpaper(1),
      },
      {
        id: "wp:prev",
        title: "Previous Wallpaper",
        description: "Cycle back through the wallpapers",
        category: "Wallpaper",
        keywords: ["wallpaper", "background", "video", "previous", "back"],
        mark: "◐",
        run: () => stepWallpaper(-1),
      },
    ];
  }

  function createSystemCommands() {
    const engine = AS.engine().label;
    return [
      {
        id: "sys:search",
        title: "Search " + engine,
        description: "Search the web for your query",
        category: "Search",
        keywords: ["search", "google", "web", "find", "query", engine.toLowerCase()],
        mark: "⌕",
        /* always reachable, even when nothing else matches */
        fallback: true,
        /* the title picks up whatever follows "search" as you type */
        dynamic: (query) => {
          const e = engine.toLowerCase();
          const term = stripLead(query, ["search " + e + " for", "search " + e, "search google for", "search google", "search", e, "google"]);
          return term ? { title: "Search " + engine + " for “" + term + "”", term } : null;
        },
        run: (cmd) => {
          const term = (cmd && cmd.term) || "";
          if (term) runSearch(term);
          else $("q").focus();
        },
      },
      {
        id: "sys:ai",
        title: "Ask Atlas",
        description: "Open the assistant",
        category: "Atlas",
        keywords: ["ai", "atlas", "assistant", "ask", "chat", "help"],
        mark: "✦",
        run: () => openAi(),
      },
      {
        id: "sys:zen",
        title: "Zen Clock",
        description: "A full-screen clock, with other places' time",
        category: "Atlas",
        keywords: ["zen", "clock", "time", "focus", "fullscreen", "world", "timezone", "date"],
        mark: "◷",
        run: () => window.AtlasZen && AtlasZen.open(),
      },
      {
        id: "sys:tools",
        title: "Quick Tools",
        description: "Notes, optimize, blocker, zen clock, minimal, quote",
        category: "Atlas",
        keywords: ["quick", "tools", "toolbox", "utilities"],
        mark: "⊞",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("home"),
      },
      {
        id: "sys:quote",
        title: "New Quote",
        description: "Another quote for today",
        category: "Atlas",
        keywords: ["quote", "quotes", "inspiration", "motivation", "daily", "saying"],
        mark: "❝",
        run: () => window.AtlasQuote && AtlasQuote.next(),
      },
      {
        id: "sys:quotes",
        title: "Daily Quote Settings",
        description: "Categories, how often it changes, your own quotes",
        category: "Atlas",
        keywords: ["quote", "quotes", "daily", "my quotes", "add quote"],
        mark: "❝",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("quote"),
      },
      {
        id: "sys:tasks",
        title: "Notes & Goals",
        description: "Notes, goals with progress, tasks with reminders",
        category: "Atlas",
        keywords: ["notes", "note", "goals", "goal", "tasks", "task", "todo", "to do", "progress", "checklist"],
        mark: "✓",
        run: () => window.AtlasQuickTools && AtlasQuickTools.openTasks(),
      },
      {
        id: "sys:planner",
        title: "Plan My Day",
        description: "AI plan for today from your tasks, calendar and habits",
        category: "Atlas",
        keywords: ["plan", "planner", "day", "schedule", "today", "ai", "agenda", "timeline", "time blocking"],
        mark: "✦",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("planner"),
      },
      {
        id: "sys:calendar",
        title: "Calendar",
        description: "Today and this week from Google Calendar",
        category: "Atlas",
        keywords: ["calendar", "google calendar", "events", "meetings", "agenda", "week", "today"],
        mark: "▦",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("calendar"),
      },
      {
        id: "sys:optimize",
        title: "Optimize Tabs",
        description: "Close duplicates, sleep tabs, auto optimize",
        category: "Tabs",
        keywords: ["optimize", "tabs", "memory", "sleep", "duplicate", "close", "clean", "speed", "performance"],
        mark: "⚡",
        run: () => window.AtlasQuickTools && AtlasQuickTools.openOptimize(),
      },
      {
        id: "sys:dedupe",
        title: "Close Duplicate Tabs",
        description: "Keep one tab per page",
        category: "Tabs",
        keywords: ["duplicate", "duplicates", "close", "tabs", "same"],
        mark: "⧉",
        run: () => window.AtlasQuickTools && AtlasQuickTools.closeDuplicates(),
      },
      {
        id: "sys:sleep",
        title: "Sleep Inactive Tabs",
        description: "Free memory; they reload when you open them",
        category: "Tabs",
        keywords: ["sleep", "discard", "suspend", "memory", "tabs", "ram"],
        mark: "☾",
        run: () => window.AtlasQuickTools && AtlasQuickTools.sleepTabs(),
      },
      {
        id: "sys:minimal",
        title: "Minimal Mode",
        description: "Hide everything but what you keep — on, off, or at set times",
        category: "Atlas",
        keywords: ["minimal", "minimalist", "clean", "quiet", "hide", "focus", "simple", "declutter"],
        mark: "▢",
        /* the title says which way it goes */
        dynamic: () => (window.AtlasMinimal && AtlasMinimal.isOn() ? { title: "Exit Minimal Mode" } : null),
        run: () => window.AtlasMinimal && AtlasMinimal.toggle(),
      },
      {
        id: "sys:minimalset",
        title: "Minimal Mode Settings",
        description: "What stays on screen, and when it turns on by itself",
        category: "Atlas",
        keywords: ["minimal", "schedule", "auto", "time", "settings"],
        mark: "▢",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("minimal"),
      },
      {
        id: "sys:focus",
        title: "Start Focus",
        description: "A 25-minute focus session that blocks distracting sites",
        category: "Focus",
        keywords: ["focus", "pomodoro", "timer", "work", "concentrate", "deep work", "study", "break"],
        mark: "◷",
        /* the title says what the button would do right now */
        dynamic: () => {
          const F = window.AtlasFocus;
          if (!F || !F.isRunning()) return null;
          return { title: F.state().paused ? "Resume Focus" : "Pause Focus" };
        },
        run: () => window.AtlasFocus && AtlasFocus.toggle(),
      },
      {
        id: "sys:focusview",
        title: "Focus Timer",
        description: "Timer, settings and your focus history",
        category: "Focus",
        keywords: ["focus", "pomodoro", "timer", "history", "sessions", "settings"],
        mark: "◷",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("focus"),
      },
      {
        id: "sys:stats",
        title: "Stats",
        description: "Time on each site, focus, tasks and habits — today, this week, this month",
        category: "Focus",
        keywords: ["stats", "statistics", "dashboard", "time", "screen time", "productivity", "report", "analytics", "weekly"],
        mark: "▥",
        run: () => window.AtlasStats && AtlasStats.open(),
      },
      {
        id: "sys:habits",
        title: "Habits",
        description: "Tick off today's habits and keep your streaks going",
        category: "Focus",
        keywords: ["habit", "habits", "streak", "daily", "routine", "tracker", "check"],
        mark: "✓",
        run: () => window.AtlasQuickTools && AtlasQuickTools.openHabits(),
      },
      {
        id: "sys:blocker",
        title: "Block Sites",
        description: "Keep distracting sites closed, always or at set times",
        category: "Atlas",
        keywords: ["block", "blocker", "focus", "distraction", "site", "website", "social"],
        mark: "⊘",
        run: () => window.AtlasQuickTools && AtlasQuickTools.open("blocker"),
      },
      {
        id: "sys:account",
        title: "Account",
        description: "Google sign-in, sync, plan and sign out",
        category: "Atlas",
        keywords: ["account", "google", "sign in", "login", "sign out", "logout", "profile", "sync", "pro", "upgrade"],
        mark: "◉",
        run: () => AS.open("account"),
      },
      {
        id: "sys:talk",
        title: "Talk to Atlas",
        description: "Speak your question, hear the answer",
        category: "Atlas",
        keywords: ["talk", "voice", "speak", "conversation", "mic", "microphone", "listen"],
        mark: "◖",
        run: () => setTalk(true),
      },
      {
        id: "sys:voicesearch",
        title: "Search by Voice",
        description: "Say what to search for",
        category: "Atlas",
        keywords: ["voice", "search", "mic", "microphone", "speak", "dictate"],
        mark: "◉",
        run: () => searchByVoice(),
      },
      {
        id: "sys:language",
        title: "Language & Translation",
        description: "Translate websites, voice typing, the assistant's voice",
        category: "Atlas",
        keywords: ["language", "translate", "translation", "urdu", "hindi", "arabic", "voice", "speech"],
        mark: "文",
        run: () => AS.open("language"),
      },
      {
        id: "sys:customize",
        title: "Customize",
        description: "Colours, background, lighting and widgets",
        category: "Atlas",
        keywords: ["customize", "customise", "theme", "color", "colour", "appearance", "settings", "style", "layout", "hide", "show", "move"],
        mark: "◐",
        run: () => AS.open(),
      },
      {
        id: "sys:reminder",
        title: "New Reminder",
        description: "An alarm at a time, date, weekday or every year",
        category: "Atlas",
        keywords: ["reminder", "remind", "alarm", "notification", "birthday", "schedule", "alert", "timer"],
        mark: "⏰",
        run: () => window.AtlasReminders && AtlasReminders.open(true),
      },
      {
        id: "sys:reminders",
        title: "Reminders",
        description: "See and edit your reminders and alarm sound",
        category: "Atlas",
        keywords: ["reminders", "alarms", "notifications", "birthdays", "sound"],
        mark: "◔",
        run: () => window.AtlasReminders && AtlasReminders.open(),
      },
      {
        id: "sys:wpschedule",
        title: "Schedule Wallpapers",
        description: "Change the wallpaper by itself at set times",
        category: "Wallpaper",
        keywords: ["wallpaper", "schedule", "timer", "time", "auto", "change", "background"],
        mark: "◑",
        run: () => AS.open("background"),
      },
      {
        id: "sys:background",
        title: "Change Background",
        description: "Live wallpaper, your own file, a colour or a gradient",
        category: "Atlas",
        keywords: ["background", "wallpaper", "image", "upload", "gradient", "color", "colour"],
        mark: "▣",
        run: () => AS.open("background"),
      },
    ];
  }

  /* the private space. While it is locked these stay out of the default
     list (`quiet`) — typing "private" finds them — unless the lock button
     is on the dock anyway */
  function createVaultCommands() {
    if (!V || !V.supported) return [];
    const keywords = ["private", "privacy", "vault", "lock", "unlock", "password", "hidden", "secret", "notes"];
    const base = { category: "Private space", keywords, mark: "◉" };
    if (!V.exists()) {
      return [Object.assign({}, base, {
        id: "vault:setup", title: "Set Up Private Space", quiet: true,
        description: "A password-locked workspace for shortcuts and notes",
        run: () => AS.open("privacy"),
      })];
    }
    if (!V.isUnlocked()) {
      return [Object.assign({}, base, {
        id: "vault:unlock", title: "Unlock Private Space", quiet: !AS.get().privacy.dock,
        description: "Enter your password", run: promptUnlock,
      })];
    }
    return [
      Object.assign({}, base, {
        id: "vault:folder", title: "Open Private Folder", description: "Your hidden shortcuts and notes, on a screen of their own",
        keywords: keywords.concat(["folder"]), run: () => openPrivateFolder("apps"),
      }),
      Object.assign({}, base, { id: "vault:open", title: "Private Space on the Dock", description: "Your private sections and shortcuts", run: openVault }),
      Object.assign({}, base, {
        id: "vault:notes", title: "Private Notes", description: "Open the private folder's notes",
        run: () => openPrivateFolder("notes"),
      }),
      Object.assign({}, base, { id: "vault:lock", title: "Lock Private Space", description: "Hide it again until the password is entered", mark: "○", run: () => V.lock() }),
    ];
  }

  function createCommands() {
    return [].concat(
      createShortcutCommands(),
      createWorkspaceCommands(),
      createWallpaperCommands(),
      createSystemCommands(),
      createVaultCommands()
    );
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  /* "search laravel queues" -> "laravel queues" */
  function stripLead(query, leads) {
    const q = query.trim();
    const lower = q.toLowerCase();
    for (const lead of leads) {
      if (lower === lead) return "";
      if (lower.startsWith(lead + " ")) return q.slice(lead.length + 1).trim();
    }
    return q;
  }

  /* --- ranking ---------------------------------------------------------
     Exact title > title prefix > word prefix > title contains > keyword >
     description. Usage count only breaks ties, so a frequently opened
     shortcut floats above an equally-matching one.                       */
  function scoreCommand(cmd, q) {
    const title = cmd.title.toLowerCase();
    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 68;
    if (title.includes(q)) return 55;
    const keys = cmd.keywords || [];
    if (keys.some((k) => k && k.toLowerCase().startsWith(q))) return 44;
    if (keys.some((k) => k && k.toLowerCase().includes(q))) return 32;
    if ((cmd.description || "").toLowerCase().includes(q)) return 20;
    return 0;
  }

  function usageOf(cmd) {
    const u = cmd.usageKey && usage[cmd.usageKey];
    return u ? u.n || 0 : 0;
  }

  function filterCommands(query) {
    const q = query.trim().toLowerCase();
    if (!q) return defaultCommands();

    const hits = [];
    ccCommands.forEach((cmd) => {
      const score = scoreCommand(cmd, q);
      if (score > 0) hits.push({ cmd, score });
    });
    hits.sort((a, b) => b.score - a.score || usageOf(b.cmd) - usageOf(a.cmd));

    const out = hits.map((h) => resolve(h.cmd, query));

    /* searching the web stays reachable for anything typed */
    const search = ccCommands.find((c) => c.fallback);
    if (search && !out.some((c) => c.id === search.id)) {
      const resolved = resolve(search, query);
      if (resolved.term) out.push(resolved);
    }
    return out;
  }

  /* a dynamic command (currently only Search) rewrites its own title from
     the query; everything else passes straight through */
  function resolve(cmd, query) {
    if (!cmd.dynamic) return cmd;
    const patch = cmd.dynamic(query);
    return patch ? Object.assign({}, cmd, patch) : cmd;
  }

  /* empty query: most-used shortcuts first (reusing the Quick Peek usage
     data), then workspaces, wallpaper controls and the assistant */
  function defaultCommands() {
    const shortcuts = ccCommands.filter((c) => c.category === "Shortcuts");
    const used = shortcuts
      .filter((c) => usageOf(c) > 0)
      .sort((a, b) => usageOf(b) - usageOf(a))
      .slice(0, 4);
    const usedIds = new Set(used.map((c) => c.id));

    /* nothing used yet — fall back to the active workspace's shortcuts */
    const name = wsName(activeWs);
    const fillers = shortcuts
      .filter((c) => !usedIds.has(c.id) && c.description.indexOf(name) === 0)
      .slice(0, Math.max(0, 4 - used.length));

    return [].concat(
      used,
      fillers,
      ccCommands.filter((c) => c.category !== "Shortcuts" && !c.fallback && !c.quiet)
    );
  }

  function wsName(id) {
    const ws = WORKSPACES.find((w) => w.id === id);
    return ws ? ws.name : "";
  }

  /* --- rendering -------------------------------------------------------
     One list rebuild per query, not per frame; a selection change only
     toggles a class on two rows.                                         */
  function renderCommands(list) {
    ccShown = list;
    ccList.textContent = "";

    if (!list.length) {
      ccEmpty.hidden = false;
      ccInput.removeAttribute("aria-activedescendant");
      return;
    }
    ccEmpty.hidden = true;

    const frag = document.createDocumentFragment();
    let group = null;
    list.forEach((cmd, i) => {
      if (cmd.category !== group) {
        group = cmd.category;
        const li = document.createElement("li");
        li.className = "cc-group";
        li.setAttribute("role", "presentation");
        li.textContent = group;
        frag.appendChild(li);
      }
      frag.appendChild(renderItem(cmd, i));
    });
    ccList.appendChild(frag);
    setSelection(0, false);
  }

  function renderItem(cmd, i) {
    const li = document.createElement("li");
    li.className = "cc-item";
    li.id = "cc-opt-" + i;
    li.dataset.index = String(i);
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");

    /* shortcuts carry their real icon; everything else gets a glyph */
    if (cmd.item) {
      li.appendChild(makeIcon(cmd.item, "cc-icon"));
    } else {
      const m = document.createElement("span");
      m.className = "cc-mark";
      m.setAttribute("aria-hidden", "true");
      m.textContent = cmd.mark || "✧";
      li.appendChild(m);
    }

    const text = document.createElement("span");
    text.className = "cc-text";
    const t = document.createElement("span");
    t.className = "cc-title";
    t.textContent = cmd.title;
    text.appendChild(t);
    if (cmd.description) {
      const d = document.createElement("span");
      d.className = "cc-desc";
      d.textContent = cmd.description;
      text.appendChild(d);
    }
    li.appendChild(text);

    const enter = document.createElement("span");
    enter.className = "cc-enter";
    enter.setAttribute("aria-hidden", "true");
    enter.textContent = "↵";
    li.appendChild(enter);

    return li;
  }

  function itemAt(i) {
    return ccList.querySelector(".cc-item[data-index=\"" + i + "\"]");
  }

  function setSelection(i, scroll) {
    if (!ccShown.length) return;
    const prev = itemAt(ccSel);
    if (prev) {
      prev.classList.remove("is-sel");
      prev.setAttribute("aria-selected", "false");
    }
    ccSel = Math.max(0, Math.min(i, ccShown.length - 1));
    const el = itemAt(ccSel);
    if (!el) return;
    el.classList.add("is-sel");
    el.setAttribute("aria-selected", "true");
    ccInput.setAttribute("aria-activedescendant", el.id);
    if (scroll !== false) el.scrollIntoView({ block: "nearest" });
  }

  function moveSelection(delta) {
    if (!ccShown.length) return;
    const n = ccShown.length;
    setSelection((((ccSel + delta) % n) + n) % n);
  }

  function refresh() {
    ccSel = 0;
    renderCommands(filterCommands(ccInput.value));
  }

  /* --- execute ---------------------------------------------------------- */
  function executeCommand(cmd) {
    if (!cmd || typeof cmd.run !== "function") return;
    closeCommandCenter();
    /* a broken command must never take the palette down with it */
    try {
      cmd.run(cmd);
    } catch (err) {
      console.error("Atlas command failed:", cmd.id, err);
    }
  }

  /* --- open / close ------------------------------------------------------ */
  function openCommandCenter() {
    if (ccOpen) return;
    ccOpen = true;
    ccLastFocus = document.activeElement;
    ccCommands = createCommands();
    ccInput.value = "";
    cc.hidden = false;
    refresh();
    ccInput.focus();
  }

  function closeCommandCenter() {
    if (!ccOpen) return;
    ccOpen = false;
    cc.hidden = true;
    ccList.textContent = "";
    ccShown = [];
    ccInput.removeAttribute("aria-activedescendant");
    /* hand focus back where it came from, but never to something gone */
    if (ccLastFocus && document.contains(ccLastFocus)) ccLastFocus.focus();
    else $("q").focus();
    ccLastFocus = null;
  }

  /* --- wiring ------------------------------------------------------------ */
  ccInput.addEventListener("input", () => {
    /* coalesce fast typing into one render per frame */
    if (ccRaf) cancelAnimationFrame(ccRaf);
    ccRaf = requestAnimationFrame(() => {
      ccRaf = 0;
      refresh();
    });
  });

  ccInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
    else if (e.key === "Home" && ccShown.length) { e.preventDefault(); setSelection(0); }
    else if (e.key === "End" && ccShown.length) { e.preventDefault(); setSelection(ccShown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); executeCommand(ccShown[ccSel]); }
    else if (e.key === "Escape") { e.preventDefault(); closeCommandCenter(); }
  });

  /* one delegated listener for the whole list */
  ccList.addEventListener("click", (e) => {
    const li = e.target.closest(".cc-item");
    if (!li) return;
    executeCommand(ccShown[Number(li.dataset.index)]);
  });
  ccList.addEventListener("mousemove", (e) => {
    const li = e.target.closest(".cc-item");
    if (!li) return;
    const i = Number(li.dataset.index);
    if (i !== ccSel) setSelection(i, false);
  });

  $("ccBackdrop").addEventListener("click", closeCommandCenter);
  /* clicks inside the panel (but outside the input) keep typing working */
  ccPanel.addEventListener("mousedown", (e) => {
    if (e.target !== ccInput) {
      e.preventDefault();
      if (ccOpen) ccInput.focus();
    }
  });

  document.addEventListener("keydown", (e) => {
    /* Ctrl+Space / Cmd+Space. Cmd+Space is usually swallowed by macOS
       Spotlight before it reaches the page — handled here for the cases
       where it does arrive. */
    if (e.code === "Space" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (ccOpen) closeCommandCenter();
      else openCommandCenter();
      return;
    }
    if (e.key === "Escape" && ccOpen) {
      e.preventDefault();
      closeCommandCenter();
    }
  });

  /* ================= NOW PLAYING =========================================
     Whatever is playing in another tab (see media-bridge.js and
     background.js). Hidden when nothing has played, or when the page is
     opened outside the extension. */
  (function nowPlaying() {
    const box = $("media");
    const hasRuntime =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.onMessage;
    if (!box || !hasRuntime) return;

    box.insertAdjacentHTML("afterbegin", TRACE_SVG);
    const img = $("mediaImg");
    const title = $("mediaTitle");
    const artist = $("mediaArtist");
    const fill = $("mediaFill");
    const bar = $("mediaBar");
    const cur = $("mediaCur");
    const dur = $("mediaDur");
    const toggle = $("mediaToggle");
    const prev = $("mediaPrev");
    const next = $("mediaNext");
    let now = null;
    let ticker = 0;

    const send = (msg) => {
      try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
    };
    const cmd = (action, time) => now && send({ type: "media:cmd", tabId: now.tabId, frameId: now.frameId, action, time });

    const fmt = (s) => {
      s = Math.max(0, Math.floor(s || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = String(s % 60).padStart(2, "0");
      return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
    };

    /* position is extrapolated between the worker's updates */
    function position() {
      if (!now) return 0;
      let p = now.position || 0;
      if (now.playing) p += ((Date.now() - now.at) / 1000) * (now.rate || 1);
      return now.duration ? Math.min(p, now.duration) : p;
    }

    function paintProgress() {
      if (!now) return;
      const d = now.duration || 0;
      const p = position();
      fill.style.width = d ? (p / d) * 100 + "%" : "0%";
      cur.textContent = d ? fmt(p) : "";
      dur.textContent = d ? fmt(d) : "LIVE";
    }

    function render(data) {
      now = data && data.title ? data : null;
      clearInterval(ticker);
      if (!now) {
        box.hidden = true;
        document.body.classList.remove("has-media");
        return;
      }
      box.hidden = false;
      document.body.classList.add("has-media");

      title.textContent = now.title;
      title.title = now.title;
      artist.textContent = [now.artist, now.source].filter(Boolean).join(" · ");
      $("mediaOpen").setAttribute("aria-label", `Open ${now.source || "the tab"}: ${now.title}`);

      if (now.art && img.getAttribute("src") !== now.art) img.src = now.art;
      img.hidden = !now.art;

      box.classList.toggle("is-paused", !now.playing);
      toggle.setAttribute("aria-label", now.playing ? "Pause" : "Play");
      prev.disabled = !(now.can && now.can.prev);
      next.disabled = !(now.can && now.can.next);
      bar.classList.toggle("is-seekable", !!(now.can && now.can.seek && now.duration));

      paintProgress();
      if (now.playing) ticker = setInterval(paintProgress, 500);
    }

    img.addEventListener("error", () => { img.hidden = true; });

    toggle.addEventListener("click", () => {
      if (!now) return;
      cmd("toggle");
      /* answer the click right away; the tab confirms a moment later */
      now = Object.assign({}, now, { playing: !now.playing, position: position(), at: Date.now() });
      render(now);
    });
    prev.addEventListener("click", () => cmd("prev"));
    next.addEventListener("click", () => cmd("next"));
    $("mediaOpen").addEventListener("click", () => {
      if (now) send({ type: "media:focus", tabId: now.tabId, windowId: now.windowId });
    });
    bar.addEventListener("click", (e) => {
      if (!now || !bar.classList.contains("is-seekable")) return;
      const r = bar.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * now.duration;
      cmd("seek", t);
      now = Object.assign({}, now, { position: t, at: Date.now() });
      paintProgress();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "media:now") render(msg.data);
    });
    const refresh = () => {
      try {
        chrome.runtime.sendMessage({ type: "media:get" }).then(render, () => {});
      } catch {}
    };
    refresh();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

    /* the left dock makes room for the widget, whatever height it ends up */
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        if (box.offsetHeight) {
          document.documentElement.style.setProperty("--media-h", box.offsetHeight + "px");
        }
      }).observe(box);
    }
  })();

  /* ================= WEATHER =============================================
     Current conditions from Open-Meteo (free, no key). Location, in order
     of preference: a city typed via the card, WEATHER_CONFIG.city, then the
     browser's own location. Cached for 30 minutes. */
  (function weather() {
    const btn = $("weather");
    if (!btn) return;
    const iconEl = $("weatherIcon");
    const tempEl = $("weatherTemp");
    const cityEl = $("weatherCity");
    const condEl = $("weatherCond");
    const cfg = typeof WEATHER_CONFIG !== "undefined" ? WEATHER_CONFIG : {};
    /* chosen in Customize (seeded from config.js) */
    const unitsNow = () => (AS.get().widgets.weather.units === "fahrenheit" ? "fahrenheit" : "celsius");
    const FRESH = 30 * 60 * 1000;

    const W_ICONS = {
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
      moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
      partly: '<path d="M8 3.5V5M3.5 8H5M4.8 4.8l1 1M11.2 4.8l-1 1"/><path d="M5.3 10.6a3 3 0 1 1 5.4-2.8"/><path d="M9 20h8a3.5 3.5 0 0 0 .5-6.96A4.5 4.5 0 0 0 8.8 12.3 3.9 3.9 0 0 0 9 20z"/>',
      cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.1 4.5 4.5 0 0 0 7 18z"/>',
      fog: '<path d="M4 8h16M6 12h12M4 16h16M8 20h8"/>',
      rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="m9 18-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
      snow: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="M9 18.5h.01M13 20h.01M17 18.5h.01" stroke-width="2.6"/>',
      storm: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="m12.5 15.5-2 3h3l-2 3"/>',
    };
    const wIcon = (k) =>
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      W_ICONS[k] + "</svg>";

    /* WMO weather codes -> words + icon */
    function describe(code, day) {
      const clear = day ? "sun" : "moon";
      if (code === 0) return ["Clear", clear];
      if (code === 1) return ["Mostly clear", clear];
      if (code === 2) return ["Partly cloudy", day ? "partly" : "cloud"];
      if (code === 3) return ["Overcast", "cloud"];
      if (code === 45 || code === 48) return ["Fog", "fog"];
      if (code >= 51 && code <= 57) return ["Drizzle", "rain"];
      if (code >= 61 && code <= 67) return ["Rain", "rain"];
      if (code >= 71 && code <= 77) return ["Snow", "snow"];
      if (code >= 80 && code <= 82) return ["Showers", "rain"];
      if (code === 85 || code === 86) return ["Snow showers", "snow"];
      if (code >= 95) return ["Thunderstorm", "storm"];
      return ["Cloudy", "cloud"];
    }

    let loc = null; // { name, lat, lon, manual?, fromConfig?, at }
    const parse = (v) => {
      try { return typeof v === "string" ? JSON.parse(v) : v || null; } catch { return null; }
    };

    function status(city, text) {
      tempEl.textContent = "--°";
      iconEl.innerHTML = wIcon("cloud");
      cityEl.textContent = city;
      condEl.textContent = text;
    }

    function paint(w) {
      const [text, icon] = describe(w.code, w.day);
      tempEl.textContent = Math.round(w.temp) + "°";
      iconEl.innerHTML = wIcon(icon);
      cityEl.textContent = loc.name || "Your location";
      condEl.textContent = text;
      btn.setAttribute("aria-label", `${Math.round(w.temp)} degrees, ${text} in ${cityEl.textContent}. Click to change city`);
    }

    async function load(force) {
      if (!loc) return;
      const units = unitsNow();
      const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)},${units}`;
      const cached = parse((await store.get(["weatherCache"])).weatherCache);
      const usable = cached && cached.key === key;
      if (!force && usable && Date.now() - cached.at < FRESH) return paint(cached);
      try {
        const r = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
          "&current=temperature_2m,weather_code,is_day&temperature_unit=" + units
        );
        if (!r.ok) throw new Error(r.status);
        const c = (await r.json()).current;
        const w = { key, at: Date.now(), temp: c.temperature_2m, code: c.weather_code, day: c.is_day === 1 };
        store.set({ weatherCache: JSON.stringify(w) });
        paint(w);
      } catch {
        if (usable) paint(cached);
        else status(loc.name || "Weather", "Offline");
      }
    }

    async function geocode(name) {
      const r = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" +
        encodeURIComponent(name)
      );
      const hit = r.ok && ((await r.json()).results || [])[0];
      return hit ? { name: hit.name, lat: hit.latitude, lon: hit.longitude } : null;
    }

    function locate() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no geolocation"));
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          reject,
          { timeout: 10000, maximumAge: 60 * 60 * 1000 }
        );
      });
    }

    /* coordinates -> a city name for the card */
    async function placeName(lat, lon) {
      try {
        const r = await fetch(
          "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en&latitude=" + lat + "&longitude=" + lon
        );
        const j = await r.json();
        return j.city || j.locality || j.principalSubdivision || "";
      } catch {
        return "";
      }
    }

    async function useCurrentLocation() {
      status("Weather", "Locating…");
      try {
        const p = await locate();
        loc = { name: await placeName(p.lat, p.lon), lat: p.lat, lon: p.lon, at: Date.now() };
        store.set({ weatherLoc: JSON.stringify(loc) });
        await load(true);
      } catch {
        loc = null;
        status("Weather", "Click to set city");
      }
    }

    async function useCity(name, extra) {
      const hit = await geocode(name);
      if (!hit) return false;
      loc = Object.assign(hit, extra, { at: Date.now() });
      store.set({ weatherLoc: JSON.stringify(loc) });
      await load(true);
      return true;
    }

    btn.addEventListener("click", () => {
      openDialog("Weather location", [
        field("City", "city", loc && loc.manual ? loc.name : "", "Karachi", "Leave empty to use your current location"),
      ], async (data) => {
        const city = data.city.trim();
        if (!city) {
          closeDialog();
          store.set({ weatherLoc: "" });
          useCurrentLocation();
          return;
        }
        try {
          if (await useCity(city, { manual: true })) closeDialog();
          else dialogError("Couldn't find that city. Try adding the country, e.g. \"Lahore, Pakistan\".");
        } catch {
          dialogError("Couldn't reach the weather service. Check your connection.");
        }
      });
    });

    Promise.all([store.get(["weatherLoc"]), AS.ready]).then(async ([s]) => {
      loc = parse(s.weatherLoc);
      if (loc && !(isFinite(loc.lat) && isFinite(loc.lon))) loc = null;
      const cfgCity = typeof cfg.city === "string" ? cfg.city.trim() : "";
      try {
        if (cfgCity && !(loc && (loc.manual || loc.fromConfig === cfgCity))) {
          if (await useCity(cfgCity, { fromConfig: cfgCity })) return;
        }
      } catch {}
      /* a detected location is re-checked every few hours in case you moved */
      if (loc && !loc.manual && !loc.fromConfig && Date.now() - (loc.at || 0) > 6 * 60 * 60 * 1000) {
        return useCurrentLocation();
      }
      if (loc) return load();
      useCurrentLocation();
    });

    setInterval(() => load(), FRESH);
    /* the cache is keyed by units, so a switch refetches on its own */
    AS.on((s, path) => {
      if (path === "*" || path === "widgets.weather.units") load();
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  })();

  /* ================= LAUNCHER: CLOSE ===================================
     Esc (when nothing else used it) or a click on the bare wallpaper hides
     the launcher again. Registered last so dialogs, menus and the command
     center get the Escape key first. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && launcherOpen && !e.defaultPrevented) setLauncherOpen(false);
  });
  document.querySelector(".wallpaper").addEventListener("click", () => {
    if (launcherOpen) setLauncherOpen(false);
  });
  /* right-click on the bare wallpaper opens Customize — the way back in
     even when every widget has been hidden */
  document.querySelector(".wallpaper").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    AS.open();
  });

  /* wallpapers and their library previews can't be saved the easy ways: no
     "Save image / video as" or "Copy address" menu, no dragging them out,
     no picture-in-picture or casting */
  const WP_MEDIA = ".wallpaper, .cz-pwp, .cz-pwps";
  document.addEventListener("contextmenu", (e) => {
    if (e.target instanceof Element && e.target.closest(WP_MEDIA) && !e.target.closest("a[href]")) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    if (e.target instanceof Element && e.target.matches("img, video") && e.target.closest(WP_MEDIA)) e.preventDefault();
  });
  document.querySelectorAll(".wallpaper video").forEach((v) => {
    v.disablePictureInPicture = true;
    v.setAttribute("disableremoteplayback", "");
    v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
  });

  /* ================= SETTINGS -> BEHAVIOUR ===============================
     customize.js restyles the page itself; these are the settings that need
     the app to act. "*" means many changed at once (preset, reset, import). */
  AS.on((s, path) => {
    const all = path === "*";
    /* choosing a colour / image / gradient by hand also holds off the schedule */
    if (path === "background.mode" && !wpScheduling) markManual();
    if (path.startsWith("background.schedule")) {
      /* an edited schedule takes charge from its next time: the wallpaper
         on screen now stays until then (a rule's last time — yesterday at
         18:00, say — would otherwise switch it the moment it's saved) */
      markManual();
    }
    if (all || path.startsWith("background.schedule")) applyWallpaperSchedule(false);
    if (all || path.startsWith("background.")) applyBackground();
    if (all || path.startsWith("widgets.clock.")) {
      renderClock();
      requestAnimationFrame(syncClockHeight); // after the new CSS lands
    }
    if (all || path.startsWith("widgets.search.")) syncSearchLabel();
    if (all || path.startsWith("language.")) syncVoiceUi();
    if (all || path.startsWith("privacy.")) {
      if (activeWs) renderRail(); // the lock button
      if (V && (all || path === "privacy.stay")) V.setStay(s.privacy.stay);
    }
  });

  /* ================= BOOT ================================================ */
  Promise.all([
    store.get(["wallpaper", "workspace", "usage", "launcherTabs", HISTORY_KEY, WP_MANUAL_KEY, LAYOUT_KEY]),
    AS.ready,
    V ? V.ready : null,
    window.AtlasLibrary ? AtlasLibrary.ready : null,
  ]).then(([s]) => {
    /* the saved layout replaces the config.js defaults; a first launch, or
       anything unreadable, falls back to them */
    applyLayout(loadLayout(s[LAYOUT_KEY]));
    activeWs = WORKSPACES[0].id;
    if (s.workspace && WORKSPACES.some((w) => w.id === s.workspace)) activeWs = s.workspace;
    try { usage = s.usage ? JSON.parse(s.usage) : {}; } catch { usage = {}; }
    try { tabs = s.launcherTabs ? JSON.parse(s.launcherTabs) || {} : {}; } catch { tabs = {}; }
    loadHistory(s[HISTORY_KEY]);
    renderRail();
    renderLauncher();
    renderClock();
    syncSearchLabel();
    syncVoiceUi();
    syncClockHeight();
    currentWp = (WALLPAPERS.find((w) => w.id === s.wallpaper) || WALLPAPERS[0] || {}).id || null;
    wpManualAt = Number(s[WP_MANUAL_KEY]) || 0;
    /* a scheduled wallpaper is the one the page opens with — no crossfade */
    const due = scheduledWallpaper(Date.now());
    if (due && AS.get().background.mode === "video") {
      currentWp = due.id;
      store.set({ wallpaper: due.id });
    }
    applyBackground(true);
    applyWallpaperSchedule(true); // a scheduled change away from a colour / image
    $("q").focus();
    /* back in, if the user chose to stay unlocked for the session */
    if (V) V.restore(AS.get().privacy.stay);
  });
})();
