/* ATLAS NEW TAB — minimal mode
   A quiet page: every widget not kept in Customize > Minimal fades away.
   Settings (`minimal` in customize.js): mode "off" | "on" | "auto", where
   auto follows a list of times (days + from / to).

   Switching by hand (dock button, M key, Command Center, the Exit button)
   while mode is "auto" is an override: it holds until the schedule itself
   changes (a set time starts or ends), then the schedule is back in
   charge. The override is kept apart from the settings, under
   "minimal:override", so every open tab agrees.                          */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  if (!AS) return;

  const OVERRIDE_KEY = "minimal:override";
  /* each kept-or-hidden part, by the key in settings.minimal.keep */
  const PARTS = {
    clock: ".clock-main",
    weather: ".weather",
    search: "#search",
    dock: "#rail, #launcher",
    media: "#media",
    /* the Zen clock button; the minimal button beside it stays, as the way back */
    wallpaper: "#zenBtn",
    peek: "#peek",
    ai: "#ai",
    quote: "#quote",
  };

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  let override = null; // { value, sched } — sched: what the schedule said when it was made
  let on = false;

  /* ---------- the schedule ---------- */
  const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  function ruleActive(r, now) {
    const from = mins(r.from), to = mins(r.to);
    if (from === to) return false;
    const t = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay();
    if (from < to) return r.days.includes(day) && t >= from && t < to;
    /* overnight: belongs to the day it starts on */
    return (r.days.includes(day) && t >= from) || (r.days.includes((day + 6) % 7) && t < to);
  }
  const scheduled = (now) => AS.get().minimal.rules.some((r) => ruleActive(r, now));

  function wanted() {
    const m = AS.get().minimal;
    if (m.mode === "on") return true;
    if (m.mode === "off") return false;
    const sched = scheduled(new Date());
    if (override && override.sched === sched) return override.value;
    if (override) clearOverride(); // the schedule moved on
    return sched;
  }

  /* ---------- showing it ---------- */
  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "min-exit";
  exitBtn.hidden = true;
  exitBtn.innerHTML = '<span class="min-dot" aria-hidden="true"></span><span>Minimal</span><span class="min-sep" aria-hidden="true">·</span><span>Exit</span>';
  exitBtn.setAttribute("aria-label", "Exit minimal mode");
  exitBtn.addEventListener("click", () => toggle(false));
  document.body.append(exitBtn);

  /* the button beside the wallpaper toggle: click switches, right-click
     opens the settings (they show in the Quick tools panel) */
  const minBtn = document.getElementById("minBtn");
  if (minBtn) {
    minBtn.addEventListener("click", () => toggle());
    minBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (window.AtlasQuickTools) AtlasQuickTools.open("minimal");
    });
  }

  function apply() {
    const m = AS.get().minimal;
    const next = wanted();
    const changed = next !== on;
    on = next;
    document.body.classList.toggle("is-minimal", on);
    document.body.style.setProperty("--min-dim", on ? m.dim / 100 : 0);
    Object.entries(PARTS).forEach(([key, sel]) => {
      const hide = on && !m.keep[key];
      /* .min-hidden ends in visibility: hidden, so nothing hidden can be tabbed to */
      document.querySelectorAll(sel).forEach((el) => el.classList.toggle("min-hidden", hide));
    });
    exitBtn.hidden = !on || !m.exit;
    if (minBtn) {
      minBtn.classList.toggle("is-on", on);
      minBtn.setAttribute("aria-pressed", String(on));
      minBtn.setAttribute("aria-label", on ? "Exit minimal mode" : "Minimal mode");
      minBtn.dataset.label = on ? "Exit minimal" : "Minimal";
    }
    if (changed) listeners.forEach((fn) => fn(on));
  }

  /* ---------- switching by hand ---------- */
  function setOverride(value) {
    override = { value, sched: scheduled(new Date()) };
    if (hasChrome) chrome.storage.local.set({ [OVERRIDE_KEY]: override });
  }
  function clearOverride() {
    override = null;
    if (hasChrome) chrome.storage.local.remove(OVERRIDE_KEY);
  }
  function toggle(value) {
    const next = typeof value === "boolean" ? value : !on;
    const m = AS.get().minimal;
    if (m.mode === "auto") {
      if (next === scheduled(new Date())) clearOverride();
      else setOverride(next);
      apply();
    } else AS.set("minimal.mode", next ? "on" : "off"); // the settings listener applies it
  }

  const listeners = [];
  AS.on((s, path) => {
    if (path === "*" || path.startsWith("minimal.")) apply();
  });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[OVERRIDE_KEY]) return;
    override = ch[OVERRIDE_KEY].newValue || null;
    apply();
  });

  /* the schedule is checked on the minute */
  setTimeout(function tick() {
    apply();
    setTimeout(tick, 60000 - (Date.now() % 60000) + 20);
  }, 60000 - (Date.now() % 60000) + 20);

  /* M switches it, unless typing somewhere */
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing || e.ctrlKey || e.metaKey || e.altKey || (e.key !== "m" && e.key !== "M")) return;
    if (window.AtlasZen && AtlasZen.isOpen()) return;
    e.preventDefault();
    toggle();
  });

  Promise.all([AS.ready, hasChrome ? new Promise((r) => chrome.storage.local.get([OVERRIDE_KEY], r)) : {}]).then(([, o]) => {
    override = (o && o[OVERRIDE_KEY]) || null;
    apply();
  });

  window.AtlasMinimal = {
    isOn: () => on,
    toggle,
    on: (fn) => listeners.push(fn),
  };
})();
