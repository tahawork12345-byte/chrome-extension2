/* ATLAS NEW TAB — customization
   Everything a user can change about how the page looks lives here: the
   settings model, the stylesheet generated from it, and the Customize
   panel. It loads before app.js and exposes window.AtlasSettings, which
   app.js uses for the settings that change behaviour rather than style
   (clock format, search engine, weather units, background source).        */

(() => {
  "use strict";

  const KEY = "appearance";
  const CSS_CACHE = "atlas:appearance-css";

  /* ================= MODEL ================================================
     Every value has a default here, and nothing else is accepted: stored or
     imported data is merged onto these, keeping only keys that exist and
     values of the same type (see merge()).                                 */
  const widget = (extra) =>
    Object.assign({ show: true, pos: "auto", x: 0, y: 0, scale: 100 }, extra);

  const cfgUnits =
    typeof WEATHER_CONFIG !== "undefined" && WEATHER_CONFIG.units === "fahrenheit" ? "fahrenheit" : "celsius";

  const DEFAULTS = {
    theme: {
      preset: "sand",
      accent: "#d8c3a5",
      ink: "#f7f6f3",
      glass: "#121216",
      glassAlpha: 24,
      blur: 100,
      border: 16,
      radius: 100,
      font: "default",
    },
    background: {
      mode: "video", // video | upload | color | gradient
      speed: 100,
      color: "#14141a",
      gradA: "#1d2b4a",
      gradB: "#4a2140",
      gradAngle: 135,
      customId: 0,
      customName: "",
      brightness: 100,
      saturate: 100,
      blur: 0,
      dim: 0,
      drift: true,
      /* timed wallpaper changes: [{ id, repeat, date, time, days,
         wallpaper, enabled }] (rules as in schedule.js); app.js applies them */
      scheduleOn: true,
      schedule: [],
    },
    lighting: {
      trace: true,
      traceMatch: true,
      traceColor: "#d8c3a5",
      traceSpeed: 8,
      traceLength: 26,
      traceBright: 100,
      orbs: true,
      tilt: true,
      motion: true,
      panelFx: "glide", // how the Customize panel opens (PANEL_FX)
      panelDur: 560,
    },
    /* the password-locked private space (vault.js). Its content is not
       part of these settings — only how it behaves. */
    privacy: {
      dock: true,   // lock button on the dock
      stay: false,  // stay unlocked until Chrome closes
      autoLock: 0,  // minutes idle before it locks; 0 = never
    },
    /* translation (translate.js) and voice (voice.js). `lang` is a
       languages.js code; "auto" follows it, or the browser's language. */
    language: {
      lang: "",          // websites + this page are translated into it; "" = off
      pages: true,       // translate websites
      newtab: true,      // translate this new tab
      badge: true,       // the small "Translated" badge on websites
      voiceLang: "auto", // the language voice typing listens for
      searchMic: true,   // mic on the search bar
      searchAuto: true,  // search as soon as you stop talking
      ai: {
        mic: true,       // mic in the assistant
        speak: false,    // read replies out loud
        reply: "auto",   // the assistant answers in: "auto" = the language you use
        voice: "atlas",  // a suggested voice (voice.js), or a custom one's id
        custom: [],      // your voices: { id, name, voice (system voice, "" = auto), rate, pitch, volume }
      },
    },
    /* cursors.js owns this shape: a library of uploads + a look per cursor */
    cursor: window.AtlasCursors ? AtlasCursors.defaults() : { style: "default" },
    widgets: {
      clock: widget({ h24: false, date: true, meridiem: true }),
      weather: { show: true, units: cfgUnits },
      dock: {
        show: true, side: "left", y: 0, width: 470, icon: 58, labels: true,
        bubble: "glass", // glass | dark
        bubbleMatch: true,
        bubbleColor: "#7cc4ff",
        panelMatch: true,
        panelColor: "#121216",
        panelAlpha: 40,
      },
      search: widget({
        engine: "google", // a built-in id, or a custom engine's "c-…" id
        customUrl: "",    // pre-list single custom URL, migrated on load
        engines: [],      // custom engines: { id, name, url, key }
        history: true,    // remember searches (shown only in the history panel)
      }),
      media: widget(),
      wallpaper: widget(),
      peek: widget(),
      ai: widget({
        panelWidth: 360,
        panelHeight: 480,
        fontSize: 13,
        opacity: 72,
        userMatch: true,
        userColor: "#d8c3a5",
        light: true,
        time: true,
      }),
    },
  };

  const PRESETS = [
    { id: "sand", label: "Sand", accent: "#d8c3a5", ink: "#f7f6f3", glass: "#121216" },
    { id: "ocean", label: "Ocean", accent: "#7cc4ff", ink: "#eef6ff", glass: "#0b1624" },
    { id: "rose", label: "Rose", accent: "#f4a6c1", ink: "#fff4f7", glass: "#1a0f14" },
    { id: "mint", label: "Mint", accent: "#8fe3c0", ink: "#f0fff8", glass: "#0d1a16" },
    { id: "violet", label: "Violet", accent: "#b9a3ff", ink: "#f5f2ff", glass: "#120f1f" },
    { id: "ember", label: "Ember", accent: "#ff9b5e", ink: "#fff5ee", glass: "#1a100a" },
    { id: "lime", label: "Lime", accent: "#c8f169", ink: "#f8ffe9", glass: "#10140a" },
    { id: "mono", label: "Mono", accent: "#e6e6e6", ink: "#ffffff", glass: "#0e0e0e" },
  ];

  const FONTS = {
    default: { label: "Atlas (default)", stack: '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif' },
    system: { label: "System", stack: "system-ui, -apple-system, sans-serif" },
    rounded: { label: "Rounded", stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", sans-serif' },
    humanist: { label: "Humanist", stack: '"Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif' },
    serif: { label: "Serif", stack: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' },
    mono: { label: "Mono", stack: '"Cascadia Code", "SF Mono", Consolas, monospace' },
  };

  /* the Customize panel's entrance / exit (keyframes in style.css) */
  const PANEL_FX = [
    ["glide", "Glide"],
    ["unfold", "Unfold"],
    ["curtain", "Curtain"],
    ["zoom", "Zoom"],
    ["fade", "Fade"],
  ];

  /* built-in search engines. `key` is the !keyword that sends one search
     there ("!yt cats"); `icon` is a key in config.js ICONS, otherwise the
     bar draws `mono` on a `tint` badge. A URL marks the query with %s, or
     the query is appended. Users add their own (widgets.search.engines). */
  const googleUrl = typeof SEARCH_URL !== "undefined" ? SEARCH_URL : "https://www.google.com/search?q=";
  const ENGINES = {
    google: { label: "Google", url: googleUrl, key: "g", icon: "google" },
    youtube: { label: "YouTube", url: "https://www.youtube.com/results?search_query=", key: "yt", icon: "youtube" },
    github: { label: "GitHub", url: "https://github.com/search?q=%s&type=repositories", key: "gh", icon: "github" },
    wikipedia: { label: "Wikipedia", url: "https://en.wikipedia.org/w/index.php?search=", key: "w", icon: "wikipedia" },
    chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/?q=", key: "gpt", mono: "✺", tint: "#10a37f" },
    amazon: { label: "Amazon", url: "https://www.amazon.com/s?k=", key: "a", mono: "a", tint: "#ff9900" },
    bing: { label: "Bing", url: "https://www.bing.com/search?q=", key: "b", mono: "b", tint: "#2b7fd9" },
    duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=", key: "d", mono: "D", tint: "#de5833" },
    brave: { label: "Brave", url: "https://search.brave.com/search?q=", key: "br", mono: "B", tint: "#fb542b" },
  };
  const MAX_CUSTOM_ENGINES = 12;
  const isSearchUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || "").trim());
  const cleanKey = (k) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

  /* the user's own engines: a list, which merge() can't check, so it is
     cleaned here. An old single "Custom" URL becomes the first entry. */
  function normalizeEngines(list, legacyUrl) {
    const out = [];
    const ids = new Set();
    (Array.isArray(list) ? list : []).forEach((e) => {
      if (!e || typeof e !== "object" || out.length >= MAX_CUSTOM_ENGINES) return;
      const name = String(e.name || "").trim().slice(0, 30);
      const url = String(e.url || "").trim();
      if (!name || !isSearchUrl(url)) return;
      let id = typeof e.id === "string" && /^c-[\w-]+$/.test(e.id) ? e.id : "c-" + Date.now().toString(36) + out.length;
      while (ids.has(id)) id += "x";
      ids.add(id);
      out.push({ id, name, url, key: cleanKey(e.key) });
    });
    if (!out.length && isSearchUrl(legacyUrl)) out.push({ id: "c-legacy", name: "Custom", url: legacyUrl.trim(), key: "" });
    return out;
  }

  /* the floating widgets that can be moved and resized. `origin` is the
     scaling anchor in their default spot; `w` / `h` mark an explicit width /
     height the centring rules must keep. */
  const WIDGETS = {
    clock: { sel: ".clock", label: "Clock", origin: "top left" },
    search: { sel: ".search", label: "Search bar", origin: "left bottom", w: true, h: true },
    media: { sel: ".media", label: "Now playing", origin: "bottom left", w: true },
    wallpaper: { sel: ".wp-control", label: "Wallpaper button", origin: "bottom left" },
    peek: { sel: ".peek", label: "Quick Peek", origin: "top right" },
    ai: { sel: ".ai", label: "Assistant", origin: "bottom right" },
  };
  const POSITIONS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

  const clone = (v) => JSON.parse(JSON.stringify(v));

  /* defaults + override, keeping only known keys with matching types */
  function merge(base, over) {
    if (!over || typeof over !== "object") return base;
    Object.keys(base).forEach((k) => {
      const b = base[k];
      const o = over[k];
      if (b && typeof b === "object") merge(b, o);
      else if (typeof o === typeof b && (typeof o !== "number" || isFinite(o))) base[k] = o;
    });
    return base;
  }

  /* merge() only knows fixed keys; the cursor library (a list, and looks
     keyed by cursor id) is checked by cursors.js instead */
  function load(over) {
    const next = merge(clone(DEFAULTS), over);
    if (window.AtlasCursors) next.cursor = AtlasCursors.normalize(over && over.cursor);
    const s = next.widgets.search;
    const src = over && over.widgets && over.widgets.search;
    s.engines = normalizeEngines(src && src.engines, s.customUrl);
    s.customUrl = ""; // migrated into the list; don't bring it back later
    if (s.engine === "custom") s.engine = s.engines[0] ? s.engines[0].id : "google";
    next.background.schedule = normalizeWpSchedule(over && over.background && over.background.schedule);
    const ai = next.language.ai;
    ai.custom = normalizeVoices(over && over.language && over.language.ai && over.language.ai.custom);
    const knownVoice = (id) => ai.custom.some((c) => c.id === id) ||
      (window.AtlasVoice ? AtlasVoice.PRESETS.some((p) => p.id === id) : id === "atlas");
    if (!knownVoice(ai.voice)) ai.voice = "atlas";
    return next;
  }

  /* custom voices: a list, so checked here rather than by merge() */
  const MAX_VOICES = 12;
  function normalizeVoices(list) {
    const clamp = (v, min, max, fb) => (isFinite(v) ? Math.min(max, Math.max(min, Number(v))) : fb);
    const ids = new Set();
    return (Array.isArray(list) ? list : []).slice(0, MAX_VOICES).map((v, i) => {
      if (!v || typeof v !== "object") return null;
      let id = typeof v.id === "string" && /^cv-[\w-]+$/.test(v.id) ? v.id : "cv-" + Date.now().toString(36) + i;
      while (ids.has(id)) id += "x";
      ids.add(id);
      return {
        id,
        name: String(v.name || "").trim().slice(0, 24) || "My voice",
        voice: typeof v.voice === "string" ? v.voice : "",
        rate: clamp(v.rate, 0.5, 2, 1),
        pitch: clamp(v.pitch, 0, 2, 1),
        volume: clamp(v.volume, 0, 1, 1),
      };
    }).filter(Boolean);
  }

  /* wallpaper schedule rules: a list, so checked here rather than by merge() */
  const MAX_WP_RULES = 24;
  function normalizeWpSchedule(list) {
    if (!window.AtlasSchedule) return [];
    return (Array.isArray(list) ? list : []).slice(0, MAX_WP_RULES).map((r, i) => {
      const rule = AtlasSchedule.normalize(r);
      if (!rule) return null;
      return Object.assign(rule, {
        id: typeof r.id === "string" && r.id ? r.id : "wr-" + Date.now().toString(36) + i,
        wallpaper: typeof r.wallpaper === "string" ? r.wallpaper : "",
        enabled: r.enabled !== false,
      });
    }).filter(Boolean);
  }

  let settings = clone(DEFAULTS);

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], obj);
    target[last] = value;
  }

  /* ================= STORAGE ============================================= */
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const store = {
    get(k) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.get([k], (o) => r(o[k])));
      try { return Promise.resolve(localStorage.getItem("atlas:" + k)); } catch { return Promise.resolve(null); }
    },
    set(k, v) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.set({ [k]: v }, r));
      try { localStorage.setItem("atlas:" + k, v); } catch {}
      return Promise.resolve();
    },
  };

  /* an uploaded background can be tens of megabytes, far past what
     chrome.storage is meant for, so the file itself lives in IndexedDB */
  const media = (() => {
    let dbp = null;
    function db() {
      if (!dbp) {
        dbp = new Promise((resolve, reject) => {
          const req = indexedDB.open("atlas", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("media");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      return dbp;
    }
    function run(mode, fn) {
      return db().then((d) => new Promise((resolve, reject) => {
        const tx = d.transaction("media", mode);
        const req = fn(tx.objectStore("media"));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }));
    }
    return {
      put: (blob) => run("readwrite", (s) => s.put(blob, "background")),
      get: () => run("readonly", (s) => s.get("background")).catch(() => null),
      clear: () => run("readwrite", (s) => s.delete("background")).catch(() => {}),
    };
  })();

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set(KEY, JSON.stringify({ v: 1, settings })), 200);
  }

  /* ================= STYLESHEET ==========================================
     Settings -> one generated <style>, placed after style.css so it wins.
     Every rule is emitted only when it differs from the default, so an
     untouched setup renders exactly as style.css describes it.            */
  const styleEl = document.createElement("style");
  styleEl.id = "atlas-custom";
  document.head.appendChild(styleEl);

  /* first paint: reuse the last generated CSS so a customised page doesn't
     flash the default theme while chrome.storage answers */
  try {
    const cached = localStorage.getItem(CSS_CACHE);
    if (cached) styleEl.textContent = cached;
  } catch {}

  const HEX = /^#[0-9a-f]{6}$/i;
  const hex = (v, fb) => (HEX.test(v) ? v : fb);
  const num = (v, min, max, fb) => (isFinite(v) ? Math.min(max, Math.max(min, Number(v))) : fb);
  function rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
  }
  /* dark text on a light accent, white on a dark one */
  function onColor(h) {
    const n = parseInt(h.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.36 ? "#1d1a16" : "#ffffff";
  }

  /* place a widget at one of nine screen anchors, nudged by x / y and
     scaled around the side it is pinned to */
  function widgetRules(key, w) {
    const meta = WIDGETS[key];
    const sel = meta.sel;
    const out = [];
    const decl = [];
    const pos = POSITIONS.includes(w.pos) ? w.pos : "auto";
    const x = num(w.x, -600, 600, 0);
    const y = num(w.y, -600, 600, 0);
    const scale = num(w.scale, 40, 250, 100);

    if (pos !== "auto") {
      const v = pos[0];
      const h = pos[1];
      decl.push("top:auto", "bottom:auto", "left:auto", "right:auto", "margin:0", "transform:none");
      if (v === "t") decl.push("top:var(--edge)");
      else if (v === "b") decl.push("bottom:var(--edge)");
      else decl.push("top:0", "bottom:0", "margin-top:auto", "margin-bottom:auto", meta.h ? "" : "height:fit-content");
      if (h === "l") decl.push("left:var(--edge)");
      else if (h === "r") decl.push("right:var(--edge)");
      else decl.push("left:0", "right:0", "margin-left:auto", "margin-right:auto", meta.w ? "" : "width:fit-content");
      const ov = v === "t" ? "top" : v === "b" ? "bottom" : "center";
      const oh = h === "l" ? "left" : h === "r" ? "right" : "center";
      decl.push("transform-origin:" + oh + " " + ov);
      /* the search bar's entrance carries its default centring; drop it */
      if (key === "search") decl.push("animation-name:fade-up");

      /* pop-ups open away from the screen edge the widget now sits on */
      if (key === "wallpaper") {
        const m = [];
        if (v === "t") m.push("bottom:auto", "top:40px");
        if (h === "r") m.push("left:auto", "right:0");
        if (m.length) out.push(".wp-menu{" + m.join(";") + "}");
      }
      if (key === "ai") {
        const m = [];
        if (v === "t") m.push("bottom:auto", "top:52px");
        if (h === "l") m.push("right:auto", "left:0");
        if (m.length) out.push(".ai-panel{" + m.join(";") + "}");
      }
      if (key === "peek") {
        const m = ["display:flex", "flex-direction:" + (v === "b" ? "column-reverse" : "column")];
        m.push("align-items:" + (h === "l" ? "flex-start" : h === "c" ? "center" : "flex-end"));
        out.push(".peek{" + m.join(";") + "}");
        if (v === "b") out.push(".peek-panel{margin:0 0 8px}");
      }
    } else if (scale !== 100) {
      decl.push("transform-origin:" + meta.origin);
    }
    if (x || y) decl.push("translate:" + x + "px " + y + "px");
    if (scale !== 100) decl.push("scale:" + scale / 100);

    const d = decl.filter(Boolean);
    if (d.length) out.unshift(sel + "{" + d.join(";") + "}");
    return out;
  }

  function buildCss(s) {
    const t = s.theme;
    const bg = s.background;
    const l = s.lighting;
    const w = s.widgets;
    const css = [];
    const desktop = []; // placement rules; phones keep their tuned layout

    /* --- theme --- */
    const accent = hex(t.accent, DEFAULTS.theme.accent);
    const ink = hex(t.ink, DEFAULTS.theme.ink);
    const glass = hex(t.glass, DEFAULTS.theme.glass);
    const font = (FONTS[t.font] || FONTS.default).stack;
    const root = [
      "--accent:" + accent,
      "--accent-rgb:" + rgb(accent),
      "--on-accent:" + onColor(accent),
      "--ink:" + ink,
      "--ink-rgb:" + rgb(ink),
      "--glass-rgb:" + rgb(glass),
      "--glass-a:" + num(t.glassAlpha, 0, 95, 24) / 100,
      "--line-a:" + num(t.border, 0, 60, 16) / 100,
      "--blur-k:" + num(t.blur, 0, 300, 100) / 100,
      "--radius-k:" + num(t.radius, 0, 250, 100) / 100,
      "--font:" + font,
      "--wp-dim:" + num(bg.dim, 0, 90, 0) / 100,
    ];

    /* --- lighting --- */
    if (!l.traceMatch) root.push("--trace-rgb:" + rgb(hex(l.traceColor, accent)));
    if (!l.trace) css.push(".trace{display:none}");
    else {
      const speed = num(l.traceSpeed, 2, 30, 8);
      const len = num(l.traceLength, 5, 95, 26);
      const bright = num(l.traceBright, 10, 100, 100);
      if (speed !== 8) css.push(".trace rect{animation-duration:" + speed + "s}");
      if (len !== 26) css.push(".trace .trace-line{stroke-dasharray:" + len + " " + (100 - len) + "}");
      if (bright !== 100) css.push(".trace{opacity:" + bright / 100 + "}");
    }
    if (!l.orbs) css.push(".orb{display:none}");
    const panelDur = num(l.panelDur, 150, 1400, 560);
    if (panelDur !== 560) css.push(".cz{--cz-dur:" + panelDur + "ms}");
    css.unshift(":root{" + root.join(";") + "}");

    /* --- background --- */
    const filt = [];
    const b = num(bg.brightness, 20, 180, 100);
    const sat = num(bg.saturate, 0, 250, 100);
    const blur = num(bg.blur, 0, 40, 0);
    if (b !== 100) filt.push("brightness(" + b / 100 + ")");
    if (sat !== 100) filt.push("saturate(" + sat / 100 + ")");
    if (blur) filt.push("blur(" + blur + "px)");
    if (filt.length) css.push(".wp-layer,.wp-image,.wp-fill{filter:" + filt.join(" ") + "}");
    /* a blurred frame pulls its edges in; oversize it so they stay covered */
    if (blur) css.push(".wp-layer,.wp-image,.wp-fill{scale:1.08}");
    if (!bg.drift) css.push(".wp-layer.is-active,.wp-image.is-active{animation:none}");

    /* --- widgets --- */
    const clock = w.clock;
    if (!clock.show) css.push(".clock{display:none!important}");
    if (!clock.date) css.push(".clock-date{display:none}");
    if (!clock.meridiem || clock.h24) css.push(".meridiem{display:none}");
    if (!w.weather.show) css.push(".weather{display:none!important}");

    Object.keys(WIDGETS).forEach((k) => {
      if (k !== "clock" && !w[k].show) css.push(WIDGETS[k].sel + "{display:none!important}");
      desktop.push(...widgetRules(k, w[k]));
    });

    /* the dock hangs below the clock; once the clock is elsewhere (or gone)
       it moves up to the top edge */
    const dock = w.dock;
    const dockY = num(dock.y, -300, 600, 0);
    const clockAway = !clock.show || (POSITIONS.includes(clock.pos) && clock.pos !== "auto");
    if (clockAway || dockY) {
      desktop.push(
        ":root{--launcher-top:calc(var(--edge) + " +
          (clockAway ? "0px" : "var(--clock-h) + 20px") + " + " + dockY + "px)}"
      );
    }
    /* the launcher stops above Now Playing only while it is in its spot */
    if (!w.media.show || w.media.pos !== "auto") {
      css.push("body.has-media{--launcher-bottom:calc(var(--edge) + 58px)}");
    }

    if (!dock.show) css.push(".rail,.launcher{display:none!important}");
    if (dock.side === "right") {
      desktop.push(
        ".rail{left:auto;right:var(--edge)}",
        ".launcher{left:auto;right:calc(var(--edge) + var(--rail-w) + 16px);transform-origin:right center;" +
          "transform:perspective(1400px) rotateY(8deg);translate:18px 0}",
        ".launcher:hover,.launcher:focus-within{transform:perspective(1400px) rotateY(3deg)}",
        ".rail-btn.is-on::before{left:auto;right:-7px}",
        ".rail-btn::after{left:auto;right:calc(100% + 14px);transform:translate(4px,-50%)}",
        ".rail-btn:hover::after,.rail-btn:focus-visible::after{transform:translate(0,-50%)}",
        ".orb-c{left:auto;right:-8px}",
        "@media (max-width:1024px){.launcher{left:var(--edge);transform:none}" +
          ".launcher:hover,.launcher:focus-within{transform:none}}"
      );
    }
    const width = num(dock.width, 300, 900, 470);
    if (width !== 470) desktop.push("@media (min-width:1025px){.launcher{width:min(" + width + "px,70vw)}}");
    const icon = num(dock.icon, 36, 96, 58);
    if (icon !== 58) {
      const inner = Math.round(icon * 0.48);
      css.push(
        ".app-bubble{width:" + icon + "px;height:" + icon + "px}",
        ".app-icon,.app-bubble .tile-fallback{width:" + inner + "px;height:" + inner + "px}",
        ".launcher-grid{grid-template-columns:repeat(auto-fill,minmax(" + (icon + 28) + "px,1fr))}"
      );
    }
    if (!dock.labels) css.push(".app-name{display:none}");

    /* launcher box colour and icon bubbles */
    const dockVars = [];
    if (!dock.panelMatch) {
      dockVars.push(
        "--panel-rgb:" + rgb(hex(dock.panelColor, DEFAULTS.widgets.dock.panelColor)),
        "--panel-a:" + num(dock.panelAlpha, 0, 100, 40) / 100
      );
    }
    if (!dock.bubbleMatch) dockVars.push("--bubble-rgb:" + rgb(hex(dock.bubbleColor, accent)));
    if (dockVars.length) css.push(".launcher{" + dockVars.join(";") + "}");
    if (dock.bubble === "dark") {
      css.push(
        ".app-bubble{border-color:rgba(255,255,255,.14);backdrop-filter:none;background:" +
          "radial-gradient(circle at 32% 24%,rgba(255,255,255,.3),rgba(255,255,255,0) 42%)," +
          "radial-gradient(circle at 70% 85%,rgba(var(--bubble-rgb),.18),rgba(var(--bubble-rgb),0) 55%)," +
          "rgba(20,20,26,.55);box-shadow:0 12px 22px -12px rgba(0,0,0,.85),inset 0 1px 1px rgba(255,255,255,.3)," +
          "inset 0 -6px 12px rgba(0,0,0,.35)}",
        ".app-bubble::before{display:none}",
        ".app-add .app-bubble{border-color:rgba(255,255,255,.24);background:rgba(255,255,255,.05)}"
      );
    }

    /* the assistant's chat box */
    const ai = w.ai;
    const aiVars = [];
    const aiW = num(ai.panelWidth, 280, 640, 360);
    const aiH = num(ai.panelHeight, 300, 800, 480);
    const aiFs = num(ai.fontSize, 11, 18, 13);
    const aiBg = num(ai.opacity, 10, 100, 72);
    if (aiW !== 360) aiVars.push("--ai-w:" + aiW + "px");
    if (aiH !== 480) aiVars.push("--ai-h:" + aiH + "px");
    if (aiFs !== 13) aiVars.push("--ai-fs:" + aiFs + "px");
    if (aiBg !== 72) aiVars.push("--ai-bg-a:" + aiBg / 100);
    if (!ai.userMatch) aiVars.push("--ai-me-rgb:" + rgb(hex(ai.userColor, accent)));
    if (aiVars.length) css.push(".ai{" + aiVars.join(";") + "}");
    if (!ai.light) css.push(".ai-panel .trace{display:none}");
    if (!ai.time) css.push(".ai .msg-time{display:none}", ".ai .msg-av{margin-bottom:0}");

    /* tilt last, so it also flattens the mirrored right-side dock */
    if (!l.tilt) desktop.push(".launcher,.launcher:hover,.launcher:focus-within{transform:none}");

    if (!l.motion) {
      css.push(
        "*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;" +
          "transition-duration:.01ms!important}",
        /* the panel's staggered entrances would otherwise sit out their delays */
        ".cz,.cz *{animation-delay:0s!important}",
        ".wp-layer.is-active,.wp-image.is-active{animation:none}",
        ".trace{display:none}"
      );
    }

    /* --- cursor --- */
    if (window.AtlasCursors) css.push(AtlasCursors.css(s.cursor, accent));

    if (desktop.length) css.push("@media (min-width:721px){" + desktop.join("") + "}");
    return css.join("\n");
  }

  let cssRaf = 0;
  function applyCss() {
    if (cssRaf) return;
    cssRaf = requestAnimationFrame(() => {
      cssRaf = 0;
      const text = buildCss(settings);
      styleEl.textContent = text;
      try { localStorage.setItem(CSS_CACHE, text); } catch {}
      /* a new font or theme can change the tabs' widths */
      if (isOpen()) moveInk(true);
    });
  }

  /* ================= CHANGE FLOW ========================================= */
  const listeners = [];
  function emit(path) {
    listeners.forEach((fn) => {
      try { fn(settings, path); } catch (err) { console.error("Atlas settings listener failed:", err); }
    });
  }

  /* one value changed from a control */
  function set(path, value) {
    setPath(settings, path, value);
    if (/^theme\.(accent|ink|glass)$/.test(path)) settings.theme.preset = "custom";
    if (path === "lighting.panelFx") panel.dataset.fx = fxName();
    applyCss();
    save();
    emit(path);
    syncConditions();
  }

  /* many values changed at once (preset, reset, import) */
  function replace(next) {
    settings = load(next);
    applyCss();
    save();
    emit("*");
    if (!panel.hidden) renderTab();
  }

  /* ================= PANEL ===============================================
     A drawer built from small row builders. Controls write straight into
     the model; rows with a `when` test are re-checked after every change so
     options appear only when they apply.                                   */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };

  let conds = []; // [element, test]
  function syncConditions() {
    conds.forEach(([el, test]) => (el.hidden = !test(settings)));
  }
  function row(label, control, opts = {}) {
    const el = h("div", { class: "cz-row" + (opts.stack ? " is-stack" : "") },
      label ? h("span", { class: "cz-label", text: label }) : null,
      control);
    if (opts.when) conds.push([el, opts.when]);
    return el;
  }
  const group = (title, ...rows) =>
    h("section", { class: "cz-group" }, title ? h("h3", { class: "cz-gtitle", text: title }) : null, ...rows);
  const note = (text) => h("p", { class: "cz-note", text });

  function rangeRow(label, path, min, max, step, unit, opts) {
    const v = h("span", { class: "cz-val" });
    const fmt = (x) => (opts && opts.format ? opts.format(x) : x + (unit || ""));
    const input = h("input", {
      class: "cz-range", type: "range", min, max, step: step || 1, value: getPath(settings, path),
      "aria-label": label,
      oninput: () => { set(path, Number(input.value)); v.textContent = fmt(Number(input.value)); },
    });
    v.textContent = fmt(getPath(settings, path));
    return row(label, h("span", { class: "cz-ctl" }, input, v), opts);
  }

  function colorRow(label, path, opts) {
    const code = h("span", { class: "cz-hex", text: getPath(settings, path) });
    const swatch = h("label", { class: "cz-color", title: label });
    swatch.style.background = getPath(settings, path);
    const input = h("input", {
      type: "color", value: getPath(settings, path), "aria-label": label,
      oninput: () => {
        set(path, input.value);
        swatch.style.background = input.value;
        code.textContent = input.value;
        markPresets();
      },
    });
    swatch.append(input);
    return row(label, h("span", { class: "cz-ctl" }, code, swatch), opts);
  }

  function toggle(path, label, onChange) {
    const input = h("input", {
      class: "cz-switch", type: "checkbox", role: "switch", "aria-label": label,
      onchange: () => { set(path, input.checked); if (onChange) onChange(input.checked); },
    });
    input.checked = !!getPath(settings, path);
    return input;
  }
  const toggleRow = (label, path, opts) => row(label, toggle(path, label), opts);

  function selectRow(label, path, options, opts) {
    const sel = h("select", {
      class: "cz-select", "aria-label": label,
      onchange: () => set(path, sel.value),
    }, options.map(([v, text]) => h("option", { value: v, text })));
    sel.value = getPath(settings, path);
    return row(label, sel, opts);
  }

  function segRow(label, path, options, opts) {
    const wrap = h("div", { class: "cz-seg", role: "radiogroup", "aria-label": label });
    const paint = () => wrap.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.v === String(getPath(settings, path));
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    });
    options.forEach(([v, text]) => {
      wrap.append(h("button", {
        type: "button", role: "radio", "data-v": v, text,
        onclick: () => { set(path, v); paint(); if (opts && opts.after) opts.after(v); },
      }));
    });
    paint();
    return row(label, wrap, Object.assign({ stack: !!(opts && opts.stack) }, opts));
  }

  function textRow(label, path, placeholder, opts) {
    const input = h("input", {
      class: "cz-text", type: "text", placeholder, value: getPath(settings, path), spellcheck: "false",
      "aria-label": label,
      onchange: () => set(path, input.value.trim()),
    });
    return row(label, input, Object.assign({ stack: true }, opts));
  }

  /* "Auto" (the built-in spot) or one of nine anchors */
  function posRow(base) {
    const path = base + ".pos";
    const auto = h("button", { type: "button", class: "cz-pos-auto", text: "Auto" });
    const grid = h("div", { class: "cz-pos-grid", role: "radiogroup", "aria-label": "Screen position" });
    const names = { t: "Top", m: "Middle", b: "Bottom", l: "left", c: "centre", r: "right" };
    const paint = () => {
      const cur = getPath(settings, path);
      auto.classList.toggle("is-on", cur === "auto");
      grid.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.v === cur));
    };
    const pick = (v) => { set(path, v); paint(); };
    auto.addEventListener("click", () => pick("auto"));
    POSITIONS.forEach((p) => {
      grid.append(h("button", {
        type: "button", "data-v": p, title: names[p[0]] + " " + names[p[1]],
        "aria-label": names[p[0]] + " " + names[p[1]],
        onclick: () => pick(p),
      }));
    });
    paint();
    return row("Position", h("div", { class: "cz-pos" }, auto, grid));
  }

  /* the shared placement block for every floating widget */
  const placement = (base) => [
    posRow(base),
    rangeRow("Nudge ←→", base + ".x", -400, 400, 2, "px"),
    rangeRow("Nudge ↑↓", base + ".y", -400, 400, 2, "px"),
    rangeRow("Size", base + ".scale", 50, 200, 5, "%"),
  ];

  const openCards = new Set(["clock"]);
  function card(id, title, showPath, ...body) {
    const d = h("details", { class: "cz-card" });
    if (openCards.has(id)) d.open = true;
    d.addEventListener("toggle", () => {
      if (d.open) {
        openCards.add(id);
        /* animate only a real unfold, not every redraw of an open card */
        d.classList.add("is-expanding");
        setTimeout(() => d.classList.remove("is-expanding"), 450);
      } else openCards.delete(id);
    });
    const summary = h("summary", null, h("span", { class: "cz-chev", "aria-hidden": "true", text: "›" }), h("span", { text: title }));
    if (showPath) {
      const sw = toggle(showPath, "Show " + title, (on) => d.classList.toggle("is-off", !on));
      /* the switch must not also fold the card */
      sw.addEventListener("click", (e) => e.stopPropagation());
      summary.append(sw);
      d.classList.toggle("is-off", !getPath(settings, showPath));
    }
    d.append(summary, h("div", { class: "cz-card-body" }, ...body));
    return d;
  }

  /* --- tabs --- */
  function presetButtons() {
    const wrap = h("div", { class: "cz-presets" });
    PRESETS.forEach((p) => {
      const dot = h("span", { class: "cz-dot" });
      dot.style.background = "linear-gradient(135deg, " + p.accent + " 0 50%, " + p.glass + " 50% 100%)";
      wrap.append(h("button", {
        type: "button", class: "cz-preset", "data-id": p.id,
        onclick: () => {
          const next = clone(settings);
          Object.assign(next.theme, { preset: p.id, accent: p.accent, ink: p.ink, glass: p.glass });
          next.lighting.traceMatch = true;
          replace(next);
        },
      }, dot, p.label));
    });
    return wrap;
  }
  function markPresets() {
    body.querySelectorAll(".cz-preset").forEach((b) =>
      b.classList.toggle("is-on", b.dataset.id === settings.theme.preset));
  }

  const TABS = [
    {
      id: "theme",
      label: "Theme",
      reset: "theme",
      render: () => [
        group("Presets", presetButtons()),
        group("Colours",
          colorRow("Accent", "theme.accent"),
          colorRow("Text", "theme.ink"),
          colorRow("Glass tint", "theme.glass")),
        group("Glass",
          rangeRow("Opacity", "theme.glassAlpha", 0, 95, 1, "%"),
          rangeRow("Blur", "theme.blur", 0, 300, 5, "%"),
          rangeRow("Borders", "theme.border", 0, 60, 1, "%"),
          rangeRow("Roundness", "theme.radius", 0, 250, 5, "%")),
        group("Type",
          selectRow("Font", "theme.font", Object.entries(FONTS).map(([k, f]) => [k, f.label]))),
      ],
    },
    {
      id: "background",
      label: "Background",
      reset: "background",
      render: () => {
        const isMode = (m) => (s) => s.background.mode === m;
        return [
          group("Source",
            segRow("", "background.mode", [["video", "Live"], ["upload", "My file"], ["color", "Colour"], ["gradient", "Gradient"]],
              { stack: true, after: (m) => { if (m === "upload" && !settings.background.customId) filePicker.click(); } }),
            row("", wallpaperButtons(), { stack: true, when: isMode("video") }),
            rangeRow("Playback speed", "background.speed", 25, 200, 5, "%", { when: (s) => s.background.mode !== "color" && s.background.mode !== "gradient" }),
            uploadRow(isMode("upload")),
            colorRow("Colour", "background.color", { when: isMode("color") }),
            colorRow("From", "background.gradA", { when: isMode("gradient") }),
            colorRow("To", "background.gradB", { when: isMode("gradient") }),
            rangeRow("Angle", "background.gradAngle", 0, 360, 5, "°", { when: isMode("gradient") })),
          wpScheduleGroup(),
          group("Adjust",
            rangeRow("Brightness", "background.brightness", 20, 180, 1, "%"),
            rangeRow("Saturation", "background.saturate", 0, 250, 5, "%"),
            rangeRow("Blur", "background.blur", 0, 40, 1, "px"),
            rangeRow("Dim", "background.dim", 0, 90, 1, "%"),
            toggleRow("Slow drift (Ken Burns)", "background.drift")),
        ];
      },
    },
    {
      id: "lighting",
      label: "Lighting",
      reset: "lighting",
      render: () => {
        const on = (s) => s.lighting.trace;
        return [
          group("Border light",
            note("The soft light that runs around the search bar, dock and cards."),
            toggleRow("Show", "lighting.trace"),
            toggleRow("Match accent colour", "lighting.traceMatch", { when: on }),
            colorRow("Colour", "lighting.traceColor", { when: (s) => on(s) && !s.lighting.traceMatch }),
            rangeRow("Lap time", "lighting.traceSpeed", 2, 30, 1, "s", { when: on }),
            rangeRow("Length", "lighting.traceLength", 5, 95, 1, "%", { when: on }),
            rangeRow("Brightness", "lighting.traceBright", 10, 100, 1, "%", { when: on })),
          group("Effects",
            toggleRow("Floating orbs", "lighting.orbs"),
            toggleRow("3D tilt on the dock", "lighting.tilt"),
            toggleRow("Animations", "lighting.motion")),
          group("Transitions",
            note("How this panel opens and closes. Pick one and press Preview to watch it."),
            segRow("", "lighting.panelFx", PANEL_FX, { stack: true, when: (s) => s.lighting.motion }),
            rangeRow("Duration", "lighting.panelDur", 150, 1400, 10, "ms", { when: (s) => s.lighting.motion }),
            row("", h("div", { class: "cz-btns" },
              h("button", { type: "button", class: "cz-btn is-primary", text: "Preview", onclick: () => replay() })),
            { when: (s) => s.lighting.motion }),
            row("", note("Turn Animations on to use transitions."), { when: (s) => !s.lighting.motion })),
        ];
      },
    },
    {
      id: "cursor",
      label: "Cursor",
      reset: "cursor",
      render: () => {
        const cur = settings.cursor;
        const st = cur.style;
        const idx = st.startsWith("custom:") ? cur.custom.findIndex((c) => "custom:" + c.id === st) : -1;
        const item = cur.custom[idx];
        const pack = AtlasCursors.PACKS.find((p) => p.id === st);
        const out = [
          group("Packs", cursorTiles("packs")),
          group("My cursors",
            note("Upload as many as you like (up to " + AtlasCursors.MAX_CUSTOM + "). Any picture works — PNG, GIF, SVG or WebP."),
            cursorTiles("custom")),
        ];

        if (st !== "default") {
          out.push(group("Colours · " + (item ? item.name : pack ? pack.label : ""), ...cursorLookRows(st, item ? item.id : st, !item)));
        }
        if (item) {
          const base = "cursor.custom." + idx;
          const name = h("input", {
            class: "cz-text", type: "text", value: item.name, maxlength: 40, spellcheck: "false", "aria-label": "Name",
            onchange: () => { set(base + ".name", name.value.trim().slice(0, 40) || "My cursor"); renderTab(); },
          });
          out.push(group("This cursor",
            row("Name", name, { stack: true }),
            cursorUploadRow("Normal", base + ".normal", false),
            cursorUploadRow("Pointer (links & buttons)", base + ".pointer", true),
            segRow("Click point", base + ".hot", [["tip", "Top-left"], ["center", "Centre"]]),
            h("div", { class: "cz-btns" },
              h("button", {
                type: "button", class: "cz-btn is-danger", text: "Delete cursor",
                onclick: () => {
                  if (!confirm("Delete \u201c" + item.name + "\u201d?")) return;
                  delete cur.looks[item.id];
                  cur.custom.splice(idx, 1);
                  cur.style = "default";
                  set("cursor.custom", cur.custom);
                  renderTab();
                },
              }))));
        }

        out.push(group("Options",
          rangeRow("Size", "cursor.size", 16, 96, 2, "px"),
          toggleRow("Use on all websites", "cursor.everywhere"),
          note("Open tabs switch right away. Chrome's own pages (settings, the Web Store) always keep the system cursor, and sizes over 32px turn back to the normal cursor near the window edge.")));
        return out;
      },
    },
    {
      id: "widgets",
      label: "Widgets",
      reset: "widgets",
      render: () => [
        note("Switch widgets on or off, and move or resize them. “Auto” keeps a widget in its built-in spot. Positions apply on screens wider than a phone."),
        card("clock", "Clock", "widgets.clock.show",
          toggleRow("24-hour time", "widgets.clock.h24"),
          toggleRow("Show date", "widgets.clock.date"),
          toggleRow("Show AM / PM", "widgets.clock.meridiem", { when: (s) => !s.widgets.clock.h24 }),
          ...placement("widgets.clock")),
        card("weather", "Weather", "widgets.weather.show",
          note("Sits beside the clock and moves with it. Click it on the page to change the city."),
          segRow("Units", "widgets.weather.units", [["celsius", "°C"], ["fahrenheit", "°F"]])),
        card("dock", "Shortcuts dock", "widgets.dock.show",
          segRow("Side", "widgets.dock.side", [["left", "Left"], ["right", "Right"]]),
          rangeRow("Move down", "widgets.dock.y", -100, 400, 2, "px"),
          rangeRow("Panel width", "widgets.dock.width", 300, 900, 10, "px"),
          rangeRow("Icon size", "widgets.dock.icon", 36, 96, 2, "px"),
          toggleRow("Show names", "widgets.dock.labels"),
          segRow("Icon bubbles", "widgets.dock.bubble", [["glass", "Glass bubble"], ["dark", "Dark"]]),
          toggleRow("Bubbles use accent", "widgets.dock.bubbleMatch"),
          colorRow("Bubble colour", "widgets.dock.bubbleColor", { when: (s) => !s.widgets.dock.bubbleMatch }),
          toggleRow("Box uses theme glass", "widgets.dock.panelMatch"),
          colorRow("Box colour", "widgets.dock.panelColor", { when: (s) => !s.widgets.dock.panelMatch }),
          rangeRow("Box opacity", "widgets.dock.panelAlpha", 0, 100, 1, "%", { when: (s) => !s.widgets.dock.panelMatch })),
        card("search", "Search bar", "widgets.search.show",
          selectRow("Default engine", "widgets.search.engine", engines().map((e) => [e.id, e.label])),
          note("Switch engines from the icon at the left of the bar, or send one search elsewhere with a keyword: " +
            engines().filter((e) => e.key).slice(0, 6).map((e) => "!" + e.key + " " + e.label).join(" · ") + "."),
          engineEditor(),
          toggleRow("Remember searches", "widgets.search.history"),
          note("History stays in its own panel (the clock on the bar) and never shows under what you type. It stays on this computer."),
          h("div", { class: "cz-btns" },
            h("button", {
              type: "button", class: "cz-btn", text: "Clear search history",
              onclick: (e) => {
                if (!confirm("Clear your search history?")) return;
                if (app.clearSearchHistory) app.clearSearchHistory();
                e.target.textContent = "History cleared";
                e.target.disabled = true;
              },
            })),
          ...placement("widgets.search")),
        card("media", "Now playing", "widgets.media.show", ...placement("widgets.media")),
        card("wallpaper", "Wallpaper button", "widgets.wallpaper.show", ...placement("widgets.wallpaper")),
        card("peek", "Quick Peek", "widgets.peek.show", ...placement("widgets.peek")),
        card("ai", "Assistant", "widgets.ai.show",
          note("Open the ✦ chat to see these changes as you make them."),
          rangeRow("Box width", "widgets.ai.panelWidth", 280, 640, 10, "px"),
          rangeRow("Box height", "widgets.ai.panelHeight", 300, 800, 10, "px"),
          rangeRow("Text size", "widgets.ai.fontSize", 11, 18, 0.5, "px"),
          rangeRow("Background", "widgets.ai.opacity", 10, 100, 1, "%"),
          toggleRow("Border light", "widgets.ai.light"),
          toggleRow("Show message times", "widgets.ai.time"),
          toggleRow("Your messages use accent", "widgets.ai.userMatch"),
          colorRow("Your message colour", "widgets.ai.userColor", { when: (s) => !s.widgets.ai.userMatch }),
          ...placement("widgets.ai")),
      ],
    },
    {
      id: "language",
      label: "Language",
      reset: "language",
      render: () => languageTab(),
    },
    {
      id: "privacy",
      label: "Privacy",
      render: () => privacyTab(),
    },
    {
      id: "backup",
      label: "Backup",
      render: () => {
        const msg = h("p", { class: "cz-msg", hidden: true });
        const say = (text, err) => { msg.textContent = text; msg.hidden = false; msg.classList.toggle("is-error", !!err); };
        const importInput = h("input", {
          type: "file", accept: "application/json,.json", hidden: true,
          onchange: () => {
            const f = importInput.files[0];
            importInput.value = "";
            if (!f) return;
            f.text().then((text) => {
              const data = JSON.parse(text);
              const s = data && (data.settings || data);
              if (!s || typeof s !== "object" || !(s.theme || s.widgets || s.background || s.lighting || s.cursor)) throw new Error("shape");
              replace(s);
              say("Settings imported.");
            }).catch(() => say("That file isn't an Atlas settings export.", true));
          },
        });
        return [
          group("Export & import",
            note("Save your look to a file, or load one — on another computer, or after a reset. An uploaded background file isn't included."),
            h("div", { class: "cz-btns" },
              h("button", { type: "button", class: "cz-btn is-primary", text: "Export settings", onclick: exportSettings }),
              h("button", { type: "button", class: "cz-btn", text: "Import…", onclick: () => importInput.click() }),
              importInput),
            msg),
          group("Reset",
            note("Puts every colour, background, light and widget back to the original. Your shortcuts are not touched."),
            h("div", { class: "cz-btns" },
              h("button", {
                type: "button", class: "cz-btn is-danger", text: "Reset all appearance",
                onclick: () => {
                  if (!confirm("Reset every appearance setting to the defaults?")) return;
                  media.clear();
                  replace({});
                },
              }))),
        ];
      },
    },
  ];

  /* ---- language: translation, voice typing, the assistant's voice ----
     Chrome's own menus follow the language set in chrome://settings, which
     extensions can't change; everything on web pages and in Atlas follows
     the language picked here. */
  const Langs = window.AtlasLangs;
  const Voice = window.AtlasVoice;
  const langOptions = (first) => [first].concat(Langs ? Langs.list.map((l) => [l.code, Langs.label(l)]) : []);
  const NEVER_KEY = "translate:never";
  /* language names stay in their own words; the first choice translates */
  const noTranslate = (el) => {
    [...el.querySelector("select").options].slice(1).forEach((o) => o.setAttribute("translate", "no"));
    return el;
  };

  function languageTab() {
    const out = [];
    out.push(group("Translate",
      note("Pick a language and every website you open is translated into it, along with this page. Chrome's own menus follow Chrome's setting, below."),
      noTranslate(selectRow("Language", "language.lang", langOptions(["", "Off — keep pages as they are"]))),
      toggleRow("Translate websites", "language.pages", { when: (s) => !!s.language.lang }),
      toggleRow("Translate this new tab", "language.newtab", { when: (s) => !!s.language.lang }),
      toggleRow("Show the “Translated” badge", "language.badge", { when: (s) => !!s.language.lang && s.language.pages }),
      neverList(),
      note("Pages are translated by Google Translate, so their text is sent to it. Pages already in your language are left alone."),
      h("div", { class: "cz-btns" },
        h("button", {
          type: "button", class: "cz-btn", text: "Chrome's own language…",
          onclick: () => chrome.tabs.create({ url: "chrome://settings/languages" }),
        })),
      note("Chrome's menus and settings change there: under “Preferred languages”, choose ⋮ → “Display Google Chrome in this language”, then relaunch.")));

    out.push(group("Voice typing",
      Voice && !Voice.canListen ? note("This browser can't do voice typing.") : null,
      noTranslate(selectRow("Listen for", "language.voiceLang", langOptions(["auto", "Same as above (or Chrome's)"]))),
      toggleRow("Microphone on the search bar", "language.searchMic"),
      toggleRow("Search when I stop talking", "language.searchAuto", { when: (s) => s.language.searchMic }),
      toggleRow("Microphone in the assistant", "language.ai.mic"),
      note("Voice typing uses Chrome's speech recognition, which sends what you say to Google to be written out."),
      h("div", { class: "cz-btns" },
        h("button", { type: "button", class: "cz-btn", text: "Allow microphone…", onclick: () => Voice && Voice.openMicSetup() }))));

    out.push(group("Assistant voice",
      noTranslate(selectRow("Answers in", "language.ai.reply", langOptions(["auto", "The language I use"]))),
      toggleRow("Read answers out loud", "language.ai.speak"),
      voicePicker(),
      customVoices()));
    return out;
  }

  /* sites switched off from the badge ("Never here") */
  function neverList() {
    const box = h("div", { class: "cz-never" });
    const paint = (list) => {
      box.textContent = "";
      if (!list.length) return;
      box.append(h("span", { class: "cz-label", text: "Never translated" }));
      list.forEach((host) => box.append(h("span", { class: "cz-chip", translate: "no" }, host,
        h("button", {
          type: "button", "aria-label": "Translate " + host + " again", title: "Translate again", text: "✕",
          onclick: () => {
            const next = list.filter((x) => x !== host);
            store.set(NEVER_KEY, next).then(() => paint(next));
          },
        }))));
    };
    if (hasChrome) chrome.storage.local.get([NEVER_KEY], (o) => paint(Array.isArray(o[NEVER_KEY]) ? o[NEVER_KEY] : []));
    conds.push([box, (s) => !!s.language.lang]);
    return box;
  }

  /* what a voice sounds like, in the language it will speak */
  const SAMPLE = "Hi, I'm Atlas. This is how I sound.";
  function trySample(id) {
    if (!Voice) return;
    const ai = settings.language.ai;
    const code = ai.reply !== "auto" ? ai.reply : settings.language.lang;
    const say = (text) => Voice.speak(text, { voiceId: id, custom: ai.custom, lang: Voice.speechTag(code) });
    if (!code || code === "en" || !hasChrome) return say(SAMPLE);
    /* the sample, in that language */
    chrome.runtime.sendMessage({ type: "translate:batch", texts: [SAMPLE], to: code }, (r) =>
      say(!chrome.runtime.lastError && r && r.ok ? r.out[0] : SAMPLE));
  }

  /* the suggested voices + your own, as picks */
  function voicePicker() {
    const ai = settings.language.ai;
    const wrap = h("div", { class: "cz-voices", role: "radiogroup", "aria-label": "Voice" });
    const all = (Voice ? Voice.PRESETS : []).map((p) => ({ id: p.id, name: p.name, hint: p.hint }))
      .concat(ai.custom.map((c) => ({ id: c.id, name: c.name, hint: "Custom" })));
    all.forEach((v) => {
      const b = h("button", {
        type: "button", role: "radio", class: "cz-voice" + (ai.voice === v.id ? " is-on" : ""),
        "aria-checked": String(ai.voice === v.id),
        onclick: () => {
          set("language.ai.voice", v.id);
          wrap.querySelectorAll(".cz-voice").forEach((x) => {
            const on = x === b;
            x.classList.toggle("is-on", on);
            x.setAttribute("aria-checked", String(on));
          });
          trySample(v.id);
        },
      }, h("span", { class: "cz-voice-name", text: v.name }), h("span", { class: "cz-voice-hint", text: v.hint }));
      wrap.append(b);
    });
    return row("Voice — click to hear it", wrap, { stack: true });
  }

  /* your own voices: a system voice + speed, pitch and volume */
  function customVoices() {
    const ai = settings.language.ai;
    const list = ai.custom;
    const commit = () => { set("language.ai.custom", list); renderTab(); };
    const box = h("div", { class: "cz-engs" }, h("span", { class: "cz-label", text: "Custom voices" }));

    /* the system voice list can arrive late; each select fills when it does */
    const systemVoiceSelect = (value, onChange) => {
      const sel = h("select", { class: "cz-select", "aria-label": "System voice", translate: "no", onchange: () => onChange(sel.value) },
        h("option", { value: "", text: "Auto — best for the language" }));
      (Voice ? Voice.voices() : Promise.resolve([])).then((voices) => {
        voices.slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
          .forEach((v) => sel.append(h("option", { value: v.voiceURI, text: v.name + " (" + v.lang + ")" })));
        sel.value = value;
        if (sel.value !== value) sel.value = "";
      });
      return sel;
    };

    const slider = (label, min, max, step, value, onInput) => {
      const fmt = (x) => Math.round(x * 100) + "%";
      const v = h("span", { class: "cz-val", text: fmt(value) });
      const input = h("input", {
        class: "cz-range", type: "range", min, max, step, value, "aria-label": label,
        oninput: () => { v.textContent = fmt(Number(input.value)); onInput(Number(input.value)); },
      });
      return h("div", { class: "cz-row" }, h("span", { class: "cz-label", text: label }), h("span", { class: "cz-ctl" }, input, v));
    };

    list.forEach((c) => {
      const save = () => set("language.ai.custom", list);
      const name = h("input", {
        class: "cz-text", type: "text", value: c.name, maxlength: 24, "aria-label": "Voice name", spellcheck: "false",
        onchange: () => { c.name = name.value.trim().slice(0, 24) || "My voice"; commit(); },
      });
      const inUse = ai.voice === c.id;
      box.append(h("div", { class: "cz-eng" },
        h("div", { class: "cz-eng-top" }, name,
          h("button", {
            type: "button", class: "cz-eng-del", "aria-label": "Delete " + c.name, title: "Delete", text: "✕",
            onclick: () => {
              list.splice(list.indexOf(c), 1);
              if (ai.voice === c.id) ai.voice = "atlas";
              commit();
            },
          })),
        systemVoiceSelect(c.voice, (uri) => { c.voice = uri; save(); }),
        slider("Speed", 0.5, 2, 0.05, c.rate, (x) => { c.rate = x; save(); }),
        slider("Pitch", 0, 2, 0.05, c.pitch, (x) => { c.pitch = x; save(); }),
        slider("Volume", 0, 1, 0.05, c.volume, (x) => { c.volume = x; save(); }),
        h("div", { class: "cz-btns" },
          h("button", { type: "button", class: "cz-btn", text: "▶ Try it", onclick: () => trySample(c.id) }),
          h("button", {
            type: "button", class: "cz-btn" + (inUse ? " is-primary" : ""), text: inUse ? "In use" : "Use this voice",
            disabled: inUse,
            onclick: () => { set("language.ai.voice", c.id); renderTab(); },
          }))));
    });

    if (list.length < MAX_VOICES) {
      box.append(h("div", { class: "cz-btns" },
        h("button", {
          type: "button", class: "cz-btn is-primary", text: "+ New custom voice",
          onclick: () => {
            /* starts from the voice in use, so a tweak is one step */
            const base = (Voice && Voice.PRESETS.find((p) => p.id === ai.voice)) || list.find((x) => x.id === ai.voice) || {};
            const id = "cv-" + Date.now().toString(36);
            list.push({
              id, name: "My voice " + (list.length + 1), voice: base.voice || "",
              rate: base.rate || 1, pitch: base.pitch == null ? 1 : base.pitch, volume: base.volume || 1,
            });
            ai.voice = id;
            commit();
          },
        })));
    } else box.append(note("That's the most custom voices there's room for."));
    if (!Voice || !Voice.canSpeak) box.append(note("This browser has no text-to-speech voices."));
    return box;
  }

  /* ---- privacy: the password-locked private space (vault.js) ----
     Three states: not set up, locked, unlocked. The workspace itself is
     drawn by app.js; this tab only creates, unlocks and manages it. */
  const V = window.AtlasVault;
  const MIN_PASSWORD = 4;

  function privacyTab() {
    if (!V || !V.supported) {
      return [group("Private space", note("This browser can't encrypt data here, so the private space isn't available."))];
    }
    const msgEl = () => h("p", { class: "cz-msg", role: "alert", hidden: true });
    const say = (el, text, err) => { el.textContent = text; el.hidden = false; el.classList.toggle("is-error", !!err); };
    const password = (label, auto) => h("input", {
      class: "cz-text", type: "password", "aria-label": label, autocomplete: auto || "current-password", spellcheck: "false",
    });
    /* the key stretch takes a moment; show it on the button */
    async function busy(btn, text, work) {
      const was = btn.textContent;
      btn.disabled = true;
      btn.textContent = text;
      try { await work(); } finally { btn.disabled = false; btn.textContent = was; }
    }
    const form = (onSubmit, ...kids) => h("form", {
      class: "cz-form", autocomplete: "off",
      onsubmit: (e) => { e.preventDefault(); onSubmit(e.submitter || e.target.querySelector("button[type=submit]")); },
    }, ...kids);
    const destroyGroup = (title, text) => group(title,
      note(text),
      h("div", { class: "cz-btns" },
        h("button", {
          type: "button", class: "cz-btn is-danger", text: "Delete private space",
          onclick: () => {
            if (!confirm("Delete the private space and everything in it? This can't be undone.")) return;
            V.destroy();
          },
        })));

    /* --- not set up yet --- */
    if (!V.exists()) {
      const p1 = password("Password", "new-password");
      const p2 = password("Confirm password", "new-password");
      const list = app.workspaces ? app.workspaces() : [];
      const from = h("select", { class: "cz-select", "aria-label": "Start with" },
        h("option", { value: "", text: "An empty space" }),
        list.map((w) => h("option", { value: w.id, text: "A copy of " + w.name })));
      const msg = msgEl();
      return [
        group("Private space",
          note("A hidden workspace for work shortcuts and notes. It works exactly like the others, but stays off the dock — and encrypted — until you unlock it with your password."),
          form(async (btn) => {
            if (p1.value.length < MIN_PASSWORD) return say(msg, "Use at least " + MIN_PASSWORD + " characters.", true);
            if (p1.value !== p2.value) return say(msg, "The passwords don't match.", true);
            const seed = app.vaultSeed ? app.vaultSeed(from.value) : null;
            await busy(btn, "Encrypting…", () =>
              V.create(p1.value, seed).catch((err) => say(msg, "Couldn't create it: " + err.message, true)));
          },
          row("Password", p1, { stack: true }),
          row("Confirm password", p2, { stack: true }),
          row("Start with", from),
          h("div", { class: "cz-btns" }, h("button", { type: "submit", class: "cz-btn is-primary", text: "Create private space" })),
          msg),
          note("Write the password down somewhere safe. It can't be recovered — a forgotten password means deleting the space.")),
      ];
    }

    /* --- locked --- */
    if (!V.isUnlocked()) {
      const pw = password("Password");
      const msg = msgEl();
      setTimeout(() => pw.focus(), 0);
      return [
        group("Private space · Locked",
          note("Enter your password to bring the private workspace back onto the dock."),
          form(async (btn) => {
            if (!pw.value) return say(msg, "Enter your password.", true);
            await busy(btn, "Unlocking…", () => V.unlock(pw.value).catch((err) => {
              say(msg, err.code === "wrong" ? "That password isn't right." : "Couldn't unlock: " + err.message, true);
              pw.select();
            }));
          },
          row("Password", pw, { stack: true }),
          h("div", { class: "cz-btns" }, h("button", { type: "submit", class: "cz-btn is-primary", text: "Unlock" })),
          msg)),
        destroyGroup("Forgot the password?",
          "The contents are encrypted with it, so there is no way back in. You can delete the private space and start a new one."),
      ];
    }

    /* --- unlocked --- */
    const cur = password("Current password");
    const n1 = password("New password", "new-password");
    const n2 = password("Confirm new password", "new-password");
    const pmsg = msgEl();
    return [
      group("Private space · Unlocked",
        note("Your private workspace is on the dock, with its own sections, shortcuts and notes. Anything you add there is saved encrypted."),
        h("div", { class: "cz-btns" },
          h("button", {
            type: "button", class: "cz-btn is-primary", text: "Open private space",
            onclick: () => { if (app.openVault) app.openVault(); close(); },
          }),
          h("button", { type: "button", class: "cz-btn", text: "Lock now", onclick: () => V.lock() }))),
      group("Options",
        toggleRow("Lock button on the dock", "privacy.dock"),
        toggleRow("Stay unlocked until Chrome closes", "privacy.stay"),
        segRow("Lock when idle", "privacy.autoLock", [[0, "Never"], [1, "1 min"], [5, "5 min"], [15, "15 min"], [30, "30 min"]], { stack: true }),
        note("With the lock button hidden, unlock from here or from the Command Center (type “private”). Otherwise every new tab starts locked.")),
      group("Change password",
        form(async (btn) => {
          if (n1.value.length < MIN_PASSWORD) return say(pmsg, "Use at least " + MIN_PASSWORD + " characters.", true);
          if (n1.value !== n2.value) return say(pmsg, "The new passwords don't match.", true);
          const data = app.vaultData ? app.vaultData() : null;
          if (!data) return;
          await busy(btn, "Saving…", () => V.changePassword(cur.value, n1.value, data)
            .then(() => { cur.value = n1.value = n2.value = ""; say(pmsg, "Password changed."); })
            .catch((err) => say(pmsg, err.code === "wrong" ? "The current password isn't right." : "Couldn't change it: " + err.message, true)));
        },
        row("Current password", cur, { stack: true }),
        row("New password", n1, { stack: true }),
        row("Confirm new password", n2, { stack: true }),
        h("div", { class: "cz-btns" }, h("button", { type: "submit", class: "cz-btn", text: "Change password" })),
        pmsg)),
      destroyGroup("Delete", "Removes the private workspace, its shortcuts and notes for good."),
    ];
  }

  /* ---- schedule fields ----------------------------------------------
     Repeat (once / daily / weekly / monthly / yearly), then only the
     fields that repeat needs: a date, a day of the month, weekdays, and
     always a time. Edits the rule in place and calls onChange(rule); the
     line under it says when it next happens. Also used by reminders.js
     (AtlasSettings.scheduleFields). */
  const REPEAT_LABELS = [["once", "Once"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]];
  function scheduleFields(rule, onChange, opts) {
    const S = window.AtlasSchedule;
    const o = Object.assign({ yearlyLabel: "Every year on" }, opts);
    const wrap = h("div", { class: "cz-sched" });
    const summary = h("p", { class: "cz-sched-sum" });
    const h24 = () => settings.widgets.clock.h24;
    const changed = () => {
      const nx = S.next(rule, Date.now());
      summary.textContent = S.describe(rule, h24()) + (nx ? " · next " + S.relative(nx, h24()) : rule.repeat === "once" ? " · already passed" : "");
      summary.classList.toggle("is-past", !nx);
      onChange(rule);
    };
    const field = (label, control) => h("label", { class: "cz-sched-field" }, h("span", { class: "cz-sched-label", text: label }), control);

    function paint() {
      wrap.textContent = "";
      const seg = h("div", { class: "cz-seg", role: "radiogroup", "aria-label": "Repeat" });
      REPEAT_LABELS.forEach(([v, text]) => seg.append(h("button", {
        type: "button", role: "radio", text, class: rule.repeat === v ? "is-on" : null, "aria-checked": String(rule.repeat === v),
        onclick: () => {
          rule.repeat = v;
          if (v === "weekly" && !rule.days.length) rule.days = [new Date().getDay()];
          paint();
          changed();
        },
      })));
      wrap.append(seg);

      const row = h("div", { class: "cz-sched-row" });
      if (rule.repeat === "once" || rule.repeat === "yearly") {
        const d = h("input", {
          class: "cz-text", type: "date", value: rule.date, "aria-label": "Date",
          onchange: () => { if (d.value) { rule.date = d.value; changed(); } },
        });
        row.append(field(rule.repeat === "yearly" ? o.yearlyLabel : "Date", d));
      } else if (rule.repeat === "monthly") {
        const day = Number(rule.date.slice(8, 10)) || 1;
        const sel = h("select", {
          class: "cz-select", "aria-label": "Day of the month",
          onchange: () => { rule.date = rule.date.slice(0, 8) + String(sel.value).padStart(2, "0"); changed(); },
        }, Array.from({ length: 31 }, (_, i) => h("option", { value: i + 1, text: ordinalDay(i + 1) })));
        sel.value = String(day);
        row.append(field("On the", sel));
      }
      const t = h("input", {
        class: "cz-text", type: "time", value: rule.time, "aria-label": "Time",
        onchange: () => { if (t.value) { rule.time = t.value; changed(); } },
      });
      row.append(field("Time", t));
      wrap.append(row);

      if (rule.repeat === "weekly") {
        const days = h("div", { class: "cz-days", role: "group", "aria-label": "Days of the week" });
        /* Monday first reads naturally; Sunday stays 0 in the data */
        [1, 2, 3, 4, 5, 6, 0].forEach((d) => days.append(h("button", {
          type: "button", text: S.DAY_NAMES[d].slice(0, 2), title: S.DAY_NAMES[d],
          class: rule.days.includes(d) ? "is-on" : null, "aria-pressed": String(rule.days.includes(d)),
          onclick: (e) => {
            const on = rule.days.includes(d);
            if (on && rule.days.length === 1) return; // at least one day
            rule.days = on ? rule.days.filter((x) => x !== d) : rule.days.concat(d).sort();
            e.currentTarget.classList.toggle("is-on", !on);
            e.currentTarget.setAttribute("aria-pressed", String(!on));
            changed();
          },
        })));
        wrap.append(days);
      }
      wrap.append(summary);
    }
    paint();
    const nx = S.next(rule, Date.now());
    summary.textContent = S.describe(rule, h24()) + (nx ? " · next " + S.relative(nx, h24()) : "");
    return wrap;
  }
  const ordinalDay = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

  /* ---- Background > Schedule: switch wallpapers at set times ---- */
  function wpScheduleGroup() {
    const list = settings.background.schedule;
    const wps = typeof WALLPAPERS !== "undefined" ? WALLPAPERS : [];
    const save = () => set("background.schedule", list);
    const on = (s) => s.background.scheduleOn;
    const cards = list.map((r, i) => {
      const pick = h("select", {
        class: "cz-select", "aria-label": "Wallpaper",
        onchange: () => { r.wallpaper = pick.value; save(); },
      }, wps.map((w) => h("option", { value: w.id, text: w.label })));
      pick.value = r.wallpaper || (wps[0] && wps[0].id) || "";
      const enabled = h("input", {
        class: "cz-switch", type: "checkbox", role: "switch", "aria-label": "Rule on",
        onchange: () => { r.enabled = enabled.checked; card.classList.toggle("is-off", !r.enabled); save(); },
      });
      enabled.checked = r.enabled;
      const card = h("div", { class: "cz-rule" + (r.enabled ? "" : " is-off") },
        h("div", { class: "cz-rule-top" },
          h("span", { class: "cz-rule-arrow", "aria-hidden": "true", text: "◑" }),
          pick,
          enabled,
          h("button", {
            type: "button", class: "cz-eng-del", text: "✕", title: "Delete rule", "aria-label": "Delete rule",
            onclick: () => { list.splice(i, 1); save(); renderTab(); },
          })),
        scheduleFields(r, save));
      return card;
    });
    const add = h("button", {
      type: "button", class: "cz-btn is-primary", text: "+ Add a change",
      onclick: () => {
        const cur = app.currentWallpaper ? app.currentWallpaper() : null;
        const other = wps.find((w) => w.id !== cur) || wps[0];
        list.push({
          id: "wr-" + Date.now().toString(36), repeat: "daily", date: AtlasSchedule.today(), time: "18:00", days: [],
          wallpaper: other ? other.id : "", enabled: true,
        });
        save();
        renderTab();
      },
    });
    return group("Schedule",
      note("Change the live wallpaper by itself — at a time each day, on chosen weekdays, on a date, or every year. The latest change whose time has come decides; picking a wallpaper yourself holds until the next one."),
      toggleRow("Use the schedule", "background.scheduleOn"),
      ...cards.map((c) => row("", c, { stack: true, when: on })),
      row("", h("div", { class: "cz-btns" }, list.length < MAX_WP_RULES ? add : note("That's as many changes as fit.")), { stack: true, when: on }));
  }

  /* ---- custom search engines: edit in place, add below ---- */
  function engineEditor() {
    const list = settings.widgets.search.engines;
    const commit = () => { set("widgets.search.engines", list); renderTab(); };
    /* a keyword already used by another engine would be ambiguous */
    const keyTaken = (key, selfId) => !!key && engines().some((e) => e.key === key && e.id !== selfId);
    const input = (value, placeholder, label, extra) => h("input", Object.assign({
      class: "cz-text", type: "text", value, placeholder, spellcheck: "false", "aria-label": label,
    }, extra));

    const rows = list.map((e, i) => {
      const msg = h("p", { class: "cz-msg is-error", hidden: true });
      const name = input(e.name, "Name", "Engine name", { maxlength: 30 });
      const key = input(e.key ? "!" + e.key : "", "!key", "Keyword", { class: "cz-text cz-eng-key" });
      const url = input(e.url, "https://example.com/search?q=%s", "Search URL");
      const fail = (t) => { msg.textContent = t; msg.hidden = false; };
      const save = () => {
        const k = cleanKey(key.value);
        if (!name.value.trim()) return fail("Give it a name.");
        if (!isSearchUrl(url.value)) return fail("The URL must start with http:// or https://");
        if (keyTaken(k, e.id)) return fail("!" + k + " is already used by another engine.");
        msg.hidden = true;
        Object.assign(list[i], { name: name.value.trim().slice(0, 30), url: url.value.trim(), key: k });
        key.value = k ? "!" + k : "";
        set("widgets.search.engines", list);
      };
      [name, key, url].forEach((el) => el.addEventListener("change", save));
      return h("div", { class: "cz-eng" },
        h("div", { class: "cz-eng-top" }, name, key,
          h("button", {
            type: "button", class: "cz-eng-del", "aria-label": "Delete " + e.name, title: "Delete", text: "✕",
            onclick: () => {
              list.splice(i, 1);
              if (settings.widgets.search.engine === e.id) settings.widgets.search.engine = "google";
              commit();
            },
          })),
        url, msg);
    });

    const name = input("", "Name, e.g. Stack Overflow", "New engine name", { maxlength: 30 });
    const key = input("", "!so", "New engine keyword", { class: "cz-text cz-eng-key" });
    const url = input("", "https://stackoverflow.com/search?q=%s", "New engine URL");
    const msg = h("p", { class: "cz-msg is-error", hidden: true });
    const add = h("form", {
      class: "cz-eng is-new",
      onsubmit: (ev) => {
        ev.preventDefault();
        const k = cleanKey(key.value);
        const fail = (t) => { msg.textContent = t; msg.hidden = false; };
        if (!name.value.trim()) return fail("Give it a name.");
        if (!isSearchUrl(url.value)) return fail("The URL must start with http:// or https:// — put %s where the search goes.");
        if (keyTaken(k)) return fail("!" + k + " is already used by another engine.");
        list.push({ id: "c-" + Date.now().toString(36), name: name.value.trim().slice(0, 30), url: url.value.trim(), key: k });
        commit();
      },
    },
    h("div", { class: "cz-eng-top" }, name, key),
    url,
    h("div", { class: "cz-btns" }, h("button", { type: "submit", class: "cz-btn is-primary", text: "Add engine" })),
    msg);

    return h("div", { class: "cz-engs" },
      h("span", { class: "cz-label", text: "Custom engines" }),
      ...rows,
      list.length < MAX_CUSTOM_ENGINES ? add : note("That's the most custom engines there's room for."));
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify({ atlas: "appearance", v: 1, settings }, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "atlas-appearance.json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---- cursor helpers ---- */
  const accentNow = () => settings.theme.accent;
  const cursorPic = (style, state) => {
    const img = h("img", { alt: "", "data-style": style, "data-state": state });
    img.src = AtlasCursors.preview(settings.cursor, style, accentNow(), state);
    return img;
  };
  /* redraw every preview after a colour change, without rebuilding rows */
  function refreshCursorPics() {
    body.querySelectorAll("img[data-style]").forEach((img) => {
      img.src = AtlasCursors.preview(settings.cursor, img.dataset.style, accentNow(), img.dataset.state);
    });
  }

  /* the packs, or the user's own cursors plus an Add tile */
  function cursorTiles(which) {
    const wrap = h("div", { class: "cz-cursors", role: "radiogroup", "aria-label": which === "packs" ? "Cursor packs" : "My cursors" });
    const tile = (style, label, pics) => {
      const on = settings.cursor.style === style;
      return h("button", {
        type: "button", class: "cz-cur" + (on ? " is-on" : ""), role: "radio", "aria-checked": String(on),
        onclick: () => { set("cursor.style", style); renderTab(); },
      }, h("span", { class: "cz-cur-pics", "aria-hidden": "true" }, ...pics), h("span", { class: "cz-cur-name", text: label }));
    };
    if (which === "packs") {
      AtlasCursors.PACKS.forEach((p) => {
        wrap.append(tile(p.id, p.label, p.id === "default"
          ? [h("span", { class: "cz-cur-sys", text: "↖" })]
          : [cursorPic(p.id, "normal"), cursorPic(p.id, "pointer")]));
      });
      return wrap;
    }
    settings.cursor.custom.forEach((c) => {
      const st = "custom:" + c.id;
      wrap.append(tile(st, c.name, [cursorPic(st, "normal"), c.pointer ? cursorPic(st, "pointer") : null]));
    });
    if (settings.cursor.custom.length < AtlasCursors.MAX_CUSTOM) {
      wrap.append(h("button", {
        type: "button", class: "cz-cur is-add",
        onclick: () => cursorFile((url) => {
          const list = settings.cursor.custom;
          const id = AtlasCursors.newId();
          list.push({ id, name: "Cursor " + (list.length + 1), normal: url, pointer: "", hot: "tip" });
          set("cursor.custom", list);
          set("cursor.style", "custom:" + id);
          renderTab();
        }),
      }, h("span", { class: "cz-cur-pics", "aria-hidden": "true" }, h("span", { class: "cz-cur-sys", text: "+" })),
        h("span", { class: "cz-cur-name", text: "Add cursor" })));
    }
    return wrap;
  }

  /* colour + effect controls for one cursor's look. Values are read through
     lookFor() so an untouched cursor shows its own colours */
  function cursorLookRows(style, id, isPack) {
    const look = () => AtlasCursors.lookFor(settings.cursor, id, accentNow());
    const put = (key, v) => {
      const looks = settings.cursor.looks;
      looks[id] = Object.assign({}, looks[id], { [key]: v });
      set("cursor.looks", looks);
      refreshCursorPics();
    };
    const colour = (label, key) => {
      const v = look()[key];
      const code = h("span", { class: "cz-hex", text: v });
      const swatch = h("label", { class: "cz-color", title: label });
      swatch.style.background = v;
      const input = h("input", {
        type: "color", value: v, "aria-label": label,
        oninput: () => { put(key, input.value); swatch.style.background = input.value; code.textContent = input.value; },
      });
      swatch.append(input);
      return row(label, h("span", { class: "cz-ctl" }, code, swatch));
    };
    const range = (label, key, min, max, step, unit) => {
      const out = h("span", { class: "cz-val", text: look()[key] + unit });
      const input = h("input", {
        class: "cz-range", type: "range", min, max, step, value: look()[key], "aria-label": label,
        oninput: () => { put(key, Number(input.value)); out.textContent = input.value + unit; },
      });
      return row(label, h("span", { class: "cz-ctl" }, input, out));
    };
    const L = look();
    const tint = h("input", {
      class: "cz-switch", type: "checkbox", role: "switch", "aria-label": "Tint with one colour",
      onchange: () => { put("tintOn", tint.checked); renderTab(); },
    });
    tint.checked = L.tintOn;

    const rows = [h("div", { class: "cz-cur-big", "aria-hidden": "true" }, cursorPic(style, "normal"), cursorPic(style, "pointer"))];
    if (isPack) {
      rows.push(
        colour("Cursor colour", "fill"),
        colour("Cursor outline", "stroke"),
        colour("Pointer colour", "pFill"),
        colour("Pointer outline", "pStroke"));
    }
    rows.push(
      row("Tint with one colour", tint),
      L.tintOn ? colour("Tint colour", "tint") : null,
      L.tintOn ? null : range("Hue shift", "hue", 0, 360, 5, "°"),
      L.tintOn ? null : range("Saturation", "sat", 0, 250, 5, "%"),
      range("Brightness", "bright", 30, 200, 5, "%"),
      range("Glow", "glow", 0, 8, 1, ""),
      colour("Glow colour", "glowColor"),
      h("div", { class: "cz-btns" },
        h("button", {
          type: "button", class: "cz-btn", text: "Reset colours",
          onclick: () => {
            delete settings.cursor.looks[id];
            set("cursor.looks", settings.cursor.looks);
            renderTab();
          },
        })));
    return rows.filter(Boolean);
  }

  /* pick an image, shrink it to 128px (Chrome's cursor limit) and hand back
     a PNG data URL */
  function cursorFile(done) {
    const input = h("input", { type: "file", accept: "image/*,.svg", hidden: true });
    input.addEventListener("change", () => {
      const f = input.files[0];
      input.remove();
      if (!f || !/^image\//.test(f.type)) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const max = 128;
        const iw = img.naturalWidth || max;
        const ih = img.naturalHeight || max;
        const k = Math.min(1, max / Math.max(iw, ih));
        const w = Math.max(1, Math.round(iw * k));
        const ht = Math.max(1, Math.round(ih * k));
        const c = document.createElement("canvas");
        c.width = c.height = Math.max(w, ht);
        c.getContext("2d").drawImage(img, (c.width - w) / 2, (c.height - ht) / 2, w, ht);
        URL.revokeObjectURL(url);
        done(c.toDataURL("image/png"));
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
    document.body.append(input);
    input.click();
  }
  function cursorUploadRow(label, path, optional) {
    const has = !!getPath(settings, path);
    return row(label, h("div", { class: "cz-btns" },
      has ? h("img", { class: "cz-cur-thumb", src: getPath(settings, path), alt: "" }) : null,
      h("button", {
        type: "button", class: "cz-btn" + (has ? "" : " is-primary"), text: has ? "Replace…" : "Upload…",
        onclick: () => cursorFile((url) => { set(path, url); renderTab(); }),
      }),
      has && optional ? h("button", {
        type: "button", class: "cz-btn", text: "Remove",
        onclick: () => { set(path, ""); renderTab(); },
      }) : null,
      !has && optional ? h("span", { class: "cz-file", text: "Uses the normal image" }) : null), { stack: true });
  }

  /* the built-in live wallpapers; picking one hands over to app.js */
  function wallpaperButtons() {
    const wrap = h("div", { class: "cz-wps" });
    const list = typeof WALLPAPERS !== "undefined" ? WALLPAPERS : [];
    const current = app.currentWallpaper ? app.currentWallpaper() : null;
    list.forEach((wp) => {
      wrap.append(h("button", {
        type: "button", class: "cz-wp" + (wp.id === current ? " is-on" : ""), "data-id": wp.id, text: wp.label,
        onclick: () => {
          if (app.setWallpaper) app.setWallpaper(wp.id);
          wrap.querySelectorAll(".cz-wp").forEach((b) => b.classList.toggle("is-on", b.dataset.id === wp.id));
        },
      }));
    });
    return wrap;
  }

  /* an image or video from disk, kept in IndexedDB */
  const filePicker = h("input", { type: "file", accept: "image/*,video/*", hidden: true });
  let uploadStatus = null;
  filePicker.addEventListener("change", async () => {
    const f = filePicker.files[0];
    filePicker.value = "";
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) {
      if (uploadStatus) uploadStatus.textContent = "Pick an image or a video file.";
      return;
    }
    if (uploadStatus) uploadStatus.textContent = "Saving…";
    try {
      await media.put(f);
      settings.background.customName = f.name;
      settings.background.customId = Date.now();
      set("background.mode", "upload");
      renderTab();
    } catch {
      if (uploadStatus) uploadStatus.textContent = "Couldn't save that file. It may be too large.";
    }
  });
  function uploadRow(when) {
    const bg = settings.background;
    uploadStatus = h("span", { class: "cz-file", text: bg.customId ? bg.customName || "Your file" : "No file chosen yet" });
    const el = h("div", { class: "cz-row is-stack" },
      uploadStatus,
      h("div", { class: "cz-btns" },
        h("button", { type: "button", class: "cz-btn is-primary", text: bg.customId ? "Replace file…" : "Choose image or video…", onclick: () => filePicker.click() }),
        bg.customId
          ? h("button", {
              type: "button", class: "cz-btn", text: "Remove",
              onclick: async () => {
                await media.clear();
                settings.background.customId = 0;
                settings.background.customName = "";
                set("background.mode", "video");
                renderTab();
              },
            })
          : null),
      filePicker);
    conds.push([el, when]);
    return el;
  }

  /* --- panel shell --- */
  let activeTab = "theme";
  let lastFocus = null;
  const tabsEl = h("div", { class: "cz-tabs", role: "tablist", "aria-label": "Customize sections" });
  const body = h("div", { class: "cz-body", role: "tabpanel" });
  const resetBtn = h("button", {
    type: "button", class: "cz-btn", text: "Reset tab",
    onclick: () => {
      const tab = TABS.find((t) => t.id === activeTab);
      if (!tab || !tab.reset) return;
      const next = clone(settings);
      next[tab.reset] = clone(DEFAULTS[tab.reset]);
      /* resetting the cursor tab keeps the cursors you uploaded */
      if (tab.reset === "cursor") next.cursor.custom = clone(settings.cursor.custom);
      if (tab.reset === "background") media.clear();
      replace(next);
    },
  });
  const panel = h("aside", { class: "cz", id: "cz", role: "dialog", "aria-label": "Customize", hidden: true },
    h("div", { class: "cz-head" },
      h("span", { class: "cz-title", text: "Customize" }),
      h("button", { type: "button", class: "cz-x", "aria-label": "Close", text: "✕", onclick: () => close() })),
    tabsEl,
    body,
    h("div", { class: "cz-foot" },
      resetBtn,
      h("button", { type: "button", class: "cz-btn is-primary", text: "Done", onclick: () => close() })));

  /* the highlight behind the active tab slides between tabs */
  const tabInk = h("span", { class: "cz-tab-ink", "aria-hidden": "true" });
  tabsEl.append(tabInk);
  TABS.forEach((t) => {
    tabsEl.append(h("button", {
      type: "button", class: "cz-tab", role: "tab", "data-id": t.id, text: t.label,
      onclick: () => switchTab(t.id),
    }));
  });

  function moveInk(instant) {
    const on = tabsEl.querySelector(".cz-tab.is-on");
    if (!on || !on.offsetWidth) return;
    tabInk.classList.toggle("is-instant", !!instant);
    tabInk.style.width = on.offsetWidth + "px";
    tabInk.style.height = on.offsetHeight + "px";
    tabInk.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
    if (instant) void tabInk.offsetWidth; // commit before transitions return
    tabInk.classList.remove("is-instant");
  }

  /* the body's rows cascade in: sideways after a tab switch (the way the
     tabs moved), upward when the panel opens. Only then — ordinary redraws
     while editing stay still. */
  let enterTimer = 0;
  function enter(dir) {
    body.dataset.enter = dir;
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => delete body.dataset.enter, 1200);
  }

  function switchTab(id) {
    if (id === activeTab) return;
    const from = TABS.findIndex((t) => t.id === activeTab);
    const to = TABS.findIndex((t) => t.id === id);
    activeTab = id;
    enter(to > from ? "fwd" : "back");
    renderTab();
    body.scrollTop = 0;
  }

  function renderTab() {
    const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
    tabsEl.querySelectorAll(".cz-tab").forEach((b) => {
      const on = b.dataset.id === tab.id;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", String(on));
    });
    const scroll = body.scrollTop;
    conds = [];
    body.textContent = "";
    body.append(...tab.render());
    Array.from(body.children).forEach((c, i) => c.style.setProperty("--k", Math.min(i, 10)));
    body.scrollTop = scroll;
    resetBtn.hidden = !tab.reset;
    markPresets();
    syncConditions();
    moveInk();
  }

  const fxName = () => (PANEL_FX.some(([v]) => v === settings.lighting.panelFx) ? settings.lighting.panelFx : "glide");

  /* closing plays the exit animation first; the panel is hidden when it
     ends. `closing` also lets open() take over mid-exit. */
  let closing = false;
  let closeTimer = 0;
  const isOpen = () => !panel.hidden && !closing;

  function open(tab) {
    /* one drawer at a time on the right */
    if (window.AtlasReminders && AtlasReminders.isOpen()) AtlasReminders.close();
    if (tab && TABS.some((t) => t.id === tab)) activeTab = tab;
    const fresh = panel.hidden || closing;
    if (panel.hidden) lastFocus = document.activeElement;
    closing = false;
    clearTimeout(closeTimer);
    panel.classList.remove("is-closing");
    panel.inert = false;
    panel.dataset.fx = fxName();
    panel.hidden = false;
    if (fresh) enter("open");
    renderTab();
    moveInk(true);
    const first = tabsEl.querySelector(".is-on");
    if (first) first.focus();
  }

  function close(after) {
    if (!isOpen()) return;
    closing = true;
    panel.dataset.fx = fxName();
    panel.classList.add("is-closing");
    panel.inert = true; // no clicks on a panel that is leaving
    if (!after && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    const finish = () => {
      panel.removeEventListener("animationend", onEnd);
      clearTimeout(closeTimer);
      if (!closing) return; // reopened meanwhile
      closing = false;
      panel.hidden = true;
      panel.inert = false;
      panel.classList.remove("is-closing");
      body.textContent = "";
      conds = [];
      if (typeof after === "function") after();
      else lastFocus = null;
    };
    const onEnd = (e) => { if (e.target === panel) finish(); };
    panel.addEventListener("animationend", onEnd);
    /* in case no animation runs (hidden tab, animations stripped) */
    closeTimer = setTimeout(finish, 1600);
  }

  /* Preview: play the exit and entrance back to back */
  function replay() {
    const keep = lastFocus;
    close(() => { open(); lastFocus = keep; });
  }

  document.body.append(panel);
  /* registered before app.js's own Escape handlers, so closing the panel
     doesn't also close the launcher behind it */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen() && !e.defaultPrevented) {
      e.preventDefault();
      close();
    }
  });

  /* the Privacy tab follows the vault as it locks and unlocks */
  if (V) {
    V.on((type) => {
      /* a new password leaves the state as it was — and its message on screen */
      if (type === "beforelock" || type === "change") return;
      if (isOpen() && activeTab === "privacy") renderTab();
    });
  }

  /* ================= PUBLIC API ========================================== */
  /* filled in by app.js: setWallpaper, currentWallpaper, and for the
     private space workspaces, vaultSeed, vaultData, openVault */
  const app = {};

  /* every engine, built-ins first, in one shape:
     { id, label, url, key, icon?, mono?, tint?, custom? } */
  function engines() {
    const out = Object.entries(ENGINES).map(([id, e]) => Object.assign({ id }, e));
    settings.widgets.search.engines.forEach((e) => out.push({
      id: e.id, label: e.name, url: e.url, key: e.key, mono: e.name[0].toUpperCase(), custom: true,
    }));
    return out;
  }
  const findEngine = (id) => engines().find((e) => e.id === id) || null;
  /* the default engine; a deleted custom one falls back to Google */
  function engine() {
    return findEngine(settings.widgets.search.engine) || findEngine("google");
  }

  const ready = store.get(KEY).then((raw) => {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && data.settings) settings = load(data.settings);
    } catch {}
    applyCss();
    return settings;
  });

  window.AtlasSettings = {
    ready,
    get: () => settings,
    /* a change from outside the panel (e.g. the wallpaper menu) redraws it,
       so its controls never show a stale value */
    set: (path, value) => {
      set(path, value);
      if (!panel.hidden) renderTab();
    },
    on: (fn) => listeners.push(fn),
    open,
    close,
    isOpen,
    engine,
    engines,
    findEngine,
    scheduleFields,
    media,
    app,
  };
})();
