/* ATLAS NEW TAB — cursor on websites
   Reads the cursor chosen in Customize and applies it to the page, and
   follows changes live. Runs in every frame at document_start; draws
   nothing unless "Use on all websites" is on.                             */

(() => {
  "use strict";
  if (!window.AtlasCursors || !chrome.storage) return;

  let styleEl = null;

  function apply(raw) {
    let s = null;
    try { s = JSON.parse(raw || "null"); } catch {}
    s = s && s.settings;
    const cfg = s && s.cursor;
    const text = cfg && cfg.everywhere ? AtlasCursors.css(cfg, s.theme && s.theme.accent) : "";

    if (!text) {
      if (styleEl) styleEl.textContent = "";
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "atlas-cursor";
    }
    styleEl.textContent = text;
    /* at document_start there may be no <head> yet; the root is always there */
    if (!styleEl.isConnected) (document.head || document.documentElement).append(styleEl);
  }

  chrome.storage.local.get(["appearance"], (o) => apply(o.appearance));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.appearance) apply(changes.appearance.newValue);
  });
})();
