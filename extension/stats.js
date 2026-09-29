/* ATLAS NEW TAB — stats dashboard
   Your time in one place: time on each site (background.js counts it in
   "stats:days"), focus sessions ("focus:history"), tasks done ("qt:tasks")
   and habits ticked off ("qt:habits"), and blocked sites opened.
   Free accounts see today (PRO_CONFIG.freeStatsDays); Pro sees 7 and 30
   days and can turn on the Monday summary email — for that, this page
   sends the backend this week's and last week's numbers (PUT /stats/week),
   at most every few hours. Everything else stays on this computer.       */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  if (!AS) return;

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const read = (keys) => new Promise((r) => (hasChrome ? chrome.storage.local.get(keys, r) : r({})));
  const write = (obj) => new Promise((r) => (hasChrome ? chrome.storage.local.set(obj, r) : r()));
  const Acc = () => window.AtlasAccount;
  const isPro = () => !!(Acc() && Acc().isPro());
  const freeDays = () => (typeof PRO_CONFIG !== "undefined" ? PRO_CONFIG.freeStatsDays : 1);

  const EMAIL_KEY = "stats:email";       // the weekly email is on (a copy of the server's)
  const UPLOAD_KEY = "stats:uploadedAt";
  const UPLOAD_EVERY = 3 * 3600 * 1000;

  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  /* the `n` days ending with `end` (default today), oldest first */
  function lastDays(n, end) {
    const out = [];
    const d = end ? new Date(end) : new Date();
    d.setDate(d.getDate() - (n - 1));
    for (let i = 0; i < n; i++, d.setDate(d.getDate() + 1)) out.push(ymd(d));
    return out;
  }
  const mondayOf = (d) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

  const fmtMin = (m) => {
    m = Math.round(m);
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
  };
  const fmtSecs = (s) => (s < 60 && s > 0 ? "<1m" : fmtMin(s / 60));

  /* ---------- the numbers ---------- */
  async function collect(days) {
    const o = await read(["stats:days", "focus:history", "qt:tasks", "qt:habits"]);
    const raw = o["stats:days"] || {};
    const hist = Array.isArray(o["focus:history"]) ? o["focus:history"] : [];
    const set = new Set(days);
    const per = {};
    days.forEach((k) => (per[k] = { date: k, browse: 0, focus: 0, sessions: 0, tasks: 0, habits: 0, blocked: 0 }));
    const sites = {};
    const blocked = {};
    days.forEach((k) => {
      const d = raw[k];
      if (!d) return;
      Object.entries(d.t || {}).forEach(([host, secs]) => { per[k].browse += secs; sites[host] = (sites[host] || 0) + secs; });
      Object.entries(d.b || {}).forEach(([host, n]) => { per[k].blocked += n; blocked[host] = (blocked[host] || 0) + n; });
    });
    hist.forEach((s) => {
      const k = ymd(new Date(s.start));
      if (!set.has(k)) return;
      per[k].focus += Number(s.min) || 0;
      if (s.done) per[k].sessions++;
    });
    const goals = (o["qt:tasks"] && Array.isArray(o["qt:tasks"].goals)) ? o["qt:tasks"].goals : [];
    goals.forEach((g) => (g.tasks || []).forEach((t) => {
      if (!t.done || !t.doneAt) return;
      const k = ymd(new Date(t.doneAt));
      if (set.has(k)) per[k].tasks++;
    }));
    const habits = (o["qt:habits"] && Array.isArray(o["qt:habits"].habits)) ? o["qt:habits"].habits : [];
    habits.forEach((hb) => (hb.done || []).forEach((k) => { if (set.has(k)) per[k].habits++; }));

    const list = days.map((k) => per[k]);
    const totals = list.reduce((a, d) => {
      Object.keys(a).forEach((key) => (a[key] += d[key]));
      return a;
    }, { browse: 0, focus: 0, sessions: 0, tasks: 0, habits: 0, blocked: 0 });
    const top = Object.entries(sites).sort((a, b) => b[1] - a[1]).map(([host, secs]) => ({ host, secs }));
    const topBlocked = Object.entries(blocked).sort((a, b) => b[1] - a[1]).map(([host, n]) => ({ host, n }));
    return { days: list, totals, top, topBlocked };
  }

  /* ---------- the weekly email: send the numbers ---------- */
  async function upload(force) {
    const A = Acc();
    if (!A || !A.signedIn() || !isPro()) return;
    const o = await read([EMAIL_KEY, UPLOAD_KEY]);
    if (!o[EMAIL_KEY]) return;
    if (!force && Date.now() - (Number(o[UPLOAD_KEY]) || 0) < UPLOAD_EVERY) return;
    const thisMon = mondayOf(new Date());
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const streak = window.AtlasFocus ? AtlasFocus.streak() : 0;
    const weeks = [];
    for (const mon of [lastMon, thisMon]) {
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const r = await collect(lastDays(7, sun));
      weeks.push({
        week: ymd(mon),
        data: {
          days: r.days.map((d) => ({ date: d.date, browse: d.browse, focus: d.focus, tasks: d.tasks, habits: d.habits, blocked: d.blocked })),
          top: r.top.slice(0, 5),
          totals: r.totals,
          streak,
        },
      });
    }
    await A.api("/stats/week", { method: "PUT", body: { weeks } });
    await write({ [UPLOAD_KEY]: Date.now() });
  }
  setTimeout(() => { if (Acc()) Acc().ready.then(() => upload(false)).catch(() => {}); }, 6000);

  /* ---------- the dashboard ---------- */
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

  let range = 1;
  let lastFocus = null;
  const body = h("div", { class: "st-body" });
  const seg = h("div", { class: "qt-tabs st-range", role: "radiogroup", "aria-label": "Range" });
  const root = h("div", { class: "st", role: "dialog", "aria-modal": "true", "aria-label": "Your stats", hidden: true },
    h("div", { class: "st-scrim", onclick: () => close() }),
    h("section", { class: "st-card" },
      h("header", { class: "st-head" },
        h("div", {}, h("h2", { class: "st-title", text: "Your stats" }), h("p", { class: "st-sub", text: "Time, focus and progress — kept on this computer" })),
        seg,
        h("button", { type: "button", class: "ai-icon-btn st-x", "aria-label": "Close", title: "Close", text: "✕", onclick: () => close() })),
      body));
  document.body.append(root);

  function paintSeg() {
    seg.textContent = "";
    [[1, "Today"], [7, "7 days"], [30, "30 days"]].forEach(([n, label]) => {
      const locked = n > freeDays() && !isPro();
      seg.append(h("button", {
        type: "button", role: "radio", class: "qt-tab" + (range === n ? " is-on" : ""), "aria-checked": String(range === n),
        text: label + (locked ? " 🔒" : ""),
        onclick: () => { range = n; render(); },
      }));
    });
  }

  const tip = h("div", { class: "st-tip", role: "tooltip", hidden: true });
  root.append(tip);
  function showTip(e, text) {
    tip.textContent = text;
    tip.hidden = false;
    const r = e.currentTarget.getBoundingClientRect();
    tip.style.left = Math.round(r.left + r.width / 2) + "px";
    tip.style.top = Math.round(r.top) + "px";
  }
  const hideTip = () => (tip.hidden = true);

  const tile = (value, label, sub) => h("div", { class: "st-tile" }, h("strong", { text: value }), h("span", { text: label }), sub ? h("small", { text: sub }) : null);

  /* one series per chart, one axis: a column per day */
  function dayChart(title, list, value, fmt) {
    const max = Math.max(1, ...list.map(value));
    const many = list.length > 10;
    const chart = h("div", { class: "st-bars" + (many ? " is-many" : ""), role: "img", "aria-label": title + ": " + list.map((d) => d.date + " " + fmt(value(d))).join(", ") });
    list.forEach((d, i) => {
      const v = value(d);
      const date = new Date(d.date + "T12:00:00");
      const label = date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
      const col = h("div", {
        class: "st-col", tabindex: "0",
        onmouseenter: (e) => showTip(e, label + " · " + fmt(v)), onmouseleave: hideTip,
        onfocus: (e) => showTip(e, label + " · " + fmt(v)), onblur: hideTip,
      }, h("span", { class: "st-bar" + (v ? "" : " is-zero") }),
        h("small", { text: many ? (i % 5 === 0 || i === list.length - 1 ? String(date.getDate()) : "") : date.toLocaleDateString([], { weekday: "short" }) }));
      col.firstChild.style.height = (v ? Math.max(3, (v / max) * 100) : 0) + "%";
      chart.append(col);
    });
    const best = list.reduce((a, d) => (value(d) > value(a) ? d : a), list[0]);
    return h("section", { class: "st-panel" },
      h("div", { class: "st-ptitle" }, h("h3", { text: title }),
        value(best) ? h("span", { text: "Best: " + fmt(value(best)) + " on " + new Date(best.date + "T12:00:00").toLocaleDateString([], { weekday: "short", day: "numeric" }) }) : null),
      chart);
  }

  function siteList(title, rows, value, fmt, empty) {
    const max = Math.max(1, ...rows.map(value));
    return h("section", { class: "st-panel" },
      h("div", { class: "st-ptitle" }, h("h3", { text: title })),
      rows.length ? h("ol", { class: "st-sites" }, rows.map((r) => {
        const bar = h("span", { class: "st-sbar" });
        bar.style.width = Math.max(2, (value(r) / max) * 100) + "%";
        return h("li", {},
          h("span", { class: "st-host", text: r.host, translate: "no" }),
          h("span", { class: "st-strack" }, bar),
          h("span", { class: "st-val", text: fmt(value(r)) }));
      })) : h("p", { class: "qt-empty", text: empty }));
  }

  async function emailPanel() {
    const A = Acc();
    const panel = h("section", { class: "st-panel st-email" });
    if (!isPro()) {
      const QT = window.AtlasQuickTools;
      panel.append(QT && QT.upgradeNote ? QT.upgradeNote("Atlas Pro keeps 30 days of stats and emails you a summary of your week every Monday.") : null);
      return panel;
    }
    const input = h("input", { type: "checkbox", class: "cz-switch", role: "switch", "aria-label": "Weekly email" });
    const msg = h("p", { class: "qt-empty" });
    const o = await read([EMAIL_KEY]);
    input.checked = !!o[EMAIL_KEY];
    msg.textContent = input.checked ? "A summary of your week arrives every Monday at " + ((A.user() || {}).email || "your email") + "." : "Get a summary of your week by email every Monday.";
    A.api("/stats/prefs").then((p) => { input.checked = !!p.weeklyEmail; write({ [EMAIL_KEY]: !!p.weeklyEmail }); }).catch(() => {});
    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        const p = await A.api("/stats/prefs", { method: "PUT", body: { weeklyEmail: input.checked } });
        await write({ [EMAIL_KEY]: !!p.weeklyEmail });
        msg.textContent = p.weeklyEmail ? "On. Your first summary arrives next Monday." : "Off. No more weekly emails.";
        if (p.weeklyEmail) upload(true).catch(() => {});
      } catch (err) {
        input.checked = !input.checked;
        msg.textContent = err.message;
      }
      input.disabled = false;
    });
    panel.append(h("label", { class: "qt-row" }, h("span", { text: "Weekly summary email" }), input), msg);
    return panel;
  }

  let renderToken = 0;
  async function render() {
    const token = ++renderToken;
    paintSeg();
    const locked = range > freeDays() && !isPro();
    const r = await collect(lastDays(locked ? 1 : range));
    if (token !== renderToken) return;
    body.textContent = "";
    if (locked) {
      const QT = window.AtlasQuickTools;
      body.append(h("div", { class: "st-locked" },
        QT && QT.upgradeNote ? QT.upgradeNote("Your last " + range + " days — focus by day, where your time went, your best days — are part of Atlas Pro, with a weekly summary email.") : null));
      return;
    }
    const t = r.totals;
    const n = r.days.length;
    const per = (v, f) => (n > 1 ? f(v / n) + " a day" : null);
    body.append(h("div", { class: "st-tiles" },
      tile(fmtMin(t.focus), "focused", per(t.focus, fmtMin)),
      tile(String(t.sessions), "focus sessions", window.AtlasFocus ? AtlasFocus.streak() + "-day streak" : null),
      tile(String(t.tasks), "tasks done"),
      tile(String(t.habits), "habits ticked off"),
      tile(fmtSecs(t.browse), "on the web", per(t.browse, fmtSecs)),
      tile(String(t.blocked), "blocked visits")));
    if (n > 1) {
      body.append(h("div", { class: "st-grid" },
        dayChart("Focus by day", r.days, (d) => d.focus, fmtMin),
        dayChart("Time on the web by day", r.days, (d) => d.browse / 60, fmtMin)));
    }
    body.append(h("div", { class: "st-grid" },
      siteList("Where your time went", r.top.slice(0, 10), (x) => x.secs, fmtSecs, "Nothing yet — time on each site shows up as you browse."),
      siteList("Most blocked", r.topBlocked.slice(0, 6), (x) => x.n, (v) => v + (v === 1 ? " visit" : " visits"), "No blocked sites opened. Nice.")));
    body.append(await emailPanel());
  }

  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    render();
    const on = seg.querySelector(".is-on");
    if (on) on.focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    hideTip();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden && !e.defaultPrevented) { e.preventDefault(); close(); }
  });
  if (Acc()) Acc().on(() => { if (!root.hidden) render(); });

  window.AtlasStats = { open, close, collect, upload };
})();
