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
    },
    widgets: {
      clock: widget({ h24: false, date: true, meridiem: true }),
      weather: { show: true, units: cfgUnits },
      dock: { show: true, side: "left", y: 0, width: 470, icon: 58, labels: true },
      search: widget({ engine: "google", customUrl: "" }),
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

  const googleUrl = typeof SEARCH_URL !== "undefined" ? SEARCH_URL : "https://www.google.com/search?q=";
  const ENGINES = {
    google: { label: "Google", url: googleUrl },
    bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
    duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
    brave: { label: "Brave", url: "https://search.brave.com/search?q=" },
    youtube: { label: "YouTube", url: "https://www.youtube.com/results?search_query=" },
    custom: { label: "Custom", url: "" },
  };

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
        ".wp-layer.is-active,.wp-image.is-active{animation:none}",
        ".trace{display:none}"
      );
    }

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
    applyCss();
    save();
    emit(path);
    syncConditions();
  }

  /* many values changed at once (preset, reset, import) */
  function replace(next) {
    settings = merge(clone(DEFAULTS), next);
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
    d.addEventListener("toggle", () => (d.open ? openCards.add(id) : openCards.delete(id)));
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
        ];
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
          toggleRow("Show names", "widgets.dock.labels")),
        card("search", "Search bar", "widgets.search.show",
          selectRow("Engine", "widgets.search.engine", Object.entries(ENGINES).map(([k, e]) => [k, e.label])),
          textRow("Search URL", "widgets.search.customUrl", "https://example.com/search?q=%s",
            { when: (s) => s.widgets.search.engine === "custom" }),
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
              if (!s || typeof s !== "object" || !(s.theme || s.widgets || s.background || s.lighting)) throw new Error("shape");
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

  function exportSettings() {
    const blob = new Blob([JSON.stringify({ atlas: "appearance", v: 1, settings }, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "atlas-appearance.json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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

  TABS.forEach((t) => {
    tabsEl.append(h("button", {
      type: "button", class: "cz-tab", role: "tab", "data-id": t.id, text: t.label,
      onclick: () => { activeTab = t.id; renderTab(); body.scrollTop = 0; },
    }));
  });

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
    body.scrollTop = scroll;
    resetBtn.hidden = !tab.reset;
    markPresets();
    syncConditions();
  }

  function open(tab) {
    if (tab && TABS.some((t) => t.id === tab)) activeTab = tab;
    if (panel.hidden) lastFocus = document.activeElement;
    panel.hidden = false;
    renderTab();
    const first = tabsEl.querySelector(".is-on");
    if (first) first.focus();
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    body.textContent = "";
    conds = [];
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  document.body.append(panel);
  /* registered before app.js's own Escape handlers, so closing the panel
     doesn't also close the launcher behind it */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden && !e.defaultPrevented) {
      e.preventDefault();
      close();
    }
  });

  /* ================= PUBLIC API ========================================== */
  const app = {}; // filled in by app.js: setWallpaper, currentWallpaper

  function engine() {
    const s = settings.widgets.search;
    if (s.engine === "custom") {
      const url = String(s.customUrl || "").trim();
      if (/^https?:\/\//i.test(url)) return { label: "the web", url };
      return ENGINES.google;
    }
    return ENGINES[s.engine] || ENGINES.google;
  }

  const ready = store.get(KEY).then((raw) => {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && data.settings) settings = merge(clone(DEFAULTS), data.settings);
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
    isOpen: () => !panel.hidden,
    engine,
    media,
    app,
  };
})();
