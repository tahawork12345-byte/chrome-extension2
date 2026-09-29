/* ATLAS NEW TAB — offscreen alarm player (see alarm.html) */
"use strict";

let stopCurrent = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "alarm") return;
  if (msg.type === "alarm:play") {
    if (stopCurrent) stopCurrent();
    AtlasSounds.play(msg.sound, { volume: msg.volume, loop: msg.loop !== false, maxMs: msg.maxMs || 60000 })
      .then((stop) => { stopCurrent = stop; });
  } else if (msg.type === "alarm:stop") {
    if (stopCurrent) stopCurrent();
    stopCurrent = null;
  }
});
