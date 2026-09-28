/* ATLAS NEW TAB — microphone permission
   Opened from the new tab when the microphone is blocked. The permission
   belongs to the whole extension, so allowing it here allows voice typing
   on every new tab.                                                       */
(() => {
  "use strict";
  const msg = document.getElementById("msg");
  const btn = document.getElementById("allow");
  const say = (html, cls) => { msg.innerHTML = html; msg.className = cls || ""; };

  btn.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      say("Done — the microphone is allowed. You can close this tab and use voice typing on your new tab.", "ok");
      btn.textContent = "Close this tab";
      btn.onclick = () => window.close();
    } catch {
      say("Chrome is still blocking the microphone. Click the icon at the left of the address bar, set <b>Microphone</b> to <b>Allow</b>, then try again.", "err");
    }
  });
})();
