/* ATLAS NEW TAB — media relay (content script, isolated world)
   Carries now-playing state from media-bridge.js to the background worker,
   and play / pause / next / previous commands back to the page. */
(() => {
  "use strict";
  const TAG = "atlas-media";

  function toWorker(msg) {
    /* after the extension is reloaded, old pages lose their connection */
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
  }

  /* a fresh document replaces whatever this tab was playing before */
  toWorker({ type: "media:state", data: null });
  /* when injected into an already-open tab, ask the bridge for the current
     track straight away (it may have been running since before) */
  window.postMessage({ [TAG]: "resync" }, "*");

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[TAG] !== "state") return;
    toWorker({ type: "media:state", data: e.data.data });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "media:cmd") return;
    window.postMessage({ [TAG]: "cmd", action: msg.action, time: msg.time }, "*");
  });

  window.addEventListener("pagehide", () => toWorker({ type: "media:state", data: null }));
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.postMessage({ [TAG]: "resync" }, "*");
  });
})();
