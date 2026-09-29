/* ATLAS NEW TAB — quick tools
   The bottom-right corner: the Quick tools button (a grid of tools) and,
   apart from it, the ✦ assistant. One panel; each tool opens in it, with
   ← back to the grid:
     ✓  Notes & Goals — notes, and goals with a progress bar each. A goal's
        tasks have their own Complete button (the task turns green) and an
        optional date + time; with the bell on, the task rings like any
        reminder (it is written into the Reminders list, which
        background.js rings anywhere in Chrome).
     ⚡ Optimize — the open tabs, closing duplicates, putting tabs to sleep
        (and waking them), undoing the last close, and auto optimize
        (settings.optimize; background.js runs it).
     ⊘  Site blocker — settings.blocker (background.js applies it)
     ▢  Minimal mode — settings.minimal (minimal.js applies it). Not in
        the grid: the minimal button beside the wallpaper toggle switches
        it, and its right-click opens these settings.
     ❝  Daily quote — settings.widgets.quote + quotes (quote.js shows it)
     ◷  Focus — the focus timer (focus.js draws the view)
   Notes and goals live in "qt:tasks"; habits (a third tab there) in
   "qt:habits".                                                           */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  const ai = document.getElementById("ai");
  if (!AS || !ai) return;

  const TASKS_KEY = "qt:tasks";
  const REM_KEY = "reminders";
  const CLOSED_KEY = "qt:closed";
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const hasTabs = hasChrome && chrome.tabs && chrome.tabs.query;
  const read = (k, fb) => new Promise((r) => (hasChrome ? chrome.storage.local.get([k], (o) => r(o[k] === undefined ? fb : o[k])) : r(fb)));
  const write = (k, v) => new Promise((r) => (hasChrome ? chrome.storage.local.set({ [k]: v }, r) : r()));
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    back: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    chat: '<path d="M12 3.5 13.9 10.1 20.5 12l-6.6 1.9L12 20.5l-1.9-6.6L3.5 12l6.6-1.9z"/>',
    tasks: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
    bolt: '<path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12z"/>',
    block: '<circle cx="12" cy="12" r="8"/><path d="M6.4 6.4l11.2 11.2"/>',
    zen: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    minimal: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M9 12h6"/>',
    quote: '<path d="M9.5 7C6.8 7.8 5 10.1 5 13v4h5v-5H7.6c.2-1.7 1.3-3 2.9-3.6zM18.5 7c-2.7.8-4.5 3.1-4.5 6v4h5v-5h-2.4c.2-1.7 1.3-3 2.9-3.6z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5.5 12.5 4 4 9-9.5"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 12h9l1-12"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
    undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
    chart: '<path d="M5 19.5V11M10 19.5V5M15 19.5v-6M20 19.5V8.5"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v3.7h-3.7"/>',
    tabs: '<rect x="3.5" y="5" width="17" height="13" rx="2.5"/><path d="M3.5 9h17M8 5v4"/>',
    puzzle: '<path d="M9 4.5h3a1.5 1.5 0 0 1 3 0h3.5V9a1.5 1.5 0 0 1 0 3v6.5H14a1.5 1.5 0 0 0-3 0H5.5V14a1.5 1.5 0 0 0 0-3V4.5z"/>',
    list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.8" cy="7" r=".6"/><circle cx="4.8" cy="12" r=".6"/><circle cx="4.8" cy="17" r=".6"/>',
    heart: '<path d="M12 19.5s-7-4.3-7-9.5a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.2-7 9.5-7 9.5z"/>',
    share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
  };

  /* ================= THE BUTTON + PANEL ================================ */
  const aiToggle = document.getElementById("aiToggle");
  const aiPanel = document.getElementById("aiPanel");
  const bar = h("div", { class: "qt-bar", role: "toolbar", "aria-label": "Quick tools" });
  const toolsBtn = h("button", { type: "button", class: "ai-bubble qt-bubble", "aria-label": "Quick tools", title: "Quick tools", "aria-expanded": "false", html: svg(I.grid, 17) });
  const badge = h("span", { class: "qt-badge", hidden: true });
  toolsBtn.append(badge);
  ai.insertBefore(bar, aiToggle);
  bar.append(toolsBtn, aiToggle);

  const P = (() => {
    const panel = h("div", { class: "ai-panel qt-panel", role: "dialog", "aria-label": "Quick tools", hidden: true });
    const back = h("button", { type: "button", class: "ai-icon-btn qt-back", "aria-label": "All tools", title: "All tools", html: svg(I.back, 16) });
    const title = h("span", { class: "ai-name" });
    const sub = h("span", { class: "ai-status" }, h("span"));
    const close = h("button", { type: "button", class: "ai-icon-btn", "aria-label": "Close", title: "Close", html: svg(I.close, 15) });
    const body = h("div", { class: "qt-body" });
    panel.append(h("div", { class: "ai-head" }, back, h("span", { class: "ai-who" }, title, sub), close), body);
    ai.append(panel);
    return { panel, back, title, sub: sub.firstChild, close, body };
  })();

  let view = "home";
  const VIEWS = {
    home: ["Quick tools", () => renderHome()],
    tasks: ["Notes & Goals", () => renderTasks()],
    optimize: ["Optimize", () => renderOptimize()],
    blocker: ["Site blocker", () => renderBlocker()],
    minimal: ["Minimal mode", () => renderMinimal()],
    quote: ["Daily quote", () => renderQuote()],
    tabmanager: ["Tab manager", () => renderTabManager()],
    extensions: ["Extensions", () => renderExtensions()],
    faq: ["FAQs", () => renderFaq()],
    changelog: ["Changelog", () => renderChangelog()],
    focus: ["Focus", () => window.AtlasFocus && AtlasFocus.render({ body: P.body, sub: P.sub, switchRow, section, show })],
  };
  function show(v) {
    if (window.AtlasFocus) AtlasFocus.detach();
    view = VIEWS[v] ? v : "home";
    const [title, render] = VIEWS[view];
    P.panel.setAttribute("aria-label", title);
    P.title.textContent = title;
    P.sub.textContent = "";
    P.back.hidden = view === "home";
    P.body.textContent = "";
    P.body.scrollTop = 0;
    render();
  }
  function open(v) {
    closeAll(P.panel);
    P.panel.hidden = false;
    toolsBtn.classList.add("is-open");
    toolsBtn.setAttribute("aria-expanded", "true");
    show(v || "home");
  }
  function closeAll(except) {
    if (except !== P.panel) {
      P.panel.hidden = true;
      if (window.AtlasFocus) AtlasFocus.detach();
      toolsBtn.classList.remove("is-open");
      toolsBtn.setAttribute("aria-expanded", "false");
    }
    if (except !== aiPanel && !aiPanel.hidden) document.getElementById("aiClose").click();
  }
  /* the views below were written as panels of their own; these stand in */
  const viewPanel = (v) => ({ get hidden() { return P.panel.hidden || view !== v; }, contains: (n) => P.panel.contains(n) });
  const T = { body: P.body, sub: P.sub, panel: viewPanel("tasks") };
  const O = { body: P.body, sub: P.sub, panel: viewPanel("optimize") };

  toolsBtn.addEventListener("click", () => (P.panel.hidden ? open("home") : closeAll()));
  P.back.addEventListener("click", () => show("home"));
  P.close.addEventListener("click", () => closeAll());
  /* the assistant's own bubble closes the panel first */
  aiToggle.addEventListener("click", () => closeAll(aiPanel), true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || P.panel.hidden) return;
    if (e.target.closest && e.target.closest(".qt-panel") && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target.value) return;
    if (view !== "home") show("home");
    else closeAll();
  });

  /* small shared controls for the settings views */
  const getPath = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), AS.get());
  function switchRow(label, path, after) {
    const input = h("input", { type: "checkbox", class: "cz-switch", role: "switch", "aria-label": label });
    input.checked = !!getPath(path);
    input.addEventListener("change", () => { AS.set(path, input.checked); if (after) after(input.checked); });
    return h("label", { class: "qt-row" }, h("span", { text: label }), input);
  }
  const section = (title, ...kids) => h("section", { class: "qt-section" }, title ? h("h4", { class: "qt-h", text: title }) : null, ...kids);
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function dayPicker(days, onChange) {
    const wrap = h("div", { class: "qt-days", role: "group", "aria-label": "Days" });
    DAY_SHORT.forEach((label, d) => {
      const b = h("button", {
        type: "button", text: label[0] + label[1], title: label, class: days.includes(d) ? "is-on" : "", "aria-pressed": String(days.includes(d)),
        onclick: () => {
          const next = days.includes(d) ? days.filter((x) => x !== d) : days.concat(d).sort();
          onChange(next);
        },
      });
      wrap.append(b);
    });
    return wrap;
  }
  const timeInput = (value, label, onChange) => h("input", {
    class: "qt-input qt-time", type: "time", value, "aria-label": label,
    onchange: (e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) onChange(e.target.value); },
  });

  /* ================= HOME: every tool ================================== */
  function renderHome() {
    const tasks = allTasks();
    const done = tasks.filter((t) => t.done).length;
    const bl = AS.get().blocker;
    const q = AS.get().widgets.quote;
    P.sub.textContent = "Everything in one place";
    const tile = (icon, name, sub, onclick, cls) => h("button", { type: "button", class: "qt-tile" + (cls ? " " + cls : ""), onclick },
      h("span", { class: "qt-tile-icon", html: svg(icon, 18) }),
      h("span", { class: "qt-tile-name", text: name }),
      h("small", { text: sub }));
    const dueN = tasks.filter((t) => !t.done && t.date && t.date <= today()).length;
    const F = window.AtlasFocus;
    P.body.append(h("div", { class: "qt-grid" },
      F ? tile(I.zen, "Focus", F.tile(), () => show("focus"), F.isRunning() ? "is-on" : "") : null,
      window.AtlasStats ? tile(I.chart, "Stats", "Your time and progress", () => { closeAll(); AtlasStats.open(); }) : null,
      tile(I.tasks, "Notes & Goals", tasks.length ? done + " of " + tasks.length + " done" + (dueN ? " · " + dueN + " due" : "") : "Plan and track", () => show("tasks")),
      hasTabs ? tile(I.bolt, "Optimize", AS.get().optimize.auto ? "Auto optimize on" : "Tidy your tabs", () => show("optimize")) : null,
      tile(I.block, "Site blocker", bl.on ? "On · " + bl.sites.length + " site" + (bl.sites.length === 1 ? "" : "s") : "Off", () => show("blocker"), bl.on ? "is-on" : ""),
      window.AtlasQuote ? tile(I.quote, "Daily quote", q.show ? (q.every === "day" ? "New one daily" : "New one each tab") : "Hidden", () => show("quote")) : null,
      hasTabs ? tile(I.tabs, "Tab manager", sessions.length ? sessions.length + " saved session" + (sessions.length === 1 ? "" : "s") : "Save and reopen tabs", () => show("tabmanager")) : null,
      hasChrome && chrome.permissions ? tile(I.puzzle, "Extensions", "Turn them on and off", () => show("extensions")) : null),
    footer());
  }

  /* ================= NOTES & GOALS ===================================== */
  let data = { notes: [], goals: [] };
  let tab = "goals";
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h24 = () => AS.get().widgets.clock.h24;
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  function normalize(d) {
    const str = (v, n) => String(v || "").slice(0, n);
    const out = { notes: [], goals: [] };
    (Array.isArray(d && d.notes) ? d.notes : []).forEach((n) => {
      if (n && n.id && typeof n.text === "string") out.notes.push({ id: n.id, text: str(n.text, 4000), at: Number(n.at) || Date.now() });
    });
    (Array.isArray(d && d.goals) ? d.goals : []).forEach((g) => {
      if (!g || !g.id) return;
      out.goals.push({
        id: g.id, title: str(g.title, 80) || "Goal",
        tasks: (Array.isArray(g.tasks) ? g.tasks : []).filter((t) => t && t.id).map((t) => ({
          id: t.id, text: str(t.text, 200), done: !!t.done, doneAt: Number(t.doneAt) || 0,
          date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : "",
          time: /^\d{2}:\d{2}$/.test(t.time) ? t.time : "",
          remind: !!t.remind,
        })),
      });
    });
    return out;
  }

  const ready = read(TASKS_KEY, null).then((d) => { data = normalize(d); paintBadge(); });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[TASKS_KEY]) return;
    const next = normalize(ch[TASKS_KEY].newValue);
    if (JSON.stringify(next) !== JSON.stringify(data)) { // not our own save
      data = next;
      paintBadge();
      if (!T.panel.hidden && !T.panel.contains(document.activeElement)) renderTasks();
    }
    notesListeners.forEach((fn) => fn());
  });
  const notesListeners = [];

  async function save() {
    await write(TASKS_KEY, data);
    paintBadge();
    await syncReminders();
  }

  /* tasks with a date, a time and the bell on become one-time reminders
     (id "tk" + task id); done or deleted tasks take theirs away */
  async function syncReminders() {
    const list = await read(REM_KEY, []);
    const rems = Array.isArray(list) ? list : [];
    const want = new Map();
    data.goals.forEach((g) => g.tasks.forEach((t) => {
      if (t.remind && t.date && t.time && !t.done) want.set("tk" + t.id, { t, g });
    }));
    let changed = false;
    const next = rems.filter((r) => {
      if (!r || !r.fromTask) return true;
      if (want.has(r.id)) return true;
      changed = true;
      return false;
    });
    want.forEach(({ t, g }, id) => {
      const title = "Task: " + t.text;
      const note = "Goal: " + g.title;
      const cur = next.find((r) => r.id === id);
      if (cur && cur.date === t.date && cur.time === t.time && cur.title === title && cur.note === note && cur.enabled) return;
      const rem = {
        id, fromTask: true, title, note, repeat: "once", date: t.date, time: t.time, days: [],
        sound: cur ? cur.sound : "default", enabled: true, updatedAt: Date.now(), lastFired: 0,
      };
      if (cur) Object.assign(cur, rem);
      else next.push(rem);
      changed = true;
    });
    if (changed) await write(REM_KEY, next);
  }

  const allTasks = () => data.goals.flatMap((g) => g.tasks);
  function paintBadge() {
    /* tasks due today that aren't done */
    const n = allTasks().filter((t) => !t.done && t.date && t.date <= today()).length;
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.hidden = !n;
    toolsBtn.setAttribute("aria-label", "Quick tools" + (n ? " — " + n + " task" + (n === 1 ? "" : "s") + " due" : ""));
  }

  function dueText(t) {
    if (!t.date) return "";
    const [y, m, d] = t.date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const diff = Math.round((date - new Date(new Date().toDateString())) / 86400000);
    const dayWord = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : DAY[date.getDay()] + ", " + d + " " + MON[m - 1];
    let time = "";
    if (t.time) {
      const [hh, mm] = t.time.split(":").map(Number);
      time = h24() ? t.time : (hh % 12 || 12) + ":" + String(mm).padStart(2, "0") + (hh >= 12 ? " PM" : " AM");
    }
    return dayWord + (time ? " · " + time : "");
  }
  const overdue = (t) => {
    if (t.done || !t.date) return false;
    const [y, m, d] = t.date.split("-").map(Number);
    const [hh, mm] = (t.time || "23:59").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm) < new Date();
  };

  function progress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const el = h("div", { class: "qt-progress" + (total && done === total ? " is-full" : ""), role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct) },
      h("span", { class: "qt-progress-fill" }));
    el.firstChild.style.width = pct + "%";
    return [el, pct];
  }

  function renderTasks() {
    const body = T.body;
    const keepScroll = body.scrollTop;
    body.textContent = "";
    const tasks = allTasks();
    const done = tasks.filter((t) => t.done).length;
    T.sub.textContent = tab === "habits" ? habitsLine() : tasks.length ? done + " of " + tasks.length + " tasks done" : "Plan it, then tick it off";

    const tabs = h("div", { class: "qt-tabs", role: "tablist" },
      [["goals", "Goals"], ["habits", "Habits"], ["notes", "Notes"]].map(([id, label]) => h("button", {
        type: "button", role: "tab", class: "qt-tab" + (tab === id ? " is-on" : ""), "aria-selected": String(tab === id),
        text: label + (id === "notes" && data.notes.length ? " (" + data.notes.length + ")" : ""),
        onclick: () => { tab = id; renderTasks(); },
      })));
    body.append(tabs);
    if (tab === "notes") renderNotes(body);
    else if (tab === "habits") renderHabits(body);
    else renderGoals(body, tasks, done);
    body.scrollTop = keepScroll;
  }

  function renderGoals(body, tasks, done) {
    if (tasks.length) {
      const [bar, pct] = progress(done, tasks.length);
      body.append(h("div", { class: "qt-overall" },
        h("div", { class: "qt-overall-top" }, h("span", { text: "All goals" }), h("span", { class: "qt-pct", text: pct + "%" })), bar));
    }

    data.goals.forEach((g) => {
      const gDone = g.tasks.filter((t) => t.done).length;
      const [gBar, gPct] = progress(gDone, g.tasks.length);
      const complete = g.tasks.length && gDone === g.tasks.length;
      const title = h("input", {
        class: "qt-goal-title", type: "text", value: g.title, maxlength: "80", "aria-label": "Goal name",
        onchange: (e) => { g.title = e.target.value.trim() || "Goal"; save(); },
      });
      const card = h("section", { class: "qt-goal" + (complete ? " is-complete" : "") },
        h("div", { class: "qt-goal-head" }, title,
          h("span", { class: "qt-pct", text: g.tasks.length ? gDone + "/" + g.tasks.length : "" }),
          h("button", {
            type: "button", class: "qt-icon", title: "Delete goal", "aria-label": "Delete goal " + g.title, html: svg(I.trash, 14),
            onclick: () => {
              if (g.tasks.length && !confirm("Delete “" + g.title + "” and its " + g.tasks.length + " task(s)?")) return;
              data.goals = data.goals.filter((x) => x !== g);
              save().then(renderTasks);
            },
          })),
        gBar,
        complete ? h("p", { class: "qt-goal-done", text: "Goal complete — nice work! (" + gPct + "%)" }) : null);

      g.tasks.forEach((t) => card.append(taskRow(g, t)));
      card.append(addTaskForm(g));
      body.append(card);
    });

    /* a new goal */
    const input = h("input", { class: "qt-input", type: "text", placeholder: data.goals.length ? "New goal…" : "Your first goal, e.g. Finish the project", maxlength: "80", "aria-label": "New goal" });
    body.append(h("form", {
      class: "qt-add qt-add-goal",
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return input.focus();
        data.goals.push({ id: uid("g"), title: v, tasks: [] });
        save().then(() => { renderTasks(); const f = T.body.querySelectorAll(".qt-task-add .qt-input"); if (f.length) f[f.length - 1].focus(); });
      },
    }, input, h("button", { type: "submit", class: "qt-btn is-primary", text: "Add goal" })));
  }

  function taskRow(g, t) {
    const row = h("div", { class: "qt-task" + (t.done ? " is-done" : "") + (overdue(t) ? " is-late" : "") });
    const completeBtn = h("button", {
      type: "button", class: "qt-complete" + (t.done ? " is-done" : ""), "aria-pressed": String(t.done),
      title: t.done ? "Mark as not done" : "Complete task",
      onclick: () => {
        t.done = !t.done;
        t.doneAt = t.done ? Date.now() : 0;
        save().then(renderTasks);
      },
    });
    completeBtn.innerHTML = svg(I.check, 13) + "<span>" + (t.done ? "Done" : "Complete") + "</span>";
    const text = h("input", {
      class: "qt-task-text", type: "text", value: t.text, maxlength: "200", "aria-label": "Task",
      onchange: (e) => { t.text = e.target.value.trim() || t.text; save(); },
    });
    const due = dueText(t);
    const meta = h("div", { class: "qt-task-meta" },
      due ? h("span", { class: "qt-due", text: due }) : null,
      t.remind && t.date && t.time ? h("span", { class: "qt-bell", title: "Reminder on", html: svg(I.bell, 12) }) : null,
      h("button", {
        type: "button", class: "qt-link", text: due ? "Change" : "Add date & time",
        onclick: () => { row.classList.toggle("is-editing"); const d = row.querySelector(".qt-task-edit input"); if (d) d.focus(); },
      }));
    const edit = dueEditor(t, () => save().then(renderTasks));
    edit.classList.add("qt-task-edit");
    row.append(
      h("div", { class: "qt-task-top" }, text,
        h("button", {
          type: "button", class: "qt-icon", title: "Delete task", "aria-label": "Delete task", html: svg(I.trash, 13),
          onclick: () => { g.tasks = g.tasks.filter((x) => x !== t); save().then(renderTasks); },
        })),
      h("div", { class: "qt-task-bottom" }, meta, completeBtn),
      edit);
    return row;
  }

  /* date + time + day + bell */
  function dueEditor(t, done) {
    const date = h("input", { class: "qt-input qt-date", type: "date", value: t.date || "", "aria-label": "Date" });
    const time = h("input", { class: "qt-input qt-time", type: "time", value: t.time || "", "aria-label": "Time" });
    const day = h("span", { class: "qt-day" });
    const paintDay = () => {
      if (!date.value) return (day.textContent = "");
      const [y, m, d] = date.value.split("-").map(Number);
      day.textContent = DAY[new Date(y, m - 1, d).getDay()];
    };
    date.addEventListener("input", paintDay);
    paintDay();
    const bell = h("label", { class: "qt-remind", title: "Ring a reminder at this time" },
      h("input", { type: "checkbox", checked: t.remind || !t.date }), h("span", { html: svg(I.bell, 12) + " Remind me" }));
    const apply = () => {
      t.date = date.value;
      t.time = time.value;
      t.remind = bell.firstChild.checked && !!(date.value && time.value);
      done();
    };
    const quick = (days) => {
      const d = new Date(); d.setDate(d.getDate() + days);
      date.value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!time.value) time.value = "09:00";
      paintDay();
    };
    return h("div", { class: "qt-due-edit" },
      h("div", { class: "qt-due-row" }, date, day, time),
      h("div", { class: "qt-due-row" },
        h("button", { type: "button", class: "qt-chip", text: "Today", onclick: () => quick(0) }),
        h("button", { type: "button", class: "qt-chip", text: "Tomorrow", onclick: () => quick(1) }),
        h("button", { type: "button", class: "qt-chip", text: "Next week", onclick: () => quick(7) }),
        bell),
      h("div", { class: "qt-due-row" },
        h("button", { type: "button", class: "qt-btn is-primary", text: "Save", onclick: apply }),
        t.date ? h("button", { type: "button", class: "qt-btn", text: "Clear date", onclick: () => { date.value = ""; time.value = ""; apply(); } }) : null));
  }

  function addTaskForm(g) {
    const input = h("input", { class: "qt-input", type: "text", placeholder: "Add a task…", maxlength: "200", "aria-label": "New task for " + g.title });
    const draft = { date: "", time: "", remind: true };
    const dueBtn = h("button", { type: "button", class: "qt-icon", title: "Date, time and reminder", "aria-label": "Date, time and reminder", html: svg(I.bell, 14) });
    const form = h("form", {
      class: "qt-add qt-task-add",
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return input.focus();
        const ed = form.querySelector(".qt-due-edit");
        if (ed && !ed.hidden) {
          draft.date = ed.querySelector(".qt-date").value;
          draft.time = ed.querySelector(".qt-time").value;
          draft.remind = ed.querySelector(".qt-remind input").checked && !!(draft.date && draft.time);
        }
        g.tasks.push({ id: uid("t"), text: v, done: false, doneAt: 0, date: draft.date, time: draft.time, remind: draft.remind && !!(draft.date && draft.time) });
        const goalId = g.id;
        save().then(() => {
          renderTasks();
          const again = [...T.body.querySelectorAll(".qt-task-add")].find((f) => f.dataset.goal === goalId);
          if (again) again.querySelector(".qt-input").focus();
        });
      },
    }, h("div", { class: "qt-add-row" }, input, dueBtn, h("button", { type: "submit", class: "qt-btn", text: "Add" })));
    form.dataset.goal = g.id;
    const ed = dueEditor(draft, () => {});
    ed.hidden = true;
    /* inside the add form, "Save" just keeps the values for the new task */
    ed.querySelector(".qt-btn.is-primary").textContent = "Use for the new task";
    ed.querySelector(".qt-btn.is-primary").addEventListener("click", () => { ed.hidden = true; dueBtn.classList.add("is-on"); input.focus(); });
    dueBtn.addEventListener("click", () => { ed.hidden = !ed.hidden; });
    form.append(ed);
    return form;
  }

  function renderNotes(body) {
    const input = h("textarea", { class: "qt-input qt-note-input", rows: "3", placeholder: "Write a note…", maxlength: "4000", "aria-label": "New note" });
    const add = h("form", {
      class: "qt-add qt-note-add",
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return input.focus();
        data.notes.unshift({ id: uid("n"), text: v, at: Date.now() });
        save().then(renderTasks);
      },
    }, input, h("button", { type: "submit", class: "qt-btn is-primary", text: "Add note" }));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add.requestSubmit(); });
    body.append(add);
    if (!data.notes.length) body.append(h("p", { class: "qt-empty", text: "Notes stay on this computer. Ctrl + Enter adds one." }));
    data.notes.forEach((n) => {
      const text = h("textarea", { class: "qt-note-text", rows: "2", "aria-label": "Note", maxlength: "4000" });
      text.value = n.text;
      const fit = () => { text.style.height = "auto"; text.style.height = text.scrollHeight + "px"; };
      text.addEventListener("input", fit);
      text.addEventListener("change", () => {
        if (!text.value.trim()) return;
        n.text = text.value;
        n.at = Date.now();
        save();
      });
      body.append(h("div", { class: "qt-note" }, text,
        h("div", { class: "qt-note-foot" },
          h("span", { text: new Date(n.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }),
          h("button", {
            type: "button", class: "qt-icon", title: "Copy", "aria-label": "Copy note", html: svg(I.copy, 13),
            onclick: () => navigator.clipboard && navigator.clipboard.writeText(n.text),
          }),
          h("button", {
            type: "button", class: "qt-icon", title: "Delete note", "aria-label": "Delete note", html: svg(I.trash, 13),
            onclick: () => { data.notes = data.notes.filter((x) => x !== n); save().then(renderTasks); },
          }))));
      requestAnimationFrame(fit);
    });
  }

  /* ================= HABITS ============================================
     "qt:habits" = { habits: [{ id, name, days (0 = Sunday; the days it's
     due), created ("YYYY-MM-DD"), done: ["YYYY-MM-DD", …] }] }.
     A streak counts the due days in a row that were done, back from today
     (today doesn't break it until it's over). Free accounts track up to
     PRO_CONFIG.freeHabits; Pro, any number.                              */
  const HABITS_KEY = "qt:habits";
  const MAX_HABITS = 30;
  const HEAT_WEEKS = 15;
  let habits = [];
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parseYmd = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const YMD = /^\d{4}-\d{2}-\d{2}$/;

  function normalizeHabits(d) {
    const list = Array.isArray(d && d.habits) ? d.habits : [];
    return list.filter((x) => x && x.id).slice(0, MAX_HABITS).map((x) => {
      const days = Array.isArray(x.days) ? [...new Set(x.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [];
      return {
        id: String(x.id),
        name: String(x.name || "").slice(0, 60) || "Habit",
        days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        created: YMD.test(x.created) ? x.created : today(),
        /* sorted, no repeats, the last ~2 years */
        done: [...new Set((Array.isArray(x.done) ? x.done : []).filter((k) => YMD.test(k)))].sort().slice(-800),
      };
    });
  }
  const habitsReady = read(HABITS_KEY, null).then((d) => { habits = normalizeHabits(d); });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[HABITS_KEY]) return;
    const next = normalizeHabits(ch[HABITS_KEY].newValue);
    if (JSON.stringify(next) === JSON.stringify(habits)) return; // our own save
    habits = next;
    if (!T.panel.hidden && tab === "habits" && !T.panel.contains(document.activeElement)) renderTasks();
  });
  const saveHabits = () => write(HABITS_KEY, { habits });

  const isDue = (hb, d) => hb.days.includes(d.getDay());
  function streakOf(hb) {
    const done = new Set(hb.done);
    const d = new Date();
    const start = parseYmd(hb.done.length && hb.done[0] < hb.created ? hb.done[0] : hb.created);
    if (!done.has(ymd(d))) d.setDate(d.getDate() - 1); // today isn't over yet
    let n = 0;
    for (let i = 0; i < 800 && d >= start; i++, d.setDate(d.getDate() - 1)) {
      if (!isDue(hb, d)) continue;
      if (!done.has(ymd(d))) break;
      n++;
    }
    return n;
  }
  function bestOf(hb) {
    const done = new Set(hb.done);
    const d = parseYmd(hb.done.length && hb.done[0] < hb.created ? hb.done[0] : hb.created);
    const end = new Date();
    let run = 0;
    let best = 0;
    for (let i = 0; i < 800 && d <= end; i++, d.setDate(d.getDate() + 1)) {
      if (!isDue(hb, d)) continue;
      if (done.has(ymd(d))) best = Math.max(best, ++run);
      else if (ymd(d) !== today()) run = 0;
    }
    return best;
  }
  const dueToday = () => habits.filter((hb) => isDue(hb, new Date()));
  function habitsLine() {
    const due = dueToday();
    if (!habits.length) return "Small things, every day";
    const n = due.filter((hb) => hb.done.includes(today())).length;
    return due.length ? n + " of " + due.length + " done today" : "Nothing due today";
  }
  function toggleDay(hb, key) {
    hb.done = hb.done.includes(key) ? hb.done.filter((k) => k !== key) : hb.done.concat(key).sort();
    return saveHabits().then(renderTasks);
  }
  const habitLimit = () => (window.AtlasAccount && AtlasAccount.isPro() ? MAX_HABITS : (typeof PRO_CONFIG !== "undefined" ? PRO_CONFIG.freeHabits : 3));

  /* the last HEAT_WEEKS weeks, one column a week, Sunday at the top */
  function heatmap(hb) {
    const done = new Set(hb.done);
    const grid = h("div", { class: "hb-heat", role: "group", "aria-label": hb.name + ", the last " + HEAT_WEEKS + " weeks" });
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - (HEAT_WEEKS - 1) * 7);
    const created = parseYmd(hb.created);
    for (let i = 0; i < HEAT_WEEKS * 7; i++, d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      const future = d > now;
      const on = done.has(key);
      const due = isDue(hb, d) && d >= created;
      grid.append(h("button", {
        type: "button", class: "hb-cell" + (on ? " is-on" : due ? " is-due" : "") + (future ? " is-future" : "") + (key === today() ? " is-today" : ""),
        title: d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + (on ? " — done" : due && !future && key !== today() ? " — missed" : ""),
        disabled: future,
        "aria-pressed": String(on),
        onclick: () => toggleDay(hb, key),
      }));
    }
    return grid;
  }

  /* shown where a free account reaches a Pro limit */
  function upgradeNote(text) {
    const A = window.AtlasAccount;
    return h("div", { class: "qt-pro" },
      h("span", { class: "qt-pro-tag", text: "PRO" }),
      h("p", { text }),
      h("button", {
        type: "button", class: "qt-btn is-primary", text: A && A.signedIn() ? "Upgrade — $5/month" : "Sign in to upgrade",
        onclick: () => (A && A.signedIn() ? A.upgrade("month").catch((e) => alert(e.message)) : AS.open("account")),
      }));
  }

  function renderHabits(body) {
    const due = dueToday();
    if (due.length) {
      const n = due.filter((hb) => hb.done.includes(today())).length;
      const [bar, pct] = progress(n, due.length);
      body.append(h("div", { class: "qt-overall" },
        h("div", { class: "qt-overall-top" }, h("span", { text: "Today" }), h("span", { class: "qt-pct", text: pct + "%" })), bar));
    }

    habits.forEach((hb) => {
      const doneToday = hb.done.includes(today());
      const dueNow = isDue(hb, new Date());
      const st = streakOf(hb);
      const name = h("input", {
        class: "qt-goal-title", type: "text", value: hb.name, maxlength: "60", "aria-label": "Habit name",
        onchange: (e) => { hb.name = e.target.value.trim() || hb.name; saveHabits(); },
      });
      const check = h("button", {
        type: "button", class: "hb-check" + (doneToday ? " is-done" : ""), "aria-pressed": String(doneToday),
        title: doneToday ? "Done today — click to undo" : "Mark done today", "aria-label": "Done today: " + hb.name, html: svg(I.check, 15),
        onclick: () => toggleDay(hb, today()),
      });
      const card = h("section", { class: "qt-goal hb" + (doneToday ? " is-complete" : "") },
        h("div", { class: "qt-goal-head" }, check, name,
          h("button", {
            type: "button", class: "qt-icon", title: "Which days", "aria-label": "Which days " + hb.name + " is due", html: svg(I.zen, 13),
            onclick: () => card.classList.toggle("is-editing"),
          }),
          h("button", {
            type: "button", class: "qt-icon", title: "Delete habit", "aria-label": "Delete habit " + hb.name, html: svg(I.trash, 14),
            onclick: () => {
              if (hb.done.length && !confirm("Delete “" + hb.name + "” and its history?")) return;
              habits = habits.filter((x) => x !== hb);
              saveHabits().then(renderTasks);
            },
          })),
        h("div", { class: "hb-meta" },
          h("span", { class: "hb-streak" + (st ? " is-hot" : ""), text: st ? st + "-day streak" : dueNow && !doneToday ? "Start a streak today" : "No streak yet" }),
          h("span", { text: "best " + bestOf(hb) }),
          h("span", { text: hb.done.length + " total" }),
          hb.days.length < 7 ? h("span", { text: hb.days.map((n) => DAY_SHORT[n]).join(" ") }) : null),
        h("div", { class: "hb-days" }, dayPicker(hb.days, (days) => {
          if (!days.length) return;
          hb.days = days;
          saveHabits().then(renderTasks);
        })),
        heatmap(hb));
      body.append(card);
    });

    if (habits.length >= habitLimit()) {
      body.append(habits.length >= MAX_HABITS
        ? h("p", { class: "qt-empty", text: "That's the most habits Atlas keeps (" + MAX_HABITS + ")." })
        : upgradeNote("Free accounts track " + habitLimit() + " habits. Atlas Pro tracks as many as you like, and syncs them to every computer."));
      return;
    }
    const input = h("input", { class: "qt-input", type: "text", placeholder: habits.length ? "New habit…" : "Your first habit, e.g. Read 20 pages", maxlength: "60", "aria-label": "New habit" });
    body.append(h("form", {
      class: "qt-add qt-add-goal",
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return input.focus();
        habits.push({ id: uid("h"), name: v, days: [0, 1, 2, 3, 4, 5, 6], created: today(), done: [] });
        saveHabits().then(() => { renderTasks(); const f = T.body.querySelector(".qt-add-goal .qt-input"); if (f) f.focus(); });
      },
    }, input, h("button", { type: "submit", class: "qt-btn is-primary", text: "Add habit" })));
    if (!habits.length) body.append(h("p", { class: "qt-empty", text: "Tick a habit off each day to build a streak. The squares under each one are the last " + HEAT_WEEKS + " weeks — click one to fill in a day you forgot." }));
  }

  /* ================= OPTIMIZE ========================================== */
  const selfUrl = hasChrome && chrome.runtime ? chrome.runtime.getURL("") : "";
  const isWeb = (t) => /^https?:/.test(t.url || "");
  /* two tabs are the same page when all but the #fragment matches */
  const pageKey = (u) => { try { const x = new URL(u); x.hash = ""; return x.href; } catch { return u; } };
  let lastClosed = [];
  read(CLOSED_KEY, []).then((v) => { if (Array.isArray(v)) lastClosed = v; });

  const allTabs = () => (hasTabs ? chrome.tabs.query({}) : Promise.resolve([]));

  /* duplicates to close: in each group, keep the active one, else a pinned
     one, else the most recently used */
  function duplicates(tabs) {
    const groups = new Map();
    tabs.filter(isWeb).forEach((t) => {
      const k = pageKey(t.url);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    });
    const out = [];
    groups.forEach((list) => {
      if (list.length < 2) return;
      list.sort((a, b) => (b.active - a.active) || (b.pinned - a.pinned) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
      out.push(...list.slice(1).filter((t) => !t.pinned));
    });
    return out;
  }

  async function closeTabs(tabs, label) {
    if (!tabs.length) return 0;
    lastClosed = tabs.map((t) => ({ url: t.url, pinned: !!t.pinned, windowId: t.windowId, index: t.index, title: t.title || t.url }));
    await write(CLOSED_KEY, lastClosed);
    await chrome.tabs.remove(tabs.map((t) => t.id));
    flash(label.replace("{n}", tabs.length));
    return tabs.length;
  }
  async function undoClose() {
    const list = lastClosed;
    lastClosed = [];
    await write(CLOSED_KEY, []);
    const wins = new Set((await chrome.windows.getAll().catch(() => [])).map((w) => w.id));
    for (const t of list.sort((a, b) => a.index - b.index)) {
      await chrome.tabs.create(Object.assign({ url: t.url, pinned: t.pinned, active: false },
        wins.has(t.windowId) ? { windowId: t.windowId, index: t.index } : {})).catch(() => {});
    }
    flash("Reopened " + list.length + " tab" + (list.length === 1 ? "" : "s"));
  }
  /* asleep = discarded: stays in the strip, frees its memory */
  const canSleep = (t) => isWeb(t) && !t.active && !t.discarded && !t.audible;
  async function sleepTabs(tabs) {
    let n = 0;
    for (const t of tabs.filter(canSleep)) { if (await chrome.tabs.discard(t.id).catch(() => null)) n++; }
    flash(n ? "Put " + n + " tab" + (n === 1 ? "" : "s") + " to sleep" : "Nothing to put to sleep");
  }
  async function wakeTabs(tabs) {
    const asleep = tabs.filter((t) => t.discarded);
    for (const t of asleep) await chrome.tabs.reload(t.id).catch(() => {});
    flash(asleep.length ? "Woke " + asleep.length + " tab" + (asleep.length === 1 ? "" : "s") : "No sleeping tabs");
  }

  /* the last result ("Closed 3 tabs") outlives the redraw the change causes */
  let flashEl = null;
  let flashText = "";
  let flashUntil = 0;
  function paintFlash() {
    if (!flashEl) return;
    const on = Date.now() < flashUntil;
    flashEl.textContent = on ? flashText : "";
    flashEl.hidden = !on;
  }
  function flash(text) {
    flashText = text;
    flashUntil = Date.now() + 4000;
    paintFlash();
    clearTimeout(flash.t);
    flash.t = setTimeout(paintFlash, 4050);
  }

  let optRaf = 0;
  const refreshOpt = () => {
    if (O.panel.hidden) return;
    cancelAnimationFrame(optRaf);
    optRaf = requestAnimationFrame(renderOptimize);
  };
  if (hasTabs) ["onCreated", "onRemoved", "onUpdated", "onReplaced"].forEach((ev) => chrome.tabs[ev] && chrome.tabs[ev].addListener(refreshOpt));

  async function renderOptimize() {
    const body = O.body;
    if (!hasTabs) { body.textContent = ""; body.append(h("p", { class: "qt-empty", text: "Tab tools work inside Chrome." })); return; }
    const tabs = await allTabs();
    if (O.panel.hidden) return; // another tool opened meanwhile
    const dups = duplicates(tabs);
    const asleep = tabs.filter((t) => t.discarded);
    const web = tabs.filter(isWeb);
    O.sub.textContent = tabs.length + " tabs · " + dups.length + " duplicate" + (dups.length === 1 ? "" : "s") + " · " + asleep.length + " asleep";

    const keep = body.scrollTop;
    body.textContent = "";
    flashEl = h("p", { class: "qt-flash", role: "status", hidden: true });
    paintFlash();

    const action = (icon, label, sub, onclick, disabled) => h("button", { type: "button", class: "qt-action", disabled, onclick },
      h("span", { class: "qt-action-icon", html: svg(icon, 16) }),
      h("span", { class: "qt-action-text" }, h("span", { text: label }), h("small", { text: sub })));

    body.append(h("div", { class: "qt-actions" },
      action(I.copy, "Close duplicates", dups.length ? dups.length + " to close" : "None open", () => closeTabs(dups, "Closed {n} duplicate tab(s)"), !dups.length),
      action(I.moon, "Sleep tabs", "Free memory from inactive tabs", () => sleepTabs(tabs), !tabs.some(canSleep)),
      action(I.sun, "Undo sleep", asleep.length ? "Wake " + asleep.length + " tab(s)" : "No sleeping tabs", () => wakeTabs(tabs), !asleep.length),
      action(I.undo, "Undo close", lastClosed.length ? "Reopen " + lastClosed.length + " tab(s)" : "Nothing closed yet", () => undoClose().then(renderOptimize), !lastClosed.length)),
    flashEl);

    /* auto optimize (background.js) */
    const o = AS.get().optimize;
    const sw = (path, label) => {
      const input = h("input", { type: "checkbox", class: "cz-switch", role: "switch", "aria-label": label });
      input.checked = !!path.split(".").reduce((x, k) => x[k], AS.get());
      input.addEventListener("change", () => { AS.set(path, input.checked); renderOptimize(); });
      return h("label", { class: "qt-row" }, h("span", { text: label }), input);
    };
    const sleepSel = h("select", { class: "qt-select", "aria-label": "Sleep tabs unused for" },
      [[15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [240, "4 hours"]].map(([v, t]) => h("option", { value: v, text: t })));
    sleepSel.value = String(o.sleepAfter);
    sleepSel.addEventListener("change", () => AS.set("optimize.sleepAfter", Number(sleepSel.value)));
    body.append(h("section", { class: "qt-auto" + (o.auto ? " is-on" : "") },
      sw("optimize.auto", "Auto optimize"),
      o.auto ? h("div", { class: "qt-auto-body" },
        sw("optimize.sleep", "Sleep unused tabs"),
        o.sleep ? h("label", { class: "qt-row" }, h("span", { text: "…after" }), sleepSel) : null,
        sw("optimize.dedupe", "Close duplicates as they open"),
        h("p", { class: "qt-empty", text: "Pinned tabs, playing tabs and the tab you're on are never touched." })) : null));

    /* the open tabs, this window first */
    const win = (await chrome.windows.getCurrent().catch(() => null)) || {};
    if (O.panel.hidden) return;
    const list = h("div", { class: "qt-tablist" });
    const dupIds = new Set(dups.map((t) => t.id));
    web.sort((a, b) => ((b.windowId === win.id) - (a.windowId === win.id)) || a.windowId - b.windowId || a.index - b.index)
      .forEach((t) => {
        let host = "";
        try { host = new URL(t.url).hostname.replace(/^www\./, ""); } catch {}
        const icon = t.favIconUrl && /^https?:|^data:/.test(t.favIconUrl) ? h("img", { class: "qt-fav", src: t.favIconUrl, alt: "" }) : h("span", { class: "qt-fav", text: (host[0] || "•").toUpperCase() });
        list.append(h("div", { class: "qt-tabrow" + (t.discarded ? " is-asleep" : "") },
          icon,
          h("button", {
            type: "button", class: "qt-tabname", title: t.title || t.url,
            onclick: () => { chrome.tabs.update(t.id, { active: true }); chrome.windows.update(t.windowId, { focused: true }); },
          }, h("span", { text: t.title || host }), h("small", { text: host + (t.discarded ? " · asleep" : "") + (dupIds.has(t.id) ? " · duplicate" : "") + (t.pinned ? " · pinned" : "") })),
          canSleep(t) ? h("button", {
            type: "button", class: "qt-icon", title: "Sleep", "aria-label": "Put " + (t.title || host) + " to sleep", html: svg(I.moon, 13),
            onclick: () => sleepTabs([t]),
          }) : t.discarded ? h("button", {
            type: "button", class: "qt-icon", title: "Wake", "aria-label": "Wake " + (t.title || host), html: svg(I.sun, 13),
            onclick: () => wakeTabs([t]),
          }) : null,
          h("button", {
            type: "button", class: "qt-icon is-del", title: "Close tab", "aria-label": "Close " + (t.title || host), html: svg(I.close, 13),
            onclick: () => closeTabs([t], "Closed {n} tab"),
          })));
      });
    body.append(h("h4", { class: "qt-h", text: "Open tabs (" + web.length + ")" }), list);
    if (selfUrl && tabs.length > web.length) body.append(h("p", { class: "qt-empty", text: "New tabs and Chrome's own pages aren't listed." }));
    body.scrollTop = keep;
  }


  /* ================= TAB MANAGER ========================================
     This window's open tabs, and saved sessions: a name plus its tabs,
     opened again later in a new window or this one. "qt:sessions" =
     { sessions: [{ id, name, at, tabs: [{ url, title, icon }] }] }. Free
     accounts keep up to PRO_CONFIG.freeSessions; Pro, up to MAX_SESSIONS. */
  const SESSIONS_KEY = "qt:sessions";
  const MAX_SESSIONS = 50;
  const MAX_SESSION_TABS = 100;
  let sessions = [];
  let sessionLayout = "list"; // list | grid
  const sessionLimit = () => (window.AtlasAccount && AtlasAccount.isPro()
    ? MAX_SESSIONS
    : (typeof PRO_CONFIG !== "undefined" && PRO_CONFIG.freeSessions) || 3);

  function normalizeSessions(d) {
    const list = Array.isArray(d && d.sessions) ? d.sessions : [];
    return list.filter((x) => x && x.id && Array.isArray(x.tabs)).slice(0, MAX_SESSIONS).map((x) => ({
      id: String(x.id),
      name: String(x.name || "").slice(0, 60) || "Session",
      at: Number(x.at) || Date.now(),
      tabs: x.tabs.filter((t) => t && /^https?:\/\//i.test(t.url)).slice(0, MAX_SESSION_TABS).map((t) => ({
        url: String(t.url),
        title: String(t.title || "").slice(0, 200),
        icon: /^https:\/\//i.test(t.icon || "") ? String(t.icon) : "",
      })),
    }));
  }
  const sessionsReady = read(SESSIONS_KEY, null).then((d) => { sessions = normalizeSessions(d); });
  const saveSessions = () => write(SESSIONS_KEY, { sessions });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[SESSIONS_KEY]) return;
    sessions = normalizeSessions(ch[SESSIONS_KEY].newValue);
    if (!P.panel.hidden && view === "tabmanager" && !P.panel.contains(document.activeElement)) show("tabmanager");
  });

  const hostName = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const favEl = (src, url) => (src && /^https?:|^data:/.test(src)
    ? h("img", { class: "qt-fav", src, alt: "", onerror: (e) => e.target.replaceWith(h("span", { class: "qt-fav", text: (hostName(url)[0] || "•").toUpperCase() })) })
    : h("span", { class: "qt-fav", text: (hostName(url)[0] || "•").toUpperCase() }));
  const whenShort = (at) => new Date(at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

  /* the async views check this after each wait: a newer render (a save
     here, a change from another tab) takes over, rather than both drawing */
  let renderSeq = 0;

  async function renderTabManager() {
    const body = P.body;
    const my = ++renderSeq;
    if (!hasTabs) { body.append(h("p", { class: "qt-empty", text: "The tab manager works inside Chrome." })); return; }
    await sessionsReady;
    const open = (await chrome.tabs.query({ currentWindow: true }).catch(() => [])).filter(isWeb);
    if (P.panel.hidden || view !== "tabmanager" || my !== renderSeq) return; // another render took over
    const limit = sessionLimit();
    P.sub.textContent = open.length + " open tab" + (open.length === 1 ? "" : "s") + " · " + sessions.length + " saved";

    /* save this window */
    const name = h("input", { class: "qt-input", type: "text", maxlength: "60", placeholder: "Name this workspace…", "aria-label": "Session name" });
    const msg = h("p", { class: "qt-note-err", hidden: true });
    const full = sessions.length >= limit;
    const saveForm = h("form", {
      class: "qt-add-row",
      onsubmit: async (e) => {
        e.preventDefault();
        if (!open.length) { msg.textContent = "No web pages are open in this window."; msg.hidden = false; return; }
        if (sessions.length >= sessionLimit()) return;
        sessions.unshift({
          id: uid("s"),
          name: name.value.trim().slice(0, 60) || "Tabs · " + new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
          at: Date.now(),
          tabs: open.slice(0, MAX_SESSION_TABS).map((t) => ({ url: t.url, title: t.title || "", icon: /^https:\/\//i.test(t.favIconUrl || "") ? t.favIconUrl : "" })),
        });
        await saveSessions();
        show("tabmanager");
      },
    }, name, h("button", { type: "submit", class: "qt-btn is-primary", text: "Save", disabled: full || !open.length }));

    const list = h("div", { class: "qt-tablist qt-tm-open" }, open.map((t) => h("div", { class: "qt-tabrow" },
      favEl(t.favIconUrl, t.url),
      h("button", {
        type: "button", class: "qt-tabname", title: t.title || t.url,
        onclick: () => { chrome.tabs.update(t.id, { active: true }); },
      }, h("span", { text: t.title || hostName(t.url) }), h("small", { text: hostName(t.url) + (t.pinned ? " · pinned" : "") })),
      h("button", {
        type: "button", class: "qt-icon is-del", title: "Close tab", "aria-label": "Close " + (t.title || hostName(t.url)), html: svg(I.close, 13),
        onclick: () => chrome.tabs.remove(t.id).then(() => show("tabmanager")),
      }))));

    body.append(section(open.length + " open tab" + (open.length === 1 ? "" : "s"),
      saveForm, msg,
      full ? upgradeNote("Free accounts keep " + limit + " saved sessions. Pro saves as many as you like.") : null,
      open.length ? list : h("p", { class: "qt-empty", text: "No web pages are open in this window." })));

    /* the saved ones */
    const layoutBtn = (v, icon, label) => h("button", {
      type: "button", class: "qt-icon" + (sessionLayout === v ? " is-on" : ""), title: label, "aria-label": label, "aria-pressed": String(sessionLayout === v), html: svg(icon, 13),
      onclick: () => { sessionLayout = v; show("tabmanager"); },
    });
    const head = h("div", { class: "qt-tm-head" },
      h("h4", { class: "qt-h", text: "Saved sessions (" + sessions.length + "/" + (limit >= MAX_SESSIONS ? "∞" : limit) + ")" }),
      h("span", { class: "qt-tm-layout" }, layoutBtn("list", I.list, "List"), layoutBtn("grid", I.grid, "Grid")));

    const restore = async (s, here) => {
      const urls = s.tabs.map((t) => t.url);
      if (!urls.length) return;
      if (here) for (const url of urls) await chrome.tabs.create({ url, active: false });
      else await chrome.windows.create({ url: urls, focused: true });
    };
    const del = async (s) => {
      if (!confirm('Delete the session "' + s.name + '"?')) return;
      sessions = sessions.filter((x) => x !== s);
      await saveSessions();
      show("tabmanager");
    };
    const actions = (s) => h("span", { class: "qt-tm-acts" },
      h("button", { type: "button", class: "qt-btn is-primary", text: "Open", title: "Open in a new window", onclick: () => restore(s, false) }),
      h("button", { type: "button", class: "qt-btn", text: "Add here", title: "Open in this window", onclick: () => restore(s, true) }),
      h("button", { type: "button", class: "qt-icon is-del", title: "Delete", "aria-label": "Delete " + s.name, html: svg(I.trash, 13), onclick: () => del(s) }));
    const favStack = (s) => h("span", { class: "qt-tm-favs" }, s.tabs.slice(0, 5).map((t) => favEl(t.icon, t.url)),
      s.tabs.length > 5 ? h("span", { class: "qt-tm-more", text: "+" + (s.tabs.length - 5) }) : null);
    const meta = (s) => s.tabs.length + " tab" + (s.tabs.length === 1 ? "" : "s") + " · " + whenShort(s.at);

    const saved = !sessions.length
      ? h("p", { class: "qt-empty", text: "No saved sessions yet. Name this window's tabs above and press Save." })
      : sessionLayout === "grid"
        ? h("div", { class: "qt-tm-grid" }, sessions.map((s) => h("div", { class: "qt-tm-card" },
          h("strong", { text: s.name, title: s.name }), h("small", { text: meta(s) }), favStack(s), actions(s))))
        : h("div", { class: "qt-tm-list" }, sessions.map((s) => h("div", { class: "qt-tm-row" },
          h("div", { class: "qt-tm-top" }, h("strong", { text: s.name, title: s.name }), h("small", { text: meta(s) })),
          h("div", { class: "qt-tm-bottom" }, favStack(s), actions(s)))));
    body.append(h("section", { class: "qt-section" }, head, saved));
  }

  /* ================= EXTENSIONS =========================================
     The other installed extensions, switched on and off from here. Chrome's
     "management" permission is optional: asked for the first time this
     view is used, so installing Atlas never needs it. */
  let extQuery = "";
  let extFilter = "all"; // all | on | off
  const canManage = () => new Promise((r) => (chrome.permissions ? chrome.permissions.contains({ permissions: ["management"] }, r) : r(false)));

  async function renderExtensions() {
    const body = P.body;
    const my = ++renderSeq;
    if (!hasChrome || !chrome.permissions) { body.append(h("p", { class: "qt-empty", text: "Extension tools work inside Chrome." })); return; }
    if (!(await canManage()) || !chrome.management) {
      if (P.panel.hidden || view !== "extensions" || my !== renderSeq) return;
      P.sub.textContent = "Needs your permission";
      body.append(section("Manage extensions",
        h("p", { class: "qt-empty", text: "Turn your other extensions on and off from here. Chrome asks once to let Atlas see and switch them — nothing leaves this computer." }),
        h("button", {
          type: "button", class: "qt-btn is-primary", text: "Allow",
          /* straight from the click: Chrome only asks inside a user gesture */
          onclick: () => chrome.permissions.request({ permissions: ["management"] }, (ok) => { if (ok) show("extensions"); }),
        })));
      return;
    }
    const all = (await chrome.management.getAll().catch(() => []))
      .filter((x) => x.id !== chrome.runtime.id && (x.type === "extension" || x.type === "theme"))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (P.panel.hidden || view !== "extensions" || my !== renderSeq) return;
    const onN = all.filter((x) => x.enabled).length;
    P.sub.textContent = all.length + " installed · " + onN + " on";

    const search = h("input", { class: "qt-input", type: "search", value: extQuery, placeholder: "Search extensions…", "aria-label": "Search extensions" });
    const chips = h("div", { class: "qt-chips", role: "radiogroup", "aria-label": "Show" });
    const list = h("div", { class: "qt-tablist qt-ext-list" });
    const paintChips = () => {
      chips.textContent = "";
      [["all", "All", all.length], ["on", "Active", onN], ["off", "Off", all.length - onN]].forEach(([v, t, n]) => chips.append(h("button", {
        type: "button", role: "radio", class: "qt-chip" + (extFilter === v ? " is-on" : ""), "aria-checked": String(extFilter === v), text: t + " · " + n,
        onclick: () => { extFilter = v; paintChips(); paintList(); },
      })));
    };
    const iconOf = (x) => {
      const best = (x.icons || []).slice().sort((a, b) => b.size - a.size)[0];
      const letter = () => h("span", { class: "qt-fav qt-ext-icon", text: (x.name[0] || "•").toUpperCase() });
      return best ? h("img", { class: "qt-fav qt-ext-icon", src: best.url, alt: "", onerror: (e) => e.target.replaceWith(letter()) }) : letter();
    };
    function paintList() {
      const q = extQuery.trim().toLowerCase();
      const shown = all.filter((x) => (extFilter === "all" || (extFilter === "on") === x.enabled) &&
        (!q || x.name.toLowerCase().includes(q) || (x.description || "").toLowerCase().includes(q)));
      list.textContent = "";
      if (!shown.length) list.append(h("p", { class: "qt-empty", text: all.length ? "Nothing matches." : "No other extensions installed." }));
      shown.forEach((x) => {
        const sw = h("input", {
          type: "checkbox", class: "cz-switch", role: "switch", "aria-label": (x.enabled ? "Turn off " : "Turn on ") + x.name,
          disabled: !x.mayDisable, title: x.mayDisable ? "" : "Installed by your organisation",
        });
        sw.checked = x.enabled;
        sw.addEventListener("change", () => {
          const want = sw.checked;
          chrome.management.setEnabled(x.id, want).then(() => {
            x.enabled = want;
            row.classList.toggle("is-off", !want);
            sw.setAttribute("aria-label", (want ? "Turn off " : "Turn on ") + x.name);
            P.sub.textContent = all.length + " installed · " + all.filter((e) => e.enabled).length + " on";
            paintChips();
            if (extFilter !== "all") paintList();
          }, () => { sw.checked = !want; });
        });
        const row = h("div", { class: "qt-tabrow qt-ext-row" + (x.enabled ? "" : " is-off") },
          iconOf(x),
          h("button", {
            type: "button", class: "qt-tabname", title: "Details in Chrome",
            onclick: () => chrome.tabs.create({ url: "chrome://extensions/?id=" + x.id }),
          }, h("span", { text: x.name }), h("small", { text: (x.type === "theme" ? "Theme" : "v" + x.version) + (x.enabled ? "" : " · off") })),
          sw);
        list.append(row);
      });
    }
    search.addEventListener("input", () => { extQuery = search.value; paintList(); });
    paintChips();
    paintList();
    body.append(h("div", { class: "qt-section" }, search, chips), list,
      h("button", { type: "button", class: "qt-chip qt-ext-all", text: "Open Chrome's extensions page", onclick: () => chrome.tabs.create({ url: "chrome://extensions/" }) }));
  }

  /* ================= ABOUT: the footer, FAQs and changelog ============== */
  const ABOUT = typeof ABOUT_CONFIG !== "undefined" ? ABOUT_CONFIG : {};
  const manifest = hasChrome && chrome.runtime.getManifest ? chrome.runtime.getManifest() : { name: "Atlas New Tab", version: "" };
  const storeUrl = () => ABOUT.storeUrl ||
    (hasChrome && chrome.runtime.id ? "https://chromewebstore.google.com/detail/" + chrome.runtime.id : "https://chromewebstore.google.com/");
  const privacyUrl = () => {
    if (ABOUT.privacyUrl) return ABOUT.privacyUrl;
    const api = typeof ACCOUNT_CONFIG !== "undefined" && ACCOUNT_CONFIG.api ? String(ACCOUNT_CONFIG.api).replace(/\/+$/, "") : "";
    return api ? api + "/privacy.html" : "";
  };
  const openUrl = (url) => (hasTabs ? chrome.tabs.create({ url }) : window.open(url, "_blank", "noopener"));

  function footer() {
    const status = h("p", { class: "qt-foot-status", role: "status" });
    const say = (text) => { status.textContent = text; setTimeout(() => { if (status.textContent === text) status.textContent = ""; }, 2500); };
    const big = (icon, label, onclick) => h("button", { type: "button", class: "qt-foot-btn", onclick }, h("span", { html: svg(icon, 14) }), h("span", { text: label }));
    const link = (label, onclick) => h("button", { type: "button", class: "qt-foot-link", text: label, onclick });
    const name = (manifest.name || "Atlas New Tab").replace(/\s+-\s+.*$/, "");
    return h("footer", { class: "qt-foot" },
      h("div", { class: "qt-foot-btns" },
        big(I.chat, "Feedback", () => {
          const email = ABOUT.feedbackEmail || "";
          const subject = encodeURIComponent(name + " feedback (v" + manifest.version + ")");
          if (email) window.location.href = "mailto:" + email + "?subject=" + subject;
        }),
        big(I.heart, "Rate us", () => openUrl(storeUrl() + (ABOUT.storeUrl ? "" : "/reviews"))),
        big(I.share, "Share", async () => {
          const data = { title: name, text: "A calm new tab with live wallpapers, focus tools and more.", url: storeUrl() };
          try {
            if (navigator.share) { await navigator.share(data); return; }
          } catch (e) { if (e && e.name === "AbortError") return; }
          try { await navigator.clipboard.writeText(data.url); say("Link copied — paste it anywhere."); } catch { say(data.url); }
        })),
      h("div", { class: "qt-foot-card" },
        h("nav", { class: "qt-foot-links", "aria-label": "About" },
          link("FAQs", () => show("faq")),
          link("Changelog", () => show("changelog")),
          privacyUrl() ? link("Privacy Policy", () => openUrl(privacyUrl())) : null,
          AS.exportSettings ? link("Export Backup", () => { AS.exportSettings(); say("Backup saved to your downloads."); }) : null),
        h("p", { class: "qt-foot-ver", text: name + " v" + manifest.version })),
      status);
  }

  const FAQS = [
    ["How do I change the wallpaper?", "Click the wallpaper button, or right-click the page → Customize → Background. The Schedule there changes it by itself at set times."],
    ["Where are my notes kept?", "On this computer. Sign in (Customize → Account) and they're kept in step across your computers too. Private notes live in the private folder, encrypted."],
    ["I forgot my private folder password.", "It can't be recovered — the contents are encrypted with it. Customize → Privacy lets you delete the folder and start again."],
    ["Why doesn't the site blocker block a site?", "Check that “Block these sites” is on, and, with “Only at certain times”, that it's inside those times. A running break lifts it for 5 minutes."],
    ["The assistant won't hear me.", "Allow the microphone for Atlas when Chrome asks. If it was blocked, the assistant offers an “Allow microphone” button."],
    ["How do I back up everything?", "Export Backup (below) saves your settings to a file; Customize → Backup imports it again."],
    ["What does Pro add?", "More habits and saved sessions, 30 days of stats with a weekly email, and the 4K wallpaper library."],
  ].filter(([q]) => !(window.AtlasAccount && AtlasAccount.allFree && /Pro/.test(q))); // no plans to explain while all is free
  function renderFaq() {
    P.sub.textContent = "Quick answers";
    P.body.append(h("div", { class: "qt-faq" }, FAQS.map(([q, a]) => h("details", { class: "qt-faq-item" }, h("summary", { text: q }), h("p", { text: a })))),
      h("p", { class: "qt-empty", text: "Still stuck? Send us feedback from the Quick tools home." }));
  }

  /* newest first: [version, date, changes] */
  const CHANGELOG = [
    [manifest.version, "Sep 2026", [
      "Tab manager: save a window's tabs as a named session and open it again",
      "Extensions: turn your other extensions on and off",
      "A private folder, like a phone's hidden one, with its own shortcuts and notes",
      "Notes in Customize, and your own quotes straight from the new tab",
      "Smoother panel transitions; the wallpaper schedule switches on the minute",
    ]],
    ["1.0.0", "Aug 2026", [
      "Live wallpapers, shortcut workspaces, search and the assistant",
      "Focus timer, reminders, habits, stats and the site blocker",
    ]],
  ];
  function renderChangelog() {
    P.sub.textContent = "What's new";
    P.body.append(h("div", { class: "qt-log" }, CHANGELOG.map(([v, date, items]) => h("section", { class: "qt-log-ver" },
      h("div", { class: "qt-log-head" }, h("strong", { text: "v" + v }), h("small", { text: date })),
      h("ul", {}, items.map((t) => h("li", { text: t })))))));
  }

  /* ================= SITE BLOCKER ====================================== */
  const BLOCK_PACKS = [
    ["Social", ["facebook.com", "instagram.com", "x.com", "twitter.com", "tiktok.com", "reddit.com", "snapchat.com"]],
    ["Video", ["youtube.com", "netflix.com", "twitch.tv", "primevideo.com"]],
    ["News", ["cnn.com", "bbc.com", "news.google.com", "nytimes.com"]],
    ["Shopping", ["amazon.com", "daraz.pk", "aliexpress.com", "ebay.com"]],
  ];
  const clean = AS.clean || {};

  function renderBlocker() {
    const b = AS.get().blocker;
    const setSites = (list) => {
      const grew = list.length > b.sites.length;
      AS.set("blocker.sites", clean.sites ? clean.sites(list) : list);
      /* adding a site means "block it": switch the blocker on if it was off */
      if (grew && !AS.get().blocker.on) AS.set("blocker.on", true);
      show("blocker");
    };
    P.sub.textContent = b.on ? (b.schedule ? "On at set times" : "Blocking now") + " · " + b.sites.length + " site" + (b.sites.length === 1 ? "" : "s") : "Off";

    const msg = h("p", { class: "qt-note-err", hidden: true });
    const input = h("input", { class: "qt-input", type: "text", placeholder: "youtube.com", spellcheck: "false", "aria-label": "Site to block" });
    const add = h("form", {
      class: "qt-add-row",
      onsubmit: (e) => {
        e.preventDefault();
        const found = input.value.split(/[\s,]+/).filter(Boolean).map((v) => (clean.site ? clean.site(v) : v)).filter(Boolean);
        if (!found.length) { msg.textContent = "That isn't a web address. Try something like youtube.com"; msg.hidden = false; return; }
        setSites(b.sites.concat(found));
        const again = P.body.querySelector(".qt-add-row .qt-input");
        if (again) again.focus();
      },
    }, input, h("button", { type: "submit", class: "qt-btn is-primary", text: "Block" }));

    const chips = h("div", { class: "qt-chips" }, b.sites.map((d) => h("span", { class: "qt-site", translate: "no" }, d,
      h("button", { type: "button", "aria-label": "Unblock " + d, title: "Unblock", text: "✕", onclick: () => setSites(b.sites.filter((x) => x !== d)) }))));
    const packs = h("div", { class: "qt-chips" }, BLOCK_PACKS.map(([name, list]) => {
      const all = list.every((d) => b.sites.includes(d));
      return h("button", {
        type: "button", class: "qt-chip" + (all ? " is-on" : ""), text: (all ? "✓ " : "+ ") + name, title: list.join(", "),
        onclick: () => setSites(all ? b.sites.filter((d) => !list.includes(d)) : b.sites.concat(list)),
      });
    }));

    const when = b.schedule ? h("div", { class: "qt-sub" },
      dayPicker(b.days, (days) => { AS.set("blocker.days", days); show("blocker"); }),
      h("div", { class: "qt-due-row" },
        h("span", { class: "qt-label", text: "From" }), timeInput(b.from, "From", (v) => AS.set("blocker.from", v)),
        h("span", { class: "qt-label", text: "to" }), timeInput(b.to, "To", (v) => AS.set("blocker.to", v))),
      h("p", { class: "qt-empty", text: "A time like 22:00 to 06:00 runs overnight." })) : null;

    const message = h("input", {
      class: "qt-input", type: "text", value: b.message, maxlength: "200", placeholder: "Stay focused — it'll still be there later.", "aria-label": "Message on the blocked page",
      onchange: (e) => AS.set("blocker.message", e.target.value.trim().slice(0, 200)),
    });

    P.body.append(
      h("section", { class: "qt-auto" + (b.on ? " is-on" : "") }, switchRow("Block these sites", "blocker.on", () => show("blocker")),
        h("p", { class: "qt-empty", text: "Blocked sites open a calm “This site is blocked” page instead, in every tab." })),
      section("Sites", add, msg, b.sites.length ? chips : h("p", { class: "qt-empty", text: "No sites yet. Add one, or a whole group:" }), packs),
      section("When", switchRow("Only at certain times", "blocker.schedule", () => show("blocker")), when),
      section("Blocked page", switchRow("Allow 5-minute breaks", "blocker.breaks"), message));
  }

  /* ================= MINIMAL MODE ====================================== */
  const MIN_KEEP = [
    ["clock", "Clock"], ["weather", "Weather"], ["search", "Search bar"], ["dock", "Shortcuts dock"],
    ["media", "Now playing"], ["wallpaper", "Zen clock button"], ["peek", "Quick Peek"], ["ai", "Quick tools & chat"], ["quote", "Daily quote"],
  ];
  const MIN_PRESETS = [
    ["Work hours", [1, 2, 3, 4, 5], "09:00", "17:00"], ["Evenings", [0, 1, 2, 3, 4, 5, 6], "20:00", "23:59"],
    ["Night", [0, 1, 2, 3, 4, 5, 6], "22:00", "07:00"], ["Weekends", [0, 6], "00:00", "23:59"],
  ];

  function renderMinimal() {
    const m = AS.get().minimal;
    const setRules = (rules) => { AS.set("minimal.rules", clean.minRules ? clean.minRules(rules) : rules); show("minimal"); };
    const on = window.AtlasMinimal && AtlasMinimal.isOn();
    P.sub.textContent = on ? "On right now" : "Off right now";

    const modes = h("div", { class: "qt-tabs", role: "radiogroup", "aria-label": "Minimal mode" },
      [["off", "Off"], ["on", "On"], ["auto", "At set times"]].map(([v, label]) => h("button", {
        type: "button", role: "radio", class: "qt-tab" + (m.mode === v ? " is-on" : ""), "aria-checked": String(m.mode === v), text: label,
        onclick: () => { AS.set("minimal.mode", v); show("minimal"); },
      })));

    const out = [section(null, modes, h("p", { class: "qt-empty", text: "Only what you keep below stays on screen. The M key switches it; during a set time, that lasts until the time ends." }))];

    if (m.mode === "auto") {
      const rules = m.rules.map((r) => h("div", { class: "qt-rule" },
        h("div", { class: "qt-due-row" },
          timeInput(r.from, "From", (v) => setRules(m.rules.map((x) => (x === r ? Object.assign({}, x, { from: v }) : x)))),
          h("span", { class: "qt-label", text: "to" }),
          timeInput(r.to, "To", (v) => setRules(m.rules.map((x) => (x === r ? Object.assign({}, x, { to: v }) : x)))),
          h("button", { type: "button", class: "qt-icon is-del", title: "Remove", "aria-label": "Remove this time", html: svg(I.close, 13), onclick: () => setRules(m.rules.filter((x) => x !== r)) })),
        dayPicker(r.days, (days) => setRules(m.rules.map((x) => (x === r ? Object.assign({}, x, { days }) : x))))));
      out.push(section("When",
        rules.length ? rules : h("p", { class: "qt-empty", text: "No times yet — add one:" }),
        h("div", { class: "qt-chips" },
          h("button", { type: "button", class: "qt-chip", text: "+ Custom time", onclick: () => setRules(m.rules.concat({ id: uid("mr-"), days: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" })) }),
          MIN_PRESETS.map(([name, days, from, to]) => h("button", {
            type: "button", class: "qt-chip", text: "+ " + name, onclick: () => setRules(m.rules.concat({ id: uid("mr-"), days, from, to })),
          })))));
    }

    out.push(section("Keep on screen", MIN_KEEP.map(([k, label]) => switchRow(label, "minimal.keep." + k))));
    const dimVal = h("span", { class: "qt-pct", text: m.dim + "%" });
    const dim = h("input", { type: "range", class: "cz-range", min: "0", max: "70", step: "1", value: m.dim, "aria-label": "Extra dim" });
    dim.addEventListener("input", () => { AS.set("minimal.dim", Number(dim.value)); dimVal.textContent = dim.value + "%"; });
    out.push(section("Look",
      h("label", { class: "qt-row" }, h("span", { text: "Extra dim" }), h("span", { class: "qt-range" }, dim, dimVal)),
      switchRow("“Exit minimal” button", "minimal.exit")));
    P.body.append(...out);
  }

  /* ================= DAILY QUOTE ======================================= */
  function renderQuote() {
    const Q = window.AtlasQuote;
    const w = AS.get().widgets.quote;
    const mine = AS.get().quotes.custom;
    const setMine = (list) => { AS.set("quotes.custom", clean.quotes ? clean.quotes(list) : list); show("quote"); };
    P.sub.textContent = (Q ? Q.poolSize() : 0) + " quotes to pick from";

    const cur = Q && Q.current();
    const preview = h("figure", { class: "qt-quote" },
      h("blockquote", { text: cur ? "“" + cur.text + "”" : "No quotes match — add your own below, or choose another category." }),
      cur && cur.author ? h("figcaption", { text: "— " + cur.author }) : null,
      h("div", { class: "qt-chips" },
        h("button", { type: "button", class: "qt-btn is-primary", html: svg(I.refresh, 13) + " New quote", onclick: () => { Q.next(); show("quote"); } }),
        cur ? h("button", { type: "button", class: "qt-btn", html: svg(I.copy, 13) + " Copy", onclick: (e) => {
          navigator.clipboard.writeText("“" + cur.text + "”" + (cur.author ? " — " + cur.author : ""));
          e.currentTarget.lastChild.textContent = " Copied";
        } }) : null));

    const select = (label, path, options) => {
      const sel = h("select", { class: "qt-select", "aria-label": label }, options.map(([v, t]) => h("option", { value: v, text: t })));
      sel.value = getPath(path);
      sel.addEventListener("change", () => { AS.set(path, sel.value); show("quote"); });
      return h("label", { class: "qt-row" }, h("span", { text: label }), sel);
    };

    const text = h("textarea", { class: "qt-input", rows: "2", maxlength: "400", placeholder: "Your quote…", "aria-label": "Quote" });
    const author = h("input", { class: "qt-input", type: "text", maxlength: "80", placeholder: "Who said it (optional)", "aria-label": "Author" });
    const addForm = h("form", {
      class: "qt-add",
      onsubmit: (e) => {
        e.preventDefault();
        if (!text.value.trim()) return text.focus();
        setMine(mine.concat({ id: uid("q-"), text: text.value.trim(), author: author.value.trim() }));
      },
    }, text, h("div", { class: "qt-add-row" }, author, h("button", { type: "submit", class: "qt-btn is-primary", text: "Add" })));

    const list = mine.map((q) => {
      const t = h("textarea", { class: "qt-note-text", rows: "1", maxlength: "400", "aria-label": "Quote" });
      t.value = q.text;
      const a = h("input", { class: "qt-quote-author", type: "text", value: q.author, maxlength: "80", placeholder: "Author", "aria-label": "Author" });
      const save = () => setMine(mine.map((x) => (x === q ? { id: q.id, text: t.value.trim() || q.text, author: a.value.trim() } : x)));
      t.addEventListener("change", save);
      a.addEventListener("change", save);
      const fit = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
      t.addEventListener("input", fit);
      requestAnimationFrame(fit);
      return h("div", { class: "qt-note" }, t,
        h("div", { class: "qt-note-foot" }, a,
          h("button", { type: "button", class: "qt-icon is-del", title: "Delete", "aria-label": "Delete quote", html: svg(I.trash, 13), onclick: () => setMine(mine.filter((x) => x !== q)) })));
    });

    P.body.append(
      preview,
      section("Show", switchRow("Show on the new tab", "widgets.quote.show"),
        select("Change it", "widgets.quote.every", [["day", "Once a day"], ["tab", "On every new tab"]]),
        select("Quotes from", "widgets.quote.source", [["both", "Built-in + mine"], ["builtin", "Built-in only"], ["mine", "Only mine"]]),
        select("Category", "widgets.quote.cat", Q ? Q.CATS : [["all", "All"]]),
        h("p", { class: "qt-empty", text: "Move or resize it in Customize → Widgets → Daily quote." })),
      section("My quotes (" + mine.length + ")", addForm, list));
  }

  /* the home grid shows live states; redraw it when they change */
  AS.on(() => { if (!P.panel.hidden && view === "home") show("home"); });
  /* the focus timer changed from elsewhere (a phase ended, the pill) */
  if (window.AtlasFocus) AtlasFocus.on(() => {
    if (P.panel.hidden || (view !== "home" && view !== "focus")) return;
    const el = document.activeElement;
    if (view === "focus" && el && P.panel.contains(el) && /^(INPUT|SELECT)$/.test(el.tagName)) return;
    show(view);
  });
  if (window.AtlasMinimal) AtlasMinimal.on(() => { if (!P.panel.hidden && (view === "home" || view === "minimal")) show(view); });

  window.AtlasQuickTools = {
    open: (v) => ready.then(() => open(v)),
    openTasks: () => ready.then(() => open("tasks")),
    openHabits: () => Promise.all([ready, habitsReady]).then(() => { tab = "habits"; open("tasks"); }),
    habits: () => habitsReady.then(() => habits),
    upgradeNote,
    /* the same notes, for Customize > Notes */
    notes: {
      ready,
      list: () => data.notes.slice(),
      add: (text) => {
        const v = String(text || "").trim().slice(0, 4000);
        if (!v) return Promise.resolve(null);
        const n = { id: uid("n"), text: v, at: Date.now() };
        data.notes.unshift(n);
        return save().then(() => n);
      },
      update: (id, text) => {
        const n = data.notes.find((x) => x.id === id);
        const v = String(text || "").slice(0, 4000);
        if (!n || !v.trim() || n.text === v) return Promise.resolve();
        n.text = v;
        n.at = Date.now();
        return save();
      },
      remove: (id) => {
        data.notes = data.notes.filter((x) => x.id !== id);
        return save();
      },
      on: (fn) => notesListeners.push(fn),
    },
    openOptimize: () => open("optimize"),
    closeDuplicates: async () => closeTabs(duplicates(await allTabs()), "Closed {n} duplicate tab(s)"),
    sleepTabs: async () => sleepTabs(await allTabs()),
  };
})();
