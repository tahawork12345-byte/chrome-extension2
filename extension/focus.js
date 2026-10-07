/* ATLAS NEW TAB — focus timer
   A Pomodoro-style timer: focus for `work` minutes, then a short break,
   and a long break after every `every` focus sessions (settings.focus).
   background.js keeps the clock ("focus:state") so a session ends — sound,
   notification, next phase — even with no new tab open; this file only
   draws it and sends the buttons:
     - the pill at the top of the page while a session runs
     - the wallpaper dim while focusing
     - the Quick tools > Focus view (quicktools.js calls render())
   While focusing, the site blocker's list is blocked (background.js).
   Finished and stopped sessions are in "focus:history".                  */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  if (!AS) return;

  const KEY = "focus:state";
  const HIST = "focus:history";
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const IDLE = { phase: "idle", endsAt: 0, left: 0, paused: false, round: 0, startedAt: 0, next: "focus" };
  const NAMES = { focus: "Focus", short: "Short break", long: "Long break", idle: "Ready" };

  let state = Object.assign({}, IDLE);
  let history = [];
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });

  const ready = new Promise((r) => {
    if (!hasChrome) return r();
    chrome.storage.local.get([KEY, HIST], (o) => {
      state = Object.assign({}, IDLE, o[KEY]);
      history = Array.isArray(o[HIST]) ? o[HIST] : [];
      r();
    });
  });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch[HIST]) history = Array.isArray(ch[HIST].newValue) ? ch[HIST].newValue : [];
    if (ch[KEY]) state = Object.assign({}, IDLE, ch[KEY].newValue);
    if (ch[KEY] || ch[HIST]) { paint(); emit(); }
  });

  const send = (type, extra) => new Promise((r) => {
    if (!hasChrome || !chrome.runtime) return r();
    chrome.runtime.sendMessage(Object.assign({ type: "focus:" + type }, extra), () => { void chrome.runtime.lastError; r(); });
  });
  const cmd = {
    start: (phase) => send("start", { phase }),
    pause: () => send("pause"),
    resume: () => send("resume"),
    stop: () => send("stop"),
    skip: () => send("skip"),
  };

  const prefs = () => AS.get().focus;
  const running = () => state.phase !== "idle";
  const leftMs = () => (state.paused ? state.left : Math.max(0, state.endsAt - Date.now()));
  const totalMs = () => {
    const p = prefs();
    return (state.phase === "focus" ? p.work : state.phase === "short" ? p.short : p.long) * 60000;
  };
  const clock = (ms) => {
    const s = Math.ceil(ms / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, "0");
    return hh ? hh + ":" + String(mm).padStart(2, "0") + ":" + ss : mm + ":" + ss;
  };

  /* ---------- history, for this view and the stats dashboard ---------- */
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function minutesByDay() {
    const out = {};
    history.forEach((s) => { const k = dayKey(s.start); out[k] = (out[k] || 0) + (Number(s.min) || 0); });
    return out;
  }
  /* days in a row, up to today, with at least one finished session */
  function streak() {
    const days = new Set(history.filter((s) => s.done).map((s) => dayKey(s.start)));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // today can still come
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- helpers ---------- */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };
  const svg = (d, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
    skip: '<path d="M6 5.5v13l9-6.5zM18 5.5v13"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M10 3h4"/>',
  };

  /* ---------- the pill + the dim ---------- */
  const pill = h("div", { class: "focus-pill", role: "timer", "aria-live": "off", hidden: true });
  const pillDot = h("span", { class: "focus-pill-dot" });
  const pillName = h("button", { type: "button", class: "focus-pill-name", title: "Open the focus timer", onclick: () => openView() });
  const pillTime = h("span", { class: "focus-pill-time" });
  const pillPause = h("button", { type: "button", class: "focus-pill-btn", onclick: () => (state.paused ? cmd.resume() : cmd.pause()) });
  const pillStop = h("button", { type: "button", class: "focus-pill-btn", title: "Stop", "aria-label": "Stop", html: svg(I.stop, 13), onclick: () => cmd.stop() });
  const pillBar = h("span", { class: "focus-pill-bar" }, h("i"));
  pill.append(pillDot, pillName, pillTime, pillPause, pillStop, pillBar);
  document.body.append(pill);

  let view = null; // the open Quick tools view's live parts
  function paint() {
    const on = running();
    const p = prefs();
    pill.hidden = !on || !p.pill;
    pill.dataset.phase = state.phase;
    pill.classList.toggle("is-paused", !!state.paused);
    document.body.style.setProperty("--focus-dim", on && state.phase === "focus" && p.dim ? 0.45 : 0);
    document.body.classList.toggle("is-focusing", on && state.phase === "focus");
    if (on) {
      const left = leftMs();
      const pct = Math.min(100, 100 - (left / totalMs()) * 100);
      pillName.textContent = NAMES[state.phase] + (state.paused ? " · paused" : "");
      pillTime.textContent = clock(left);
      pillBar.firstChild.style.width = pct + "%";
      pillPause.innerHTML = svg(state.paused ? I.play : I.pause, 13);
      pillPause.title = state.paused ? "Resume" : "Pause";
      pillPause.setAttribute("aria-label", pillPause.title);
    }
    if (view) view.tick();
  }
  setInterval(() => { if (running() && !state.paused) paint(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) paint(); });
  AS.on((s, path) => { if (path === "*" || path.startsWith("focus.")) paint(); });

  const openView = () => window.AtlasQuickTools && AtlasQuickTools.open("focus");

  /* ---------- Quick tools > Focus ----------
     q: quicktools.js's shared bits { body, sub, switchRow, section, show } */
  function render(q) {
    const p = prefs();
    const R = 52;
    const C = 2 * Math.PI * R;
    const ring = h("div", { class: "focus-ring" });
    ring.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="focus-ring-track"/><circle cx="60" cy="60" r="${R}" class="focus-ring-fill" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`;
    const fill = ring.querySelector(".focus-ring-fill");
    const time = h("span", { class: "focus-ring-time" });
    const label = h("span", { class: "focus-ring-label" });
    const dots = h("span", { class: "focus-dots", "aria-hidden": "true" });
    ring.append(h("div", { class: "focus-ring-mid" }, label, time, dots));
    const btns = h("div", { class: "focus-btns" });

    const btn = (icon, text, onclick, primary) => h("button", { type: "button", class: "qt-btn" + (primary ? " is-primary" : ""), html: svg(icon, 13) + " " + text, onclick });
    let shape = "";
    function paintButtons() {
      /* rebuilt only when what they can do changes, so a click isn't lost to a tick */
      const next = running() ? (state.paused ? "paused" : "run") : "idle:" + state.next;
      if (next === shape) return;
      shape = next;
      btns.textContent = "";
      if (!running()) {
        const nx = state.next || "focus";
        btns.append(btn(I.play, nx === "focus" ? "Start focus" : "Start " + NAMES[nx].toLowerCase(), () => cmd.start(nx), true));
        if (nx !== "focus") btns.append(btn(I.skip, "Skip break", () => cmd.start("focus")));
        else btns.append(h("div", { class: "qt-chips" },
          h("button", { type: "button", class: "qt-chip", text: "Short break", onclick: () => cmd.start("short") }),
          h("button", { type: "button", class: "qt-chip", text: "Long break", onclick: () => cmd.start("long") })));
      } else {
        btns.append(
          state.paused ? btn(I.play, "Resume", cmd.resume, true) : btn(I.pause, "Pause", cmd.pause, true),
          btn(I.skip, state.phase === "focus" ? "Skip to break" : "Skip break", cmd.skip),
          btn(I.stop, "Stop", cmd.stop));
      }
    }
    function tick() {
      const pr = prefs();
      const on = running();
      const total = on ? totalMs() : pr.work * 60000;
      const left = on ? leftMs() : total;
      fill.style.strokeDashoffset = String(C * (left / total));
      ring.dataset.phase = state.phase;
      time.textContent = clock(left);
      label.textContent = on ? NAMES[state.phase] + (state.paused ? " · paused" : "") : state.next !== "focus" ? "Up next: " + NAMES[state.next].toLowerCase() : "Ready to focus";
      dots.textContent = "";
      /* this cycle's finished sessions; a full row until the long break ends */
      const cycle = state.round && state.round % pr.every === 0 ? pr.every : state.round % pr.every;
      for (let i = 0; i < pr.every; i++) dots.append(h("i", { class: i < cycle ? "is-on" : "" }));
      q.sub.textContent = on
        ? NAMES[state.phase] + (state.paused ? " · paused" : " · ends " + new Date(Date.now() + left).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
        : todayLine();
      paintButtons();
    }
    view = { tick };

    /* today */
    const todayMin = minutesByDay()[dayKey(Date.now())] || 0;
    const todayN = history.filter((s) => s.done && dayKey(s.start) === dayKey(Date.now())).length;
    const st = streak();
    const kpis = h("div", { class: "focus-kpis" },
      kpi(String(todayN), "sessions today"), kpi(fmtMin(todayMin), "focused today"), kpi(st + (st === 1 ? " day" : " days"), "streak"));

    /* settings */
    const minutes = (label, key, max) => {
      const input = h("input", { class: "qt-input focus-num", type: "number", min: "1", max: String(max), value: String(p[key]), "aria-label": label });
      input.addEventListener("change", () => {
        const v = Math.round(Math.min(max, Math.max(1, Number(input.value) || p[key])));
        input.value = v;
        AS.set("focus." + key, v);
      });
      return h("label", { class: "qt-row" }, h("span", { text: label }), h("span", { class: "focus-min" }, input, h("small", { text: key === "every" ? "sessions" : "min" })));
    };
    const sounds = [["chime", "Chime"], ["bell", "Bell"], ["digital", "Digital"], ["pulse", "Soft pulse"], ["custom", "My alarm sound"], ["none", "No sound"]];
    const soundSel = h("select", { class: "qt-select", "aria-label": "Sound" }, sounds.map(([v, t]) => h("option", { value: v, text: t })));
    soundSel.value = p.sound;
    soundSel.addEventListener("change", () => {
      AS.set("focus.sound", soundSel.value);
      if (window.AtlasSounds && soundSel.value !== "none") AtlasSounds.play(soundSel.value, { volume: 70 });
    });
    const bl = AS.get().blocker;
    /* it blocks the site blocker's list, which is part of Atlas Pro */
    const blockLocked = !!window.AtlasPro && !AtlasPro.isPro();
    const blockRow = q.switchRow("Block distracting sites", "focus.block", () => q.show("focus"));
    if (blockLocked) {
      const sw = blockRow.querySelector("input");
      sw.checked = false;
      sw.addEventListener("click", (e) => {
        e.preventDefault();
        AtlasPro.need("Blocking sites while you focus uses the site blocker, which is part of Atlas Pro.");
      });
    }
    const blockNote = p.block && !blockLocked
      ? h("p", { class: "qt-empty" }, bl.sites.length
        ? "Blocks your " + bl.sites.length + " site" + (bl.sites.length === 1 ? "" : "s") + " from Site blocker while you focus — breaks from the blocked page are off. "
        : "Your Site blocker list is empty, so nothing is blocked yet. ",
      h("button", { type: "button", class: "qt-link", text: "Edit the list", onclick: () => q.show("blocker") }))
      : null;

    q.body.append(
      h("section", { class: "focus-main" }, ring, btns),
      kpis,
      q.section("Timer",
        minutes("Focus", "work", 180), minutes("Short break", "short", 60), minutes("Long break", "long", 90), minutes("Long break every", "every", 12)),
      q.section("While focusing",
        blockRow, blockNote,
        q.switchRow("Dim the wallpaper", "focus.dim"),
        q.switchRow("Timer at the top of the page", "focus.pill")),
      q.section("When time's up",
        h("label", { class: "qt-row" }, h("span", { text: "Sound" }), soundSel),
        q.switchRow("Notification", "focus.notify"),
        q.switchRow("Start breaks by themselves", "focus.autoBreak"),
        q.switchRow("Start the next focus by itself", "focus.autoNext")),
      historySection(q));
    tick();
  }

  const kpi = (value, label) => h("div", { class: "focus-kpi" }, h("strong", { text: value }), h("small", { text: label }));
  const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + "h " + (m % 60 ? (m % 60) + "m" : "") : m + "m").trim();
  function todayLine() {
    const m = minutesByDay()[dayKey(Date.now())] || 0;
    return m ? fmtMin(m) + " focused today" : "25 minutes of focus, then a break";
  }

  function historySection(q) {
    const recent = history.slice(-40).reverse();
    const out = q.section("History");
    if (!recent.length) {
      out.append(h("p", { class: "qt-empty", text: "Finished and stopped sessions show up here." }));
      return out;
    }
    let lastDay = "";
    const t = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    recent.forEach((s) => {
      const d = dayKey(s.start);
      if (d !== lastDay) {
        lastDay = d;
        const total = minutesByDay()[d] || 0;
        out.append(h("div", { class: "focus-hday" },
          h("span", { text: d === dayKey(Date.now()) ? "Today" : new Date(s.start).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) }),
          h("span", { text: fmtMin(total) })));
      }
      out.append(h("div", { class: "focus-hrow" + (s.done ? "" : " is-stopped") },
        h("span", { class: "focus-hdot" }),
        h("span", { text: t(s.start) + " – " + t(s.end) }),
        h("span", { class: "qt-pct", text: s.min + " min" + (s.done ? "" : " · stopped") })));
    });
    out.append(h("button", {
      type: "button", class: "qt-link", text: "Clear history",
      onclick: () => {
        if (!confirm("Clear your focus history? Your stats lose it too.")) return;
        chrome.storage.local.set({ [HIST]: [] }, () => q.show("focus"));
      },
    }));
    return out;
  }

  ready.then(paint);

  window.AtlasFocus = {
    ready,
    NAMES,
    state: () => state,
    history: () => history,
    minutesByDay,
    streak,
    isRunning: running,
    on: (fn) => listeners.push(fn),
    start: cmd.start,
    stop: cmd.stop,
    toggle: () => (running() ? (state.paused ? cmd.resume() : cmd.pause()) : cmd.start(state.next || "focus")),
    render,
    /* quicktools.js calls this when the Focus view closes */
    detach: () => { view = null; },
    tile: () => (running() ? NAMES[state.phase] + " · " + clock(leftMs()) : todayLine()),
  };
})();
