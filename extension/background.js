/* ATLAS NEW TAB — background worker
   Keeps one entry per frame (tab + embedded player) that is playing (or
   has played) media, picks the
   one to show, and pushes it to any open new tab. Stored in
   storage.session so it survives the worker going to sleep. */
"use strict";

const KEY = "media:sessions";

const SOURCES = [
  ["open.spotify.com", "Spotify"],
  ["music.youtube.com", "YouTube Music"],
  ["youtube.com", "YouTube"],
  ["soundcloud.com", "SoundCloud"],
  ["deezer.com", "Deezer"],
  ["music.apple.com", "Apple Music"],
  ["music.amazon.", "Amazon Music"],
  ["tidal.com", "TIDAL"],
  ["pandora.com", "Pandora"],
  ["jiosaavn.com", "JioSaavn"],
  ["gaana.com", "Gaana"],
  ["audiomack.com", "Audiomack"],
  ["bandcamp.com", "Bandcamp"],
];

function sourceName(url) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  const hit = SOURCES.find(([h]) => host === h || host.endsWith("." + h) || host.startsWith(h));
  return hit ? hit[1] : host;
}

async function load() {
  const o = await chrome.storage.session.get(KEY);
  return o[KEY] || {};
}

/* the playing tab wins; otherwise the one that played most recently.
   Tabs that have never played (a paused video left open) are ignored. */
function pick(sessions) {
  const list = Object.values(sessions).filter((s) => s && s.title && s.lastActive);
  if (!list.length) return null;
  list.sort((a, b) => (b.playing - a.playing) || (b.lastActive - a.lastActive));
  return list[0];
}

function broadcast(now) {
  chrome.runtime.sendMessage({ type: "media:now", data: now }).catch(() => {});
}

/* updates arrive from many tabs at once; run them one after another */
let chain = Promise.resolve();
function mutate(fn) {
  chain = chain
    .then(async () => {
      const s = await load();
      if (fn(s) === false) return;
      await chrome.storage.session.set({ [KEY]: s });
      broadcast(pick(s));
    })
    .catch(() => {});
  return chain;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg.type !== "string") return;

  if (msg.type === "media:state" && sender.tab) {
    const tab = sender.tab;
    const frameId = sender.frameId || 0;
    const key = tab.id + ":" + frameId;
    const data = msg.data;
    mutate((s) => {
      if (!data) {
        if (!s[key]) return false;
        delete s[key];
        return;
      }
      const prev = s[key];
      s[key] = Object.assign({}, data, {
        tabId: tab.id,
        frameId,
        windowId: tab.windowId,
        source: sourceName(sender.url || tab.url || ""),
        lastActive: data.playing ? Date.now() : (prev && prev.lastActive) || 0,
      });
    });
    return;
  }

  if (msg.type === "media:get") {
    load().then((s) => reply(pick(s)), () => reply(null));
    return true;
  }

  if (msg.type === "media:cmd" && typeof msg.tabId === "number") {
    const frameId = typeof msg.frameId === "number" ? msg.frameId : 0;
    const key = msg.tabId + ":" + frameId;
    chrome.tabs
      .sendMessage(msg.tabId, { type: "media:cmd", action: msg.action, time: msg.time }, { frameId })
      .catch(() => {
        /* the frame no longer answers (closed or reloaded before the bridge) */
        mutate((s) => { if (!s[key]) return false; delete s[key]; });
      });
    return;
  }

  if (msg.type === "media:focus" && typeof msg.tabId === "number") {
    chrome.tabs.update(msg.tabId, { active: true }).catch(() => {});
    if (typeof msg.windowId === "number") chrome.windows.update(msg.windowId, { focused: true }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mutate((s) => {
    const keys = Object.keys(s).filter((k) => k.split(":")[0] === String(tabId));
    if (!keys.length) return false;
    keys.forEach((k) => delete s[k]);
  });
});

/* content scripts only reach pages loaded after the extension. When it is
   installed or reloaded, add them to the tabs that are already open, so a
   song that is already playing shows up without refreshing its tab. */
chrome.runtime.onInstalled.addListener(async () => {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }); } catch { return; }
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["media-bridge.js"], world: "MAIN" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["media-relay.js"] });
    } catch {
      /* discarded tabs, the Web Store, chrome:// pages: skip */
    }
  }
});

/* ================= REMINDERS ============================================
   Reminders (reminders.js) live in storage.local. Each enabled one has a
   chrome.alarms alarm at its next occurrence, so it rings anywhere in
   Chrome — no new tab needs to be open. Ringing = a system notification
   that stays until answered (Snooze / Dismiss) plus a looping alarm sound,
   played from an offscreen page because a worker can't play audio.
   A reminder that came due while Chrome was closed rings late, if it is
   less than LATE_LIMIT overdue. */
importScripts("schedule.js");

const REM_KEY = "reminders";
const PREF_KEY = "alarmPrefs";
const PREF_DEFAULTS = { sound: "chime", volume: 80, ringFor: 60, snooze: 10 };
const LATE_LIMIT = 12 * 60 * 60 * 1000;

async function getReminders() {
  const o = await chrome.storage.local.get([REM_KEY]);
  return Array.isArray(o[REM_KEY]) ? o[REM_KEY] : [];
}
async function getPrefs() {
  const o = await chrome.storage.local.get([PREF_KEY]);
  return Object.assign({}, PREF_DEFAULTS, o[PREF_KEY]);
}

/* alarms, the storage listener and startup can all ask at once; one at a time */
let remChain = Promise.resolve();
const serial = (fn) => (remChain = remChain.then(fn).catch((err) => console.error("Atlas reminders:", err)));

/* bring the alarms in line with the stored reminders */
function syncReminders() {
  return serial(async () => {
    const list = await getReminders();
    const now = Date.now();
    const late = [];
    const want = new Map();
    let changed = false;
    for (const r of list) {
      if (!r || !r.id || !r.enabled) continue;
      let t = AtlasSchedule.next(r, Math.max(r.lastFired || 0, r.updatedAt || 0));
      if (t != null && t <= now) {
        /* came due while nothing was listening */
        const missed = AtlasSchedule.last(r, now);
        if (now - missed <= LATE_LIMIT) late.push(r);
        r.lastFired = missed;
        changed = true;
        t = AtlasSchedule.next(r, now);
      }
      if (t != null) want.set("rem:" + r.id, t);
    }
    const existing = await chrome.alarms.getAll();
    for (const a of existing) {
      if (!a.name.startsWith("rem:")) continue;
      const w = want.get(a.name);
      if (w == null || Math.abs(a.scheduledTime - w) > 1000) await chrome.alarms.clear(a.name);
    }
    for (const [name, when] of want) {
      const a = existing.find((x) => x.name === name);
      if (!a || Math.abs(a.scheduledTime - when) > 1000) chrome.alarms.create(name, { when });
    }
    if (changed) await chrome.storage.local.set({ [REM_KEY]: list });
    for (const r of late) await ring(r, true);
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  const [kind, id] = alarm.name.split(":");
  if (kind !== "rem" && kind !== "snooze") return;
  serial(async () => {
    const list = await getReminders();
    const r = list.find((x) => x && x.id === id);
    if (!r) return;
    if (kind === "snooze") return ring(r, false, true);
    /* a sync may already have rung this one late */
    if ((r.lastFired || 0) >= alarm.scheduledTime - 1000) return;
    r.lastFired = alarm.scheduledTime;
    if (r.repeat === "once") r.enabled = false; // done; stays in the list
    await chrome.storage.local.set({ [REM_KEY]: list });
    await ring(r, false);
  });
});

/* ---------- ringing ---------- */
async function ring(r, late, snoozed) {
  const prefs = await getPrefs();
  const sound = !r.sound || r.sound === "default" ? prefs.sound : r.sound;
  const nid = "rem:" + r.id + ":" + Date.now();
  const lines = [];
  if (r.note) lines.push(r.note);
  lines.push(AtlasSchedule.describe(r));
  await chrome.notifications.create(nid, {
    type: "basic",
    iconUrl: "assets/icons/icon-128.png",
    title: "⏰ " + (r.title || "Reminder"),
    message: lines.join("\n"),
    contextMessage: late ? "Missed while Chrome was closed" : snoozed ? "Snoozed reminder" : "Atlas reminder",
    requireInteraction: true,
    priority: 2,
    silent: sound !== "none", // our own alarm plays instead of the system ding
    buttons: [{ title: "Snooze " + prefs.snooze + " min" }, { title: "Dismiss" }],
  });
  if (sound !== "none") await playAlarm(sound, prefs);
  /* open new tabs show the alarm too, with the same two buttons */
  chrome.runtime.sendMessage({
    type: "reminder:ring", nid, id: r.id, title: r.title || "Reminder", note: r.note || "", late: !!late, snooze: prefs.snooze,
  }).catch(() => {});
}

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  try {
    await chrome.offscreen.createDocument({
      url: "alarm.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Ring the alarm sound for a reminder",
    });
  } catch (err) {
    if (!/single offscreen/i.test(String(err && err.message))) throw err;
  }
}
async function playAlarm(sound, prefs, once) {
  try {
    await ensureOffscreen();
    chrome.runtime.sendMessage({
      target: "alarm", type: "alarm:play", sound, volume: prefs.volume,
      loop: !once, maxMs: once ? 8000 : prefs.ringFor * 1000,
    }).catch(() => {});
  } catch (err) {
    console.error("Atlas alarm sound:", err);
  }
}
async function stopAlarm() {
  chrome.runtime.sendMessage({ target: "alarm", type: "alarm:stop" }).catch(() => {});
  setTimeout(() => chrome.offscreen.closeDocument().catch(() => {}), 400);
}

/* answering from the notification, or from a new tab's alarm card */
async function answer(nid, snooze) {
  stopAlarm();
  chrome.notifications.clear(nid).catch(() => {});
  chrome.runtime.sendMessage({ type: "reminder:done", nid }).catch(() => {});
  if (snooze) {
    const id = nid.split(":")[1];
    const prefs = await getPrefs();
    chrome.alarms.create("snooze:" + id, { when: Date.now() + prefs.snooze * 60000 });
  }
}
chrome.notifications.onButtonClicked.addListener((nid, i) => {
  if (nid.startsWith("rem:")) answer(nid, i === 0);
});
chrome.notifications.onClicked.addListener((nid) => {
  if (nid.startsWith("rem:")) answer(nid, false);
});
chrome.notifications.onClosed.addListener((nid) => {
  if (nid.startsWith("rem:")) answer(nid, false);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg.type !== "string") return;
  if (msg.type === "reminder:dismiss" && msg.nid) answer(msg.nid, false);
  else if (msg.type === "reminder:snooze" && msg.nid) answer(msg.nid, true);
  else if (msg.type === "reminder:test") {
    ring({ id: "test", title: msg.title || "Test alarm", note: "This is how your reminders will ring.", repeat: "once", time: "00:00", sound: msg.sound || "default" }, false);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[REM_KEY]) syncReminders();
});
chrome.runtime.onStartup.addListener(syncReminders);
chrome.runtime.onInstalled.addListener(syncReminders);
/* the worker wakes for many reasons; each time, catch up on anything due */
syncReminders();

/* ================= PAGE TRANSLATION ======================================
   translate.js sends the text of a page in batches; this worker asks
   Google Translate (the endpoint the Translate website itself uses, so no
   key) and remembers answers while it is awake, so a page that re-renders
   the same labels doesn't ask twice.                                      */
const TR_URL = "https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=";
const TR_CACHE_MAX = 5000;
const trCache = new Map(); // "to\u0001text" -> translation

async function translateBatch(texts, to) {
  const out = new Array(texts.length);
  const need = [];
  texts.forEach((t, i) => {
    const hit = trCache.get(to + "\u0001" + t);
    if (hit !== undefined) out[i] = hit;
    else need.push(i);
  });
  if (need.length) {
    const body = new URLSearchParams();
    need.forEach((i) => body.append("q", texts[i]));
    const r = await fetch(TR_URL + encodeURIComponent(to), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
    if (!r.ok) throw new Error("translate " + r.status);
    const data = await r.json();
    /* one string per input: [text, sourceLang] with sl=auto, or a bare string */
    const list = Array.isArray(data) ? data : [data];
    need.forEach((i, k) => {
      const item = list[k];
      const text = Array.isArray(item) ? item[0] : item;
      out[i] = typeof text === "string" ? text : texts[i];
      if (trCache.size >= TR_CACHE_MAX) trCache.delete(trCache.keys().next().value);
      trCache.set(to + "\u0001" + texts[i], out[i]);
    });
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "translate:batch") return;
  const texts = Array.isArray(msg.texts) ? msg.texts.map(String).slice(0, 200) : [];
  if (!texts.length || typeof msg.to !== "string") return reply({ ok: false });
  translateBatch(texts, msg.to).then(
    (out) => reply({ ok: true, out }),
    (err) => reply({ ok: false, error: String(err && err.message || err) }),
  );
  return true;
});

/* ================= SITE BLOCKER ==========================================
   Customize > Blocker keeps the list (settings.blocker in "appearance").
   While it applies — always, or inside its schedule — each site gets a
   declarativeNetRequest rule that sends the page to blocked.html instead.
   A break ("blocker:pause", a time) lifts every rule until it runs out; a
   one-minute alarm re-checks the schedule and the break.                 */
const BL_PAUSE = "blocker:pause";
const BL_ALARM = "blocker:tick";
const BL_FIRST_ID = 1000;
const BL_MAX = 300;

function readBlocker(raw) {
  try {
    const s = JSON.parse(raw || "null");
    const b = s && s.settings && s.settings.blocker;
    if (!b || !Array.isArray(b.sites)) return null;
    return b;
  } catch { return null; }
}

const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/* inside the schedule? "22:00"–"06:00" runs overnight, and belongs to the
   day it starts on */
function inSchedule(b, now) {
  const from = minutesOf(b.from), to = minutesOf(b.to);
  if (from == null || to == null || from === to) return false;
  const days = Array.isArray(b.days) ? b.days : [];
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  if (from < to) return days.includes(day) && mins >= from && mins < to;
  return (days.includes(day) && mins >= from) || (days.includes((day + 6) % 7) && mins < to);
}

function blockerApplies(b, now, pausedUntil) {
  if (!b || !b.on || !b.sites.length) return false;
  if (pausedUntil > now.getTime()) return false;
  return b.schedule ? inSchedule(b, now) : true;
}

let blChain = Promise.resolve();
function syncBlocker() {
  blChain = blChain.then(syncBlockerNow, syncBlockerNow).catch((e) => console.error("blocker:", e));
  return blChain;
}
async function syncBlockerNow() {
  if (!chrome.declarativeNetRequest) return;
  const o = await chrome.storage.local.get(["appearance", BL_PAUSE, FOCUS_KEY]);
  const b = readBlocker(o.appearance);
  const pausedUntil = Number(o[BL_PAUSE]) || 0;
  const now = new Date();
  /* a running focus session blocks the list too — even with the blocker
     off, and a "5-minute break" doesn't lift it */
  const on = blockerApplies(b, now, pausedUntil) ||
    !!(b && b.sites.length && focusBlocks(o[FOCUS_KEY], readFocus(o.appearance)));
  const sites = on ? b.sites.filter((d) => typeof d === "string" && /^[a-z0-9.-]+$/.test(d)).slice(0, BL_MAX) : [];

  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.filter((r) => r.id >= BL_FIRST_ID && r.id < BL_FIRST_ID + BL_MAX).map((r) => r.id),
    addRules: sites.map((d, i) => ({
      id: BL_FIRST_ID + i,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/blocked.html#" + d } },
      condition: { requestDomains: [d], resourceTypes: ["main_frame"] },
    })),
  });

  /* tabs already open on a blocked site close up too */
  if (sites.length) {
    const tabs = await chrome.tabs.query({ url: sites.flatMap((d) => ["*://" + d + "/*", "*://*." + d + "/*"]) }).catch(() => []);
    tabs.forEach((t) => {
      const host = (() => { try { return new URL(t.url).hostname; } catch { return ""; } })();
      const d = sites.find((s) => host === s || host.endsWith("." + s)) || sites[0];
      chrome.tabs.update(t.id, { url: chrome.runtime.getURL("blocked.html#" + d) }).catch(() => {});
    });
  }

  /* re-check each minute while a schedule or a break can change things */
  const needTick = !!(b && b.on && (b.schedule || pausedUntil > now.getTime()));
  const has = await chrome.alarms.get(BL_ALARM);
  if (needTick && !has) chrome.alarms.create(BL_ALARM, { periodInMinutes: 1 });
  if (!needTick && has) chrome.alarms.clear(BL_ALARM);
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === BL_ALARM) syncBlocker(); });

let blTimer = 0;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(changes.appearance || changes[BL_PAUSE] || changes[FOCUS_KEY])) return;
  /* Customize saves on every tweak; only a change to the blocker counts */
  if (changes.appearance && !changes[BL_PAUSE] && !changes[FOCUS_KEY]) {
    const pick = (raw) => JSON.stringify([readBlocker(raw), readFocus(raw).block]);
    if (pick(changes.appearance.oldValue) === pick(changes.appearance.newValue)) return;
  }
  clearTimeout(blTimer);
  blTimer = setTimeout(syncBlocker, 250);
});

/* blocked.html: "Take a break" */
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "blocker:break") return;
  const minutes = Math.min(60, Math.max(1, Number(msg.minutes) || 5));
  chrome.storage.local.set({ [BL_PAUSE]: Date.now() + minutes * 60000 })
    .then(syncBlocker)
    .then(() => reply({ ok: true }), () => reply({ ok: false }));
  return true;
});

chrome.runtime.onStartup.addListener(syncBlocker);
chrome.runtime.onInstalled.addListener(syncBlocker);
syncBlocker();

/* ================= AUTO OPTIMIZE =========================================
   Quick tools > Optimize (settings.optimize in "appearance"). Every five
   minutes, tabs unused for longer than `sleepAfter` are put to sleep
   (discarded: they stay in the tab strip and reload when opened). With
   `dedupe`, a tab that opens a page already open elsewhere closes, and
   the tab that had it comes forward. Pinned, playing and active tabs are
   never touched.                                                         */
const OPT_ALARM = "optimize:tick";

async function readOptimize() {
  const o = await chrome.storage.local.get(["appearance"]);
  try {
    const s = JSON.parse(o.appearance || "null");
    const opt = s && s.settings && s.settings.optimize;
    return opt && opt.auto ? opt : null;
  } catch { return null; }
}

async function syncOptimizeAlarm() {
  const opt = await readOptimize();
  const has = await chrome.alarms.get(OPT_ALARM);
  if (opt && opt.sleep && !has) chrome.alarms.create(OPT_ALARM, { periodInMinutes: 5 });
  if (!(opt && opt.sleep) && has) chrome.alarms.clear(OPT_ALARM);
}

async function sleepIdleTabs() {
  const opt = await readOptimize();
  if (!opt || !opt.sleep) return;
  const limit = Date.now() - Math.max(5, Number(opt.sleepAfter) || 30) * 60000;
  const tabs = await chrome.tabs.query({ discarded: false });
  for (const t of tabs) {
    if (t.active || t.pinned || t.audible || !/^https?:/.test(t.url || "")) continue;
    if (!t.lastAccessed || t.lastAccessed > limit) continue;
    await chrome.tabs.discard(t.id).catch(() => {});
  }
}

const optPageKey = (u) => { try { const x = new URL(u); x.hash = ""; return x.href; } catch { return u; } };
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.url || !/^https?:/.test(info.url)) return;
  const opt = await readOptimize();
  if (!opt || !opt.dedupe || tab.pinned) return;
  const key = optPageKey(info.url);
  const others = (await chrome.tabs.query({})).filter((t) => t.id !== tabId && t.url && optPageKey(t.url) === key);
  if (!others.length) return;
  const keep = others.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  await chrome.tabs.update(keep.id, { active: true }).catch(() => {});
  await chrome.windows.update(keep.windowId, { focused: true }).catch(() => {});
  await chrome.tabs.remove(tabId).catch(() => {});
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === OPT_ALARM) sleepIdleTabs(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.appearance) syncOptimizeAlarm();
});
chrome.runtime.onStartup.addListener(syncOptimizeAlarm);
syncOptimizeAlarm();

/* ================= FOCUS TIMER ===========================================
   Quick tools > Focus (focus.js draws it; settings.focus in "appearance").
   The worker owns the clock so a session ends — sound, notification, the
   next phase — with no new tab open. State lives in "focus:state":
     { phase: "idle" | "focus" | "short" | "long", endsAt, left (ms, while
       paused), paused, round (focus sessions done this cycle), startedAt,
       next (the phase the Start button begins) }
   Finished and stopped focus sessions go into "focus:history" (newest
   last): { id, start, end, min, done }. While a focus session runs,
   the site blocker's list is blocked (syncBlockerNow).                   */
const FOCUS_KEY = "focus:state";
const FOCUS_HIST = "focus:history";
const FOCUS_ALARM = "focus:end";
const FOCUS_HIST_MAX = 1000;
const FOCUS_DEFAULTS = { work: 25, short: 5, long: 15, every: 4, block: true, dim: true, sound: "chime", autoBreak: true, autoNext: false, notify: true };
const FOCUS_IDLE = { phase: "idle", endsAt: 0, left: 0, paused: false, round: 0, startedAt: 0, next: "focus" };

function readFocus(raw) {
  try {
    const s = JSON.parse(raw || "null");
    return Object.assign({}, FOCUS_DEFAULTS, s && s.settings && s.settings.focus);
  } catch { return Object.assign({}, FOCUS_DEFAULTS); }
}
function focusBlocks(state, prefs) {
  return !!(state && state.phase === "focus" && !state.paused && prefs.block);
}
const phaseMinutes = (phase, prefs) => Math.max(1, Math.min(180, Number(prefs[phase === "focus" ? "work" : phase]) || FOCUS_DEFAULTS[phase === "focus" ? "work" : phase]));

async function focusGet() {
  const o = await chrome.storage.local.get([FOCUS_KEY, "appearance"]);
  return { state: Object.assign({}, FOCUS_IDLE, o[FOCUS_KEY]), prefs: readFocus(o.appearance) };
}

/* every change goes through here, one at a time */
let focusChain = Promise.resolve();
function focusDo(fn) {
  focusChain = focusChain.then(async () => {
    const { state, prefs } = await focusGet();
    const next = await fn(state, prefs);
    if (!next) return;
    await chrome.storage.local.set({ [FOCUS_KEY]: next });
    await chrome.alarms.clear(FOCUS_ALARM);
    if (next.phase !== "idle" && !next.paused) chrome.alarms.create(FOCUS_ALARM, { when: next.endsAt });
  }).catch((e) => console.error("Atlas focus:", e));
  return focusChain;
}

const startPhase = (state, prefs, phase) => Object.assign({}, state, {
  phase, paused: false, left: 0, startedAt: Date.now(),
  endsAt: Date.now() + phaseMinutes(phase, prefs) * 60000,
});

async function logFocus(start, end, planned, done) {
  const min = Math.round((end - start) / 60000);
  if (min < 1) return;
  const o = await chrome.storage.local.get([FOCUS_HIST]);
  const list = Array.isArray(o[FOCUS_HIST]) ? o[FOCUS_HIST] : [];
  list.push({ id: "f" + start.toString(36), start, end, min: Math.min(min, planned), done });
  await chrome.storage.local.set({ [FOCUS_HIST]: list.slice(-FOCUS_HIST_MAX) });
}

/* a phase ran out: log it, ring, and move on */
function focusFinish() {
  return focusDo(async (s, prefs) => {
    if (s.phase === "idle" || s.paused || s.endsAt > Date.now() + 1000) return null;
    let next;
    let title;
    let body;
    if (s.phase === "focus") {
      await logFocus(s.startedAt, s.endsAt, phaseMinutes("focus", prefs), true);
      const round = s.round + 1;
      const brk = round % Math.max(1, prefs.every) === 0 ? "long" : "short";
      next = prefs.autoBreak
        ? startPhase(Object.assign({}, s, { round }), prefs, brk)
        : Object.assign({}, FOCUS_IDLE, { round, next: brk });
      title = "Focus session done";
      body = "Time for a " + phaseMinutes(brk, prefs) + "-minute break." + (prefs.autoBreak ? "" : " Start it from the new tab.");
    } else {
      const round = s.phase === "long" ? 0 : s.round;
      next = prefs.autoNext
        ? startPhase(Object.assign({}, s, { round }), prefs, "focus")
        : Object.assign({}, FOCUS_IDLE, { round, next: "focus" });
      title = "Break's over";
      body = prefs.autoNext ? "Next focus session started." : "Ready for the next focus session?";
    }
    if (prefs.notify) {
      chrome.notifications.create("focus:" + Date.now(), {
        type: "basic", iconUrl: "assets/icons/icon-128.png", title, message: body, priority: 1, silent: prefs.sound !== "none",
      }).catch(() => {});
    }
    if (prefs.sound !== "none") playAlarm(prefs.sound, await getPrefs(), true);
    return next;
  });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("focus:")) return;
  const act = msg.type.slice(6);
  focusDo(async (s, prefs) => {
    const now = Date.now();
    if (act === "start") {
      const phase = ["focus", "short", "long"].includes(msg.phase) ? msg.phase : s.next || "focus";
      if (s.phase === "focus") await logFocus(s.startedAt, s.paused ? s.endsAt : now, phaseMinutes("focus", prefs), false);
      return startPhase(s, prefs, phase);
    }
    if (s.phase === "idle") return null;
    if (act === "pause" && !s.paused) return Object.assign({}, s, { paused: true, left: Math.max(0, s.endsAt - now), endsAt: now });
    if (act === "resume" && s.paused) {
      /* the paused time doesn't count: move the start forward by it */
      const pausedFor = now - s.endsAt;
      return Object.assign({}, s, { paused: false, startedAt: s.startedAt + pausedFor, endsAt: now + s.left, left: 0 });
    }
    if (act === "stop" || act === "skip") {
      const end = s.paused ? s.endsAt : now;
      if (s.phase === "focus") await logFocus(s.startedAt, end, phaseMinutes("focus", prefs), false);
      if (act === "stop") return Object.assign({}, FOCUS_IDLE, { round: s.round, next: "focus" });
      /* skip: straight on to what comes next, without ringing */
      if (s.phase === "focus") {
        const round = s.round + 1;
        return startPhase(Object.assign({}, s, { round }), prefs, round % Math.max(1, prefs.every) === 0 ? "long" : "short");
      }
      return startPhase(Object.assign({}, s, { round: s.phase === "long" ? 0 : s.round }), prefs, "focus");
    }
    return null;
  }).then(() => reply({ ok: true }));
  return true;
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === FOCUS_ALARM) focusFinish(); });
/* a phase that ran out while Chrome was closed ends on the next start */
chrome.runtime.onStartup.addListener(focusFinish);
focusFinish();

/* ================= STATS =================================================
   For the stats dashboard (stats.js). Counts the seconds the active tab's
   site is in front of you — Chrome focused, and you at the computer (or
   the tab playing sound) — and the times a blocked site was opened.
   "stats:days" = { "YYYY-MM-DD": { t: { host: seconds }, b: { host: n } } },
   the last STATS_KEEP days, on this computer only. The site in front is
   remembered in storage.session ("stats:cur") while the worker sleeps.  */
const STATS_KEY = "stats:days";
const STATS_CUR = "stats:cur";
const STATS_ALARM = "stats:tick";
const STATS_KEEP = 62;
const STATS_MAX_CHUNK = 120; // s; one step never counts more (sleep, a stalled worker)
const STATS_MAX_HOSTS = 400; // per day

const dayOf = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const hostOf = (url) => {
  if (!/^https?:/.test(url || "")) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

async function statsUpdate(fn) {
  const o = await chrome.storage.local.get([STATS_KEY]);
  const days = o[STATS_KEY] && typeof o[STATS_KEY] === "object" ? o[STATS_KEY] : {};
  fn(days);
  const keys = Object.keys(days).sort();
  keys.slice(0, Math.max(0, keys.length - STATS_KEEP)).forEach((k) => delete days[k]);
  await chrome.storage.local.set({ [STATS_KEY]: days });
}

/* the site in front right now, or "" */
async function frontHost() {
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) return "";
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id }).catch(() => []);
  if (!tab) return "";
  const idle = chrome.idle ? await chrome.idle.queryState(120).catch(() => "active") : "active";
  if (idle !== "active" && !tab.audible) return "";
  return hostOf(tab.url);
}

/* close the running chunk and start the next; one at a time */
let statsChain = Promise.resolve();
function statsStep() {
  statsChain = statsChain.then(async () => {
    const now = Date.now();
    const cur = (await chrome.storage.session.get([STATS_CUR]))[STATS_CUR];
    if (cur && cur.host && cur.since) {
      const secs = Math.min(STATS_MAX_CHUNK, Math.round((now - cur.since) / 1000));
      if (secs > 0) {
        await statsUpdate((days) => {
          const d = (days[dayOf(now)] = days[dayOf(now)] || { t: {}, b: {} });
          if (d.t[cur.host] != null || Object.keys(d.t).length < STATS_MAX_HOSTS) d.t[cur.host] = (d.t[cur.host] || 0) + secs;
        });
      }
    }
    const host = await frontHost();
    await chrome.storage.session.set({ [STATS_CUR]: host ? { host, since: now } : null });
  }).catch((e) => console.error("Atlas stats:", e));
  return statsChain;
}

chrome.tabs.onActivated.addListener(statsStep);
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.url && tab.active) statsStep(); });
chrome.windows.onFocusChanged.addListener(statsStep);
if (chrome.idle) {
  chrome.idle.setDetectionInterval(120);
  chrome.idle.onStateChanged.addListener(statsStep);
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === STATS_ALARM) statsStep(); });
chrome.alarms.get(STATS_ALARM).then((a) => { if (!a) chrome.alarms.create(STATS_ALARM, { periodInMinutes: 1 }); });

/* blocked.html: a blocked site was opened */
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "stats:blocked" || typeof msg.site !== "string") return;
  const site = msg.site.toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 100);
  if (!site) return;
  statsChain = statsChain.then(() => statsUpdate((days) => {
    const d = (days[dayOf(Date.now())] = days[dayOf(Date.now())] || { t: {}, b: {} });
    d.b = d.b || {};
    d.b[site] = (d.b[site] || 0) + 1;
  })).catch(() => {});
});

/* ================= SYNC STAMPS ===========================================
   Automatic sync (sync.js, Atlas Pro) needs to know when each synced value
   last changed on this computer. Every page would see the same change, so
   the stamping happens here, once: "sync:meta" = { key: time }.
   sync.js writes values it brings from the account together with
   "sync:meta" in one set — such a change isn't stamped again.            */
const SYNC_KEYS = ["appearance", "layout", "qt:tasks", "qt:habits", "reminders", "alarmPrefs", "focus:history", "vault"];
const SYNC_META = "sync:meta";

let syncMetaChain = Promise.resolve();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || changes[SYNC_META]) return;
  const keys = SYNC_KEYS.filter((k) => changes[k] && JSON.stringify(changes[k].oldValue) !== JSON.stringify(changes[k].newValue));
  if (!keys.length) return;
  const now = Date.now();
  syncMetaChain = syncMetaChain.then(async () => {
    const o = await chrome.storage.local.get([SYNC_META]);
    const meta = Object.assign({}, o[SYNC_META]);
    keys.forEach((k) => { meta[k] = Math.max(now, (meta[k] || 0) + 1); });
    await chrome.storage.local.set({ [SYNC_META]: meta });
  }).catch(() => {});
});
