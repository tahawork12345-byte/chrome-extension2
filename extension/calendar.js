/* ATLAS NEW TAB — calendar agenda (Atlas Pro)
   The user's Google Calendar, read-only: today and the next 7 days, from
   every calendar they have ticked in Google Calendar. Connecting asks
   Google for the calendar.readonly scope through the sign-in client
   (AtlasAccount.googleToken); the token lasts an hour and is renewed
   without a window (prompt=none) while Google allows it, otherwise the
   view asks to reconnect.

   The events are fetched here, straight from Google — they never go
   through the Atlas server — and kept in "cal:events" so a new tab shows
   them at once; they're re-read when older than REFRESH_EVERY.
     - Quick tools > Calendar draws the agenda (quicktools.js calls render())
     - planner.js reads day() for the AI day planner                      */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  const Acc = window.AtlasAccount;
  if (!AS || !Acc) return;

  const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
  const GAPI = "https://www.googleapis.com/calendar/v3";
  const LINK = "cal:link";     // { token, expiresAt, email }
  const EVENTS = "cal:events"; // { at, items }
  const DAYS = 7;
  const MAX_CALENDARS = 10;
  const REFRESH_EVERY = 10 * 60 * 1000;

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const get = (keys) => new Promise((r) => (hasChrome ? chrome.storage.local.get(keys, r) : r({})));
  const set = (obj) => new Promise((r) => (hasChrome ? chrome.storage.local.set(obj, r) : r()));
  const drop = (keys) => new Promise((r) => (hasChrome ? chrome.storage.local.remove(keys, r) : r()));

  let link = null;
  let cache = { at: 0, items: [] };
  let status = "idle"; // idle | loading | reconnect | error
  let lastError = "";
  const listeners = [];
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); paintView(); };

  const isPro = () => Acc.isPro();
  const connected = () => !!(link && link.email);

  /* ---------- dates ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
  const localDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  function fmtTime(ms) {
    const d = new Date(ms);
    if (AS.get().widgets.clock.h24) return pad(d.getHours()) + ":" + pad(d.getMinutes());
    const hr = d.getHours() % 12 || 12;
    return hr + (d.getMinutes() ? ":" + pad(d.getMinutes()) : "") + " " + (d.getHours() < 12 ? "AM" : "PM");
  }
  function dayLabel(ms) {
    const today = startOfDay(Date.now());
    if (ms === today) return "Today";
    if (ms === addDays(today, 1)) return "Tomorrow";
    return new Date(ms).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  /* ---------- storage ---------- */
  function clean(items) {
    return (Array.isArray(items) ? items : []).filter((e) => e && typeof e.id === "string" && Number(e.start) && Number(e.end)).map((e) => ({
      id: e.id.slice(0, 200),
      title: String(e.title || "(No title)").slice(0, 200),
      start: Number(e.start),
      end: Number(e.end),
      allDay: !!e.allDay,
      location: String(e.location || "").slice(0, 200),
      link: /^https:\/\//.test(e.link || "") ? e.link : "",
      meet: /^https:\/\//.test(e.meet || "") ? e.meet : "",
      color: /^#[0-9a-f]{3,8}$/i.test(e.color || "") ? e.color : "",
    }));
  }

  const ready = get([LINK, EVENTS]).then((o) => {
    link = o[LINK] && o[LINK].email ? o[LINK] : null;
    if (o[EVENTS]) cache = { at: Number(o[EVENTS].at) || 0, items: clean(o[EVENTS].items) };
    if (connected() && isPro() && Date.now() - cache.at > REFRESH_EVERY) refresh().catch(() => {});
  });

  /* another tab connected, disconnected or fetched */
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || (!ch[LINK] && !ch[EVENTS])) return;
    if (ch[LINK]) link = ch[LINK].newValue && ch[LINK].newValue.email ? ch[LINK].newValue : null;
    if (ch[EVENTS]) cache = ch[EVENTS].newValue ? { at: Number(ch[EVENTS].newValue.at) || 0, items: clean(ch[EVENTS].newValue.items) } : { at: 0, items: [] };
    emit();
  });

  /* ---------- Google ---------- */
  class NeedsReconnect extends Error {}

  async function token() {
    if (link && link.token && link.expiresAt - 60000 > Date.now()) return link.token;
    try {
      const t = await Acc.googleToken({ scope: SCOPE, interactive: false, loginHint: link && link.email });
      link = Object.assign({}, link, t);
      await set({ [LINK]: link });
      return link.token;
    } catch {
      throw new NeedsReconnect("Google wants you to confirm Calendar access again.");
    }
  }

  async function gapi(path, params) {
    const url = GAPI + path + (params ? "?" + new URLSearchParams(params) : "");
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: "Bearer " + (await token()) } });
    } catch (err) {
      if (err instanceof NeedsReconnect) throw err;
      throw new Error("Can't reach Google Calendar. Check your connection.");
    }
    if (res.status === 401) {
      link = Object.assign({}, link, { token: "", expiresAt: 0 });
      throw new NeedsReconnect("Google wants you to confirm Calendar access again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || "Google Calendar answered " + res.status);
    return data;
  }

  function toEvent(e, cal) {
    if (!e || e.status === "cancelled" || !e.start || !e.end) return null;
    const me = (e.attendees || []).find((a) => a.self);
    if (me && me.responseStatus === "declined") return null;
    const allDay = !!e.start.date;
    const start = allDay ? localDate(e.start.date) : Date.parse(e.start.dateTime);
    const end = allDay ? localDate(e.end.date) : Date.parse(e.end.dateTime);
    if (!start || !end) return null;
    return {
      id: cal.id + "/" + e.id, title: e.summary, start, end, allDay,
      location: e.location, link: e.htmlLink, meet: e.hangoutLink, color: cal.backgroundColor,
    };
  }

  let fetching = null;
  function refresh() {
    if (!connected()) return Promise.resolve();
    if (fetching) return fetching;
    status = "loading";
    emit();
    fetching = (async () => {
      const from = startOfDay(Date.now());
      const { items: cals = [] } = await gapi("/users/me/calendarList", { minAccessRole: "reader", fields: "items(id,selected,hidden,backgroundColor)" });
      const shown = cals.filter((c) => c.selected && !c.hidden).slice(0, MAX_CALENDARS);
      const lists = await Promise.all(shown.map((cal) => gapi("/calendars/" + encodeURIComponent(cal.id) + "/events", {
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(addDays(from, DAYS)).toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
        fields: "items(id,summary,status,start,end,location,htmlLink,hangoutLink,attendees(self,responseStatus))",
      }).then((d) => (d.items || []).map((e) => toEvent(e, cal)).filter(Boolean))));
      const items = clean(lists.flat()).sort((a, b) => (b.allDay - a.allDay) || a.start - b.start || a.title.localeCompare(b.title)).slice(0, 300);
      cache = { at: Date.now(), items };
      if (!link) return; // disconnected meanwhile
      await set({ [EVENTS]: cache, [LINK]: link });
      status = "idle";
      lastError = "";
    })().catch((err) => {
      status = err instanceof NeedsReconnect ? "reconnect" : "error";
      lastError = err.message;
      throw err;
    }).finally(() => { fetching = null; emit(); });
    return fetching;
  }

  async function connect(anchor) {
    const hint = (link && link.email) || (Acc.user() && Acc.user().email);
    /* already allowed before (or on another computer)? then no window at all */
    const t = await (hint ? Acc.googleToken({ scope: SCOPE, interactive: false, loginHint: hint }) : Promise.reject(new Error("no hint")))
      .catch(() => Acc.googleToken({ scope: SCOPE, interactive: true, loginHint: hint, anchor }));
    const was = link;
    link = Object.assign({}, t, { email: "" });
    /* the primary calendar's id is the account's address */
    try {
      const { items = [] } = await gapi("/users/me/calendarList", { minAccessRole: "owner", fields: "items(id,primary)" });
      const primary = items.find((c) => c.primary);
      link.email = primary ? primary.id : "Google Calendar";
    } catch (err) {
      link = was;
      throw err;
    }
    status = "idle";
    await set({ [LINK]: link });
    await refresh();
  }

  /* a token from Google sign-in (account.js), which asks for the calendar too */
  async function adopt(t, email) {
    link = Object.assign({}, t, { email: email || "Google Calendar" });
    status = "idle";
    lastError = "";
    await set({ [LINK]: link });
    emit();
    await refresh();
  }

  /* signed in before the calendar came with sign-in, or on another
     computer: Google may already allow it — then connect without a click.
     Tried once per page. */
  let triedSilent = false;
  function trySilent() {
    const u = Acc.user();
    if (triedSilent || connected() || !u || !u.email || !Acc.configured()) return;
    triedSilent = true;
    Acc.googleToken({ scope: SCOPE, interactive: false, loginHint: u.email })
      .then((t) => adopt(t, u.email))
      .catch(() => {});
  }

  /* signed out: this computer forgets the calendar (Google's grant stays,
     so signing in again brings it straight back) */
  async function forget() {
    link = null;
    cache = { at: 0, items: [] };
    status = "idle";
    await drop([LINK, EVENTS]);
    emit();
  }

  async function disconnect() {
    const t = link && link.token;
    link = null;
    cache = { at: 0, items: [] };
    status = "idle";
    await drop([LINK, EVENTS]);
    emit();
    if (t) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t), { method: "POST" }).catch(() => {});
  }

  /* ---------- reading the events ---------- */
  /* the events touching the day `key` ("YYYY-MM-DD"), all-day first */
  function day(key) {
    const from = localDate(key);
    const to = addDays(from, 1);
    return cache.items.filter((e) => e.start < to && e.end > from);
  }
  /* the one on now, or the next with a time */
  function next() {
    const now = Date.now();
    return cache.items.filter((e) => !e.allDay && e.end > now).sort((a, b) => a.start - b.start)[0] || null;
  }

  function tile() {
    if (!isPro()) return "Pro · your agenda here";
    if (!connected()) return "Connect Google Calendar";
    if (status === "reconnect") return "Reconnect needed";
    const e = next();
    if (!e) return "Clear for the week";
    const when = e.start <= Date.now() ? "Now" : (startOfDay(e.start) === startOfDay(Date.now()) ? "" : dayLabel(startOfDay(e.start)).slice(0, 3) + " ") + fmtTime(e.start);
    return when + " · " + e.title;
  }

  /* ---------- Quick tools > Calendar ---------- */
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

  let view = null; // the ctx render() was given, while the view is open

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
  }

  function busy(btn, text, msg, fn) {
    const was = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
    msg.hidden = true;
    return fn().catch((err) => {
      msg.textContent = err && err.message ? err.message : String(err);
      msg.hidden = false;
    }).finally(() => { if (btn.isConnected) { btn.disabled = false; btn.textContent = was; } });
  }

  function eventRow(e) {
    const now = Date.now();
    const on = e.start <= now && e.end > now;
    const time = e.allDay ? "All day" : fmtTime(e.start) + (e.end - e.start >= 60000 ? " – " + fmtTime(e.end) : "");
    return h("a", {
      class: "qt-cal-ev" + (on && !e.allDay ? " is-now" : "") + (e.end <= now ? " is-past" : ""),
      href: e.link || null, target: "_blank", rel: "noopener", title: e.title,
    },
      h("span", { class: "qt-cal-bar", style: e.color ? "background:" + e.color : null }),
      h("span", { class: "qt-cal-main" },
        h("span", { class: "qt-cal-title", text: e.title }),
        h("small", { text: time + (e.location ? " · " + e.location : "") })),
      e.meet && e.end > now ? h("span", {
        class: "qt-btn qt-cal-join", text: "Join", role: "button", tabindex: "0",
        onclick: (ev) => { ev.preventDefault(); ev.stopPropagation(); Acc.openTab(e.meet); },
      }) : null);
  }

  function render(ctx) {
    view = ctx;
    const { body, sub, section, upgradeNote } = ctx;
    body.textContent = "";

    if (!isPro()) {
      sub.textContent = "Atlas Pro";
      body.append(upgradeNote("See today's meetings and the week ahead from Google Calendar, right on your new tab. Part of Atlas Pro."));
      return;
    }
    if (!Acc.configured()) {
      sub.textContent = "Not set up";
      body.append(h("p", { class: "qt-empty", text: "Google isn't set up in this build (ACCOUNT_CONFIG in config.js)." }));
      return;
    }

    if (!connected()) {
      trySilent();
      sub.textContent = "Google Calendar";
      const msg = h("p", { class: "qt-note-err", hidden: true });
      const btn = h("button", {
        type: "button", class: "qt-btn is-primary", text: "Connect Google Calendar",
        onclick: () => busy(btn, "Connecting…", msg, () => connect(ctx.body.closest(".qt-panel").getBoundingClientRect())),
      });
      body.append(section(null,
        h("p", { class: "qt-empty", text: (Acc.signedIn()
          ? "Calendar access wasn't allowed when you signed in. Connect it to see today's events and the week ahead here, and let the Day planner work around your meetings."
          : "See today's events and the week ahead here, and let the Day planner work around your meetings. Signing in to Atlas with Google connects it too.") + " Atlas only reads your calendar — it never changes it, and the events stay on this computer." }),
        h("div", { class: "qt-chips" }, btn), msg));
      return;
    }

    sub.textContent = status === "loading" ? "Updating…" : cache.at ? "Updated " + ago(cache.at) : link.email;

    const msg = h("p", { class: "qt-note-err", hidden: !lastError || status === "reconnect", text: lastError });
    if (status === "reconnect") {
      const btn = h("button", {
        type: "button", class: "qt-btn is-primary", text: "Reconnect",
        onclick: () => busy(btn, "Connecting…", msg, () => connect(ctx.body.closest(".qt-panel").getBoundingClientRect())),
      });
      body.append(h("div", { class: "qt-pro" }, h("p", { text: "Google wants you to confirm Calendar access again." }), btn));
    }
    body.append(msg);

    const today = startOfDay(Date.now());
    let any = false;
    for (let i = 0; i < DAYS; i++) {
      const d = addDays(today, i);
      const list = day(dayKey(d)).filter((e) => i === 0 || !e.allDay || e.start >= d);
      if (!list.length && i > 0) continue;
      any = any || list.length > 0;
      body.append(section(dayLabel(d),
        list.length ? h("div", { class: "qt-cal-list" }, list.map(eventRow)) : h("p", { class: "qt-empty", text: "Nothing today." })));
    }
    if (!any) body.append(h("p", { class: "qt-empty", text: "Nothing on your calendar for the next " + DAYS + " days." }));

    const refreshBtn = h("button", { type: "button", class: "qt-btn", text: "Refresh", disabled: status === "loading", onclick: () => refresh().catch(() => {}) });
    body.append(section("Account",
      h("p", { class: "qt-empty", text: "Connected as " + link.email + ". Showing the calendars ticked in Google Calendar." }),
      h("div", { class: "qt-chips" }, refreshBtn,
        h("button", { type: "button", class: "qt-btn", text: "Disconnect", onclick: () => disconnect() }))));

    if (Date.now() - cache.at > REFRESH_EVERY && status === "idle") refresh().catch(() => {});
  }

  function paintView() {
    if (!view || !view.body.isConnected) return;
    const top = view.body.scrollTop;
    render(view);
    view.body.scrollTop = top;
  }

  Acc.on(() => { if (!Acc.signedIn()) triedSilent = false; if (view) paintView(); });

  window.AtlasCalendar = {
    ready,
    connected,
    status: () => status,
    events: () => cache.items.slice(),
    day,
    dayKey,
    next,
    refresh,
    connect,
    adopt,
    forget,
    disconnect,
    on: (fn) => listeners.push(fn),
    tile,
    render,
    /* quicktools.js calls this when the Calendar view closes */
    detach: () => { view = null; },
  };
})();
