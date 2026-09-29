/* ATLAS NEW TAB — blocked page
   Where a blocked site lands (background.js, "SITE BLOCKER"). The site is
   in the hash: blocked.html#youtube.com                                   */
(() => {
  "use strict";
  const site = decodeURIComponent(location.hash.slice(1)).replace(/[^a-z0-9.-]/gi, "");
  const $ = (id) => document.getElementById(id);
  $("site").textContent = site;
  document.title = "Blocked · " + site;
  /* for the stats dashboard; a reload of this page isn't a new attempt */
  const nav = performance.getEntriesByType("navigation")[0];
  if (site && !(nav && nav.type === "reload")) chrome.runtime.sendMessage({ type: "stats:blocked", site }).catch(() => {});

  chrome.storage.local.get(["appearance", "focus:state"], (o) => {
    let b = null;
    try { b = JSON.parse(o.appearance || "null").settings.blocker; } catch {}
    if (!b) return;
    if (b.message) $("msg").textContent = b.message;
    /* blocked by a focus session (focus.js): no breaks until it ends */
    const f = o["focus:state"];
    if (f && f.phase === "focus" && !f.paused) {
      const end = new Date(f.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      $("until").textContent = "You're in a focus session until " + end + ".";
      $("until").hidden = false;
      return;
    }
    if (b.schedule && b.to) {
      $("until").textContent = "Blocked until " + b.to + ".";
      $("until").hidden = false;
    }
    $("break").hidden = !b.breaks;
  });

  $("home").addEventListener("click", () => chrome.tabs.update({ url: "chrome://newtab/" }));
  $("break").addEventListener("click", () => {
    $("break").disabled = true;
    chrome.runtime.sendMessage({ type: "blocker:break", minutes: 5 }, (r) => {
      if (r && r.ok && site) location.replace("https://" + site);
      else $("break").disabled = false;
    });
  });
})();
