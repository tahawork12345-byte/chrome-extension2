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
async function playAlarm(sound, prefs) {
  try {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ target: "alarm", type: "alarm:play", sound, volume: prefs.volume, maxMs: prefs.ringFor * 1000 }).catch(() => {});
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
