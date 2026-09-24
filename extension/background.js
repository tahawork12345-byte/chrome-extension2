/* ATLAS NEW TAB — background worker
   Keeps one entry per tab that is playing (or has played) media, picks the
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
    const data = msg.data;
    mutate((s) => {
      if (!data) {
        if (!s[tab.id]) return false;
        delete s[tab.id];
        return;
      }
      const prev = s[tab.id];
      s[tab.id] = Object.assign({}, data, {
        tabId: tab.id,
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
    chrome.tabs
      .sendMessage(msg.tabId, { type: "media:cmd", action: msg.action, time: msg.time })
      .catch(() => {
        /* the tab no longer answers (closed or reloaded before the bridge) */
        mutate((s) => { if (!s[msg.tabId]) return false; delete s[msg.tabId]; });
      });
    return;
  }

  if (msg.type === "media:focus" && typeof msg.tabId === "number") {
    chrome.tabs.update(msg.tabId, { active: true }).catch(() => {});
    if (typeof msg.windowId === "number") chrome.windows.update(msg.windowId, { focused: true }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mutate((s) => { if (!s[tabId]) return false; delete s[tabId]; });
});

/* content scripts only reach pages loaded after the extension. When it is
   installed or reloaded, add them to the tabs that are already open, so a
   song that is already playing shows up without refreshing its tab. */
chrome.runtime.onInstalled.addListener(async () => {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }); } catch { return; }
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["media-bridge.js"], world: "MAIN" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["media-relay.js"] });
    } catch {
      /* discarded tabs, the Web Store, chrome:// pages: skip */
    }
  }
});
