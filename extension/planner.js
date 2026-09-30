/* ATLAS NEW TAB — AI day planner (Atlas Pro)
   "Plan my day": today's open tasks (Notes & Goals), calendar events
   (calendar.js), reminders and habits still to do go to the backend
   (POST /ai/plan, one assistant message), and Gemini lays them out as a
   timeline between two times. The plan is kept in "planner:day" for the
   rest of the day.
   On the timeline: the block on now is lit, a focus block can start the
   focus timer, a task block can complete its task, and "Remind me" writes
   a reminder for each block still to come (fromPlan; background.js rings
   them like any other and a new plan replaces them).
   Quick tools > Day planner draws it (quicktools.js calls render()).    */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  const Acc = window.AtlasAccount;
  const S = window.AtlasSchedule;
  if (!AS || !Acc) return;

  const KEY = "planner:day"; // { date, from, to, note, summary, blocks, unplanned, remind, at }
  const TASKS_KEY = "qt:tasks";
  const REM_KEY = "reminders";
  const KIND = { event: "Event", task: "Task", focus: "Focus", break: "Break", habit: "Habit", routine: "Routine" };

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const read = (k, fb) => new Promise((r) => (hasChrome ? chrome.storage.local.get([k], (o) => r(o[k] === undefined ? fb : o[k])) : r(fb)));
  const write = (k, v) => new Promise((r) => (hasChrome ? chrome.storage.local.set({ [k]: v }, r) : r()));

  let plan = null;
  const ready = read(KEY, null).then((p) => { plan = p && Array.isArray(p.blocks) ? p : null; });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[KEY]) return;
    const next = ch[KEY].newValue || null;
    if (JSON.stringify(next) === JSON.stringify(plan)) return; // our own save
    plan = next;
    paintView();
  });

  const isPro = () => Acc.isPro();

  /* ---------- times ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  /* an end time of 00:00 is midnight tonight */
  const endMins = (t) => mins(t) || 24 * 60;
  const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const hhmm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fmt = (t) => (S && S.formatTime ? S.formatTime(t, AS.get().widgets.clock.h24) : t);
  const today = () => (plan && plan.date === todayKey() ? plan : null);

  /* now, rounded up to the next quarter hour */
  function defaultFrom() {
    const m = Math.min(23 * 60 + 30, Math.ceil(nowMins() / 15) * 15);
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }

  /* ---------- what the planner gets ---------- */
  async function gather(from, to, note) {
    const day = todayKey();
    const date = new Date();
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    const data = await read(TASKS_KEY, null);
    const tasks = [];
    (data && Array.isArray(data.goals) ? data.goals : []).forEach((g) => (Array.isArray(g.tasks) ? g.tasks : []).forEach((t) => {
      if (!t || t.done || !t.text || (t.date && t.date > day)) return;
      tasks.push({ id: t.id, text: t.text, goal: g.title || "", due: t.date || "", time: t.time || "" });
    }));
    /* dated (oldest first) before undated, so the cut keeps what's due */
    tasks.sort((a, b) => (!a.due - !b.due) || a.due.localeCompare(b.due));

    const C = window.AtlasCalendar;
    const events = C && C.connected() ? C.day(day).map((e) => ({
      title: e.title,
      allDay: e.allDay,
      start: e.allDay ? "" : hhmm(Math.max(e.start, dayStart)),
      end: e.allDay ? "" : (e.end >= dayEnd ? "23:59" : hhmm(e.end)),
    })) : [];

    const rems = await read(REM_KEY, []);
    const reminders = (Array.isArray(rems) ? rems : []).filter((r) => r && r.enabled && !r.fromTask && !r.fromPlan).map((r) => {
      const at = S ? S.next(r, dayStart - 1) : null;
      return at && at < dayEnd ? { title: r.title || "Reminder", time: hhmm(at) } : null;
    }).filter(Boolean);

    const QT = window.AtlasQuickTools;
    const habits = QT && QT.habits ? (await QT.habits()).filter((hb) => hb.days.includes(date.getDay()) && !hb.done.includes(day)).map((hb) => ({ name: hb.name })) : [];

    const f = AS.get().focus;
    return {
      date: day,
      weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
      from, to, note,
      focus: { work: f.work, short: f.short },
      tasks: tasks.slice(0, 40), events: events.slice(0, 40), reminders: reminders.slice(0, 30), habits: habits.slice(0, 20),
    };
  }

  async function makePlan(from, to, note) {
    const body = await gather(from, to, note);
    const { plan: p } = await Acc.api("/ai/plan", { method: "POST", body });
    const remind = !!(plan && plan.remind);
    plan = { date: body.date, from, to, note, summary: p.summary, blocks: p.blocks, unplanned: p.unplanned || [], remind, at: Date.now() };
    await write(KEY, plan);
    await syncReminders();
    return { plan, counts: { tasks: body.tasks.length, events: body.events.length, reminders: body.reminders.length, habits: body.habits.length } };
  }

  /* a reminder for each block still to come, while plan.remind is on */
  async function syncReminders() {
    const list = await read(REM_KEY, []);
    const keep = (Array.isArray(list) ? list : []).filter((r) => r && !r.fromPlan);
    const p = today();
    if (p && p.remind) {
      const now = nowMins();
      p.blocks.forEach((b, i) => {
        if (mins(b.start) <= now || b.kind === "event") return; // Google Calendar reminds for its own events
        keep.push({
          id: "pl" + i, fromPlan: true, title: (KIND[b.kind] || "Plan") + ": " + b.title, note: "Day planner · until " + fmt(b.end),
          repeat: "once", date: p.date, time: b.start, days: [], sound: "default", enabled: true, updatedAt: Date.now(), lastFired: 0,
        });
      });
    }
    await write(REM_KEY, keep);
  }

  async function setRemind(on) {
    if (!plan) return;
    plan = Object.assign({}, plan, { remind: on });
    await write(KEY, plan);
    await syncReminders();
  }

  async function clear() {
    plan = null;
    await write(KEY, null);
    await syncReminders();
    paintView();
  }

  /* the block on now and the next one */
  function current() {
    const p = today();
    if (!p) return { now: null, next: null };
    const m = nowMins();
    return {
      now: p.blocks.find((b) => mins(b.start) <= m && endMins(b.end) > m) || null,
      next: p.blocks.find((b) => mins(b.start) > m) || null,
    };
  }

  function tile() {
    if (!isPro()) return "Pro · plan your day with AI";
    if (!today()) return "Plan today with AI";
    const { now, next } = current();
    if (now) return "Now · " + now.title;
    if (next) return fmt(next.start) + " · " + next.title;
    return "Day done";
  }

  /* ---------- Quick tools > Day planner ---------- */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };

  let view = null;
  let ticker = 0;
  let lastCounts = null;

  function form(ctx, p) {
    const start = defaultFrom();
    let until = (p && p.to) || (plan && plan.to) || "18:00";
    if (endMins(until) - mins(start) < 30) until = mins(start) + 180 >= 24 * 60 ? "00:00" : pad(Math.floor((mins(start) + 180) / 60)) + ":" + pad((mins(start) + 180) % 60);
    const from = h("input", { class: "qt-input qt-time", type: "time", value: start, "aria-label": "From" });
    const to = h("input", { class: "qt-input qt-time", type: "time", value: until, "aria-label": "Until" });
    const note = h("textarea", {
      class: "qt-input", rows: "2", maxlength: "1000", "aria-label": "Anything else today?",
      placeholder: "Anything else? e.g. gym at 7, call mum, keep the afternoon light",
    });
    note.value = (p && p.note) || "";
    const msg = h("p", { class: "qt-note-err", hidden: true });
    const btn = h("button", { type: "submit", class: "qt-btn is-primary", text: p ? "Plan again" : "Plan my day" });
    return h("form", {
      class: "qt-add qt-plan-form",
      onsubmit: (e) => {
        e.preventDefault();
        msg.hidden = true;
        if (!/^\d{2}:\d{2}$/.test(from.value) || !/^\d{2}:\d{2}$/.test(to.value)) return;
        if (endMins(to.value) - mins(from.value) < 30) {
          msg.textContent = endMins(to.value) <= mins(from.value)
            ? "The plan is for today, so it ends by midnight at the latest. Pick an end time after the start."
            : "Give the plan at least 30 minutes — pick a later end time.";
          msg.hidden = false;
          return;
        }
        btn.disabled = true;
        btn.textContent = "Planning…";
        makePlan(from.value, to.value, note.value.trim())
          .then((r) => { lastCounts = r.counts; paintView(); })
          .catch((err) => {
            msg.textContent = err && err.message ? err.message : String(err);
            msg.hidden = false;
            if (btn.isConnected) { btn.disabled = false; btn.textContent = p ? "Plan again" : "Plan my day"; }
          });
      },
    },
      h("div", { class: "qt-add-row qt-plan-times" }, h("span", { text: "From" }), from, h("span", { text: "until" }), to),
      note,
      h("div", { class: "qt-add-row" }, btn),
      msg);
  }

  function blockRow(b, p) {
    const m = nowMins();
    const on = mins(b.start) <= m && endMins(b.end) > m;
    const past = endMins(b.end) <= m;
    const F = window.AtlasFocus;
    const QT = window.AtlasQuickTools;
    const acts = [];
    if (on && (b.kind === "focus" || b.kind === "task") && F && !F.isRunning()) {
      acts.push(h("button", { type: "button", class: "qt-btn is-primary", text: "Start focus", onclick: () => F.start("focus").then(paintView) }));
    }
    if (b.taskId && QT && QT.completeTask && !past) {
      const done = QT.isTaskDone && QT.isTaskDone(b.taskId);
      acts.push(h("button", {
        type: "button", class: "qt-btn" + (done ? " is-done" : ""), text: done ? "Done ✓" : "Complete", disabled: done,
        onclick: () => QT.completeTask(b.taskId).then(paintView),
      }));
    }
    return h("div", { class: "qt-plan-block is-" + b.kind + (on ? " is-now" : "") + (past ? " is-past" : "") },
      h("span", { class: "qt-plan-time", text: fmt(b.start) }),
      h("span", { class: "qt-plan-main" },
        h("span", { class: "qt-plan-title", text: b.title }),
        h("small", { text: (KIND[b.kind] || "") + " · until " + fmt(b.end) + " · " + (endMins(b.end) - mins(b.start)) + " min" }),
        acts.length ? h("span", { class: "qt-chips" }, acts) : null));
  }

  function render(ctx) {
    view = ctx;
    const { body, sub, section, upgradeNote } = ctx;
    body.textContent = "";
    clearInterval(ticker);

    if (!isPro()) {
      sub.textContent = "Atlas Pro";
      body.append(upgradeNote("Let AI turn your tasks, meetings, reminders and habits into a realistic plan for today — with focus blocks and breaks. Part of Atlas Pro."));
      return;
    }
    if (!Acc.signedIn()) {
      sub.textContent = "Sign in to plan";
      body.append(section(null,
        h("p", { class: "qt-empty", text: "The Day planner uses the Atlas assistant, so it needs your Atlas account." }),
        h("div", { class: "qt-chips" }, h("button", { type: "button", class: "qt-btn is-primary", text: "Sign in", onclick: () => AS.open("account") }))));
      return;
    }

    const p = today();
    if (!p) {
      sub.textContent = "Plan today with AI";
      const C = window.AtlasCalendar;
      body.append(section(null,
        h("p", { class: "qt-empty", text: "Atlas looks at today's open tasks, reminders and habits" + (C && C.connected() ? ", and your Google Calendar," : "") + " and lays them out with focus blocks and breaks." }),
        C && !C.connected() && C.render ? h("p", { class: "qt-empty" }, "Tip: ", h("a", { class: "qt-link", href: "#", text: "connect Google Calendar", onclick: (e) => { e.preventDefault(); ctx.show("calendar"); } }), " so the plan works around your meetings.") : null),
        form(ctx, null));
      return;
    }

    const { now, next } = current();
    sub.textContent = now ? "Now · " + now.title : next ? "Next at " + fmt(next.start) : "Day done";

    if (p.summary) body.append(h("div", { class: "qt-note qt-plan-summary" }, h("p", { text: p.summary }),
      lastCounts ? h("small", { text: "From " + [
        [lastCounts.tasks, "task"], [lastCounts.events, "event"], [lastCounts.reminders, "reminder"], [lastCounts.habits, "habit"],
      ].filter(([n]) => n).map(([n, w]) => n + " " + w + (n === 1 ? "" : "s")).join(", ") + (lastCounts.tasks + lastCounts.events + lastCounts.reminders + lastCounts.habits ? "" : "your note") }) : null));

    body.append(section(fmt(p.from) + " – " + fmt(p.to), h("div", { class: "qt-plan-list" }, p.blocks.map((b) => blockRow(b, p)))));

    if (p.unplanned && p.unplanned.length) {
      body.append(section("Didn't fit today", h("ul", { class: "qt-plan-unplanned" }, p.unplanned.map((u) => h("li", { text: u })))));
    }

    const remind = h("input", { type: "checkbox", class: "cz-switch", role: "switch", "aria-label": "Remind me when each block starts" });
    remind.checked = !!p.remind;
    remind.addEventListener("change", () => setRemind(remind.checked));
    body.append(section("Options",
      h("label", { class: "qt-row" }, h("span", { text: "Remind me when each block starts" }), remind),
      h("div", { class: "qt-chips" }, h("button", { type: "button", class: "qt-btn", text: "Clear plan", onclick: () => clear() }))));

    body.append(section("Plan again", form(ctx, p)));

    /* keep "now" moving while the view is open */
    ticker = setInterval(() => { if (!view || !view.body.isConnected) clearInterval(ticker); else if (!view.body.contains(document.activeElement)) paintView(); }, 60000);
  }

  function paintView() {
    if (!view || !view.body.isConnected) return;
    const top = view.body.scrollTop;
    render(view);
    view.body.scrollTop = top;
  }

  Acc.on(() => { if (view) paintView(); });

  window.AtlasPlanner = {
    ready,
    today,
    current,
    tile,
    render,
    /* quicktools.js calls this when the Day planner view closes */
    detach: () => { view = null; clearInterval(ticker); },
  };
})();
