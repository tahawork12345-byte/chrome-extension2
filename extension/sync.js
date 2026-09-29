/* ATLAS NEW TAB — automatic sync (Atlas Pro)
   Keeps these stored values the same on every computer signed in to the
   account: the Customize settings, shortcuts, notes & goals, habits,
   reminders and their sound, focus history, and the private space (sent as
   the encrypted blob it already is — the password never leaves).

   How: background.js stamps each value with the time it last changed here
   ("sync:meta"). A sync sends the values changed since the last one
   ("sync:pushed") to PUT /sync; the server keeps the newest of each and
   answers with everything, and anything newer from another computer is
   written back — together with its stamp, so it isn't stamped again.
   One page syncs at a time (a Web Lock); it runs when a new tab opens, a
   few seconds after a change, and every few minutes.

   Settings, shortcuts and the private space are read once when the page
   loads, so when one of them arrives, a fresh page reloads itself and an
   older one offers a Reload button.                                      */

(() => {
  "use strict";
  const A = window.AtlasAccount;
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  if (!A || !hasChrome) return;

  const KEYS = ["appearance", "layout", "qt:tasks", "qt:habits", "qt:sessions", "reminders", "alarmPrefs", "focus:history", "vault"];
  const RELOAD_KEYS = ["appearance", "layout", "vault"];
  const META = "sync:meta";
  const PUSHED = "sync:pushed";
  const ON = "sync:auto";
  const STATUS = "sync:status"; // { at, ok, error, got, sent }
  const EVERY = 5 * 60 * 1000;

  const get = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
  const set = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));

  const loadedAt = Date.now();
  let touched = false;
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => { touched = true; }, { capture: true, once: true }));

  const listeners = [];
  const emit = (s) => listeners.forEach((fn) => { try { fn(s); } catch (e) { console.error(e); } });

  async function enabled() {
    await A.ready;
    const o = await get([ON]);
    return !!o[ON] && A.signedIn() && A.isPro();
  }

  /* marks this page's own writes (every sync write carries STATUS) */
  const PAGE = Math.random().toString(36).slice(2);
  async function run() {
    const o = await get(KEYS.concat(META, PUSHED));
    const meta = Object.assign({}, o[META]);
    const pushed = Object.assign({}, o[PUSHED]);
    /* a value with no stamp yet (sync was just turned on) is the oldest
       possible: the account's copy wins, if it has one */
    KEYS.forEach((k) => { if (o[k] !== undefined && !meta[k]) meta[k] = 1; });

    const out = {};
    KEYS.forEach((k) => { if (o[k] !== undefined && meta[k] > (pushed[k] || 0)) out[k] = { value: o[k], at: meta[k] }; });
    const res = await A.api("/sync", { method: "PUT", body: { keys: out } });
    const remote = (res && res.keys) || {};

    /* a change made here while the request was out is newer than both */
    const now = Object.assign({}, (await get([META]))[META]);
    const write = {};
    const got = [];
    let again = false;
    KEYS.forEach((k) => {
      const r = remote[k];
      const mine = Math.max(meta[k] || 0, now[k] || 0);
      if (out[k]) pushed[k] = Math.max(pushed[k] || 0, out[k].at);
      if (r && r.at > mine && r.value != null) {
        write[k] = r.value;
        now[k] = r.at;
        pushed[k] = r.at;
        got.push(k);
      } else if (!out[k] && o[k] !== undefined && mine > 1 && (!r || r.at < mine)) {
        pushed[k] = 0; // the account lost it (deleted): send it again
        again = true;
      }
      if (!now[k] && meta[k]) now[k] = meta[k];
    });
    await set(Object.assign(write, { [META]: now, [PUSHED]: pushed, [STATUS]: { at: Date.now(), ok: true, got: got.length, sent: Object.keys(out).length, by: PAGE } }));
    if (got.some((k) => RELOAD_KEYS.includes(k))) needReload();
    if (again) schedule(2000);
    return { got, sent: Object.keys(out) };
  }

  let busy = null;
  async function syncNow() {
    if (!(await enabled())) return null;
    if (busy) return busy;
    busy = (navigator.locks ? navigator.locks.request("atlas-sync", run) : run())
      .catch(async (err) => {
        await set({ [STATUS]: { at: Date.now(), ok: false, error: err.message, code: err.code || "", by: PAGE } });
        /* the plan ended: stop until it's turned on again */
        if (err.status === 402) await set({ [ON]: false });
        throw err;
      })
      .finally(() => { busy = null; emit(); });
    return busy;
  }

  let timer = 0;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(() => {}), ms);
  }

  /* ---------- "changed on another computer" ---------- */
  let toast = null;
  function needReload() {
    if (Date.now() - loadedAt < 6000 && !touched) return location.reload();
    if (toast) return;
    toast = document.createElement("div");
    toast.className = "sync-toast";
    toast.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = "Your settings changed on another computer.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reload";
    btn.addEventListener("click", () => location.reload());
    const x = document.createElement("button");
    x.type = "button";
    x.className = "sync-toast-x";
    x.textContent = "✕";
    x.setAttribute("aria-label", "Later");
    x.addEventListener("click", () => { toast.remove(); toast = null; });
    toast.append(text, btn, x);
    document.body.append(toast);
  }

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch[STATUS]) {
      /* another page synced; if it brought settings in, this page is stale */
      const by = ch[STATUS].newValue && ch[STATUS].newValue.by;
      if (by !== PAGE && RELOAD_KEYS.some((k) => ch[k])) needReload();
      emit();
      return;
    }
    if (!ch[META]) return;
    /* background.js stamped a change made here: send it soon. Only a page
       you're looking at does, so ten open tabs don't all try. */
    if (document.visibilityState === "visible") schedule(4000);
  });

  let last = 0;
  const tick = () => {
    if (document.visibilityState !== "visible" || Date.now() - last < 60000) return;
    last = Date.now();
    syncNow().catch(() => {});
  };
  document.addEventListener("visibilitychange", tick);
  setInterval(tick, EVERY);
  setTimeout(tick, 1200);

  /* ---------- for Customize > Account ---------- */
  async function setAuto(on) {
    await set({ [ON]: !!on });
    emit();
    if (on) return syncNow();
    return null;
  }
  /* turn it off here and delete the account's copy */
  async function forget() {
    await A.api("/sync", { method: "DELETE" });
    await set({ [ON]: false, [PUSHED]: {} });
    emit();
  }

  window.AtlasSync = {
    KEYS,
    isOn: () => get([ON]).then((o) => !!o[ON]),
    status: () => get([STATUS]).then((o) => o[STATUS] || null),
    setAuto,
    syncNow,
    forget,
    on: (fn) => listeners.push(fn),
  };
})();
