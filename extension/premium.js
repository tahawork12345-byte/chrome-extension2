/* ATLAS NEW TAB — premium wallpapers (Atlas Pro)
   The library of 4K live wallpapers comes from the backend (GET
   /wallpapers; its list is backend/src/data/wallpapers.js). Everyone sees
   the list and the thumbnails; for Pro, the answer also has the video
   links, and those wallpapers join WALLPAPERS (id "p-…") so the rest of
   the page treats them like the built-in ones. The list is kept in
   "wp:catalog" and re-read daily, and when Customize > Background opens.

   "Change by itself" (settings.background.auto, Pro) picks a wallpaper
   whose tags fit the time of day ("time") or the weather card's current
   weather ("weather"). It changes when that period changes — a wallpaper
   picked by hand holds until then. Loads before app.js, which waits for
   `ready` so a premium wallpaper can be the one the page opens with.    */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  const A = window.AtlasAccount;
  if (!AS || typeof WALLPAPERS === "undefined") return;

  const API = String((typeof ACCOUNT_CONFIG !== "undefined" && ACCOUNT_CONFIG.api) || "").replace(/\/+$/, "");
  const CACHE = "wp:catalog";   // { at, items, pro }
  const AUTO_KEY = "wp:autoKey"; // the period the last automatic pick was for
  const REFRESH_EVERY = 24 * 3600 * 1000;
  const NEW_DAYS = 30;
  const PREFIX = "p-";
  const TIME = ["morning", "day", "evening", "night"];
  const WEATHER = ["clear", "cloudy", "rain", "snow", "fog", "storm"];

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const get = (keys) => new Promise((r) => (hasChrome ? chrome.storage.local.get(keys, r) : r({})));
  const set = (obj) => new Promise((r) => (hasChrome ? chrome.storage.local.set(obj, r) : r()));

  let catalog = { at: 0, items: [], pro: false };
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  const isPro = () => !!(A && A.isPro());

  /* the unlocked library joins WALLPAPERS; locked, it leaves again */
  function applyList() {
    for (let i = WALLPAPERS.length - 1; i >= 0; i--) if (WALLPAPERS[i].premium) WALLPAPERS.splice(i, 1);
    if (!isPro()) return;
    catalog.items.filter((w) => w.video).forEach((w) => {
      WALLPAPERS.push({ id: PREFIX + w.id, label: w.label, file: w.video, thumb: w.thumb, tags: w.tags || [], premium: true });
    });
  }

  function clean(items) {
    return (Array.isArray(items) ? items : []).filter((w) => w && typeof w.id === "string" && /^https:\/\//.test(w.thumb || "")).map((w) => ({
      id: w.id.slice(0, 60),
      label: String(w.label || w.id).slice(0, 60),
      category: String(w.category || "").slice(0, 40),
      tags: Array.isArray(w.tags) ? w.tags.filter((t) => typeof t === "string") : [],
      thumb: w.thumb,
      added: /^\d{4}-\d{2}-\d{2}$/.test(w.added) ? w.added : "",
      video: typeof w.video === "string" && /^https:\/\//.test(w.video) ? w.video : null,
    }));
  }

  let fetching = null;
  function refresh(force) {
    if (!API) return Promise.resolve();
    if (!force && Date.now() - catalog.at < REFRESH_EVERY) return Promise.resolve();
    if (fetching) return fetching;
    fetching = (async () => {
      const data = A && A.signedIn()
        ? await A.api("/wallpapers")
        : await fetch(API + "/wallpapers").then((r) => (r.ok ? r.json() : Promise.reject(new Error("wallpapers " + r.status))));
      catalog = { at: Date.now(), items: clean(data && data.items), pro: !!(data && data.pro) };
      await set({ [CACHE]: catalog });
      applyList();
      emit();
    })().catch((err) => console.warn("Atlas wallpapers:", err.message)).finally(() => { fetching = null; });
    return fetching;
  }

  const ready = Promise.all([A ? A.ready : null, get([CACHE])]).then(([, o]) => {
    const c = o[CACHE];
    if (c && Array.isArray(c.items)) catalog = { at: Number(c.at) || 0, items: clean(c.items), pro: !!c.pro };
    applyList();
  });
  ready.then(() => refresh(false));
  /* signed in or out, or the plan changed: the video links change too
     (the session also changes on every token refresh — that's no reason) */
  let who = "";
  ready.then(() => { who = (A && A.signedIn()) + ":" + isPro(); });
  if (A) A.on(() => {
    const now = A.signedIn() + ":" + isPro();
    if (now === who) return;
    who = now;
    applyList();
    emit();
    refresh(true);
  });

  /* ---------- "Change by itself" ---------- */
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function timeOfDay(d) {
    const hr = d.getHours();
    return hr >= 5 && hr < 11 ? "morning" : hr >= 11 && hr < 17 ? "day" : hr >= 17 && hr < 21 ? "evening" : "night";
  }
  /* WMO weather codes (the weather card's) -> a tag */
  function weatherTag(code) {
    if (code == null) return null;
    if (code <= 1) return "clear";
    if (code <= 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    return "cloudy";
  }
  /* no tags of a kind = fits any of that kind */
  const fits = (w, tag, kind) => { const t = (w.tags || []).filter((x) => kind.includes(x)); return !t.length || t.includes(tag); };
  const tagged = (w, tag) => (w.tags || []).includes(tag);
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

  async function wanted() {
    const mode = AS.get().background.auto;
    if (mode === "off" || !isPro()) return null;
    const now = new Date();
    const tod = timeOfDay(now);
    /* the night belongs to the day it started on */
    const day = ymd(new Date(now.getTime() - 5 * 3600 * 1000));
    let list = WALLPAPERS.filter((w) => fits(w, tod, TIME));
    let key = "time:" + tod + ":" + day;
    if (mode === "weather") {
      let w = null;
      try { w = JSON.parse((await get(["weatherCache"])).weatherCache || "null"); } catch {}
      const tag = w ? weatherTag(Number(w.code)) : null;
      if (!tag) return null; // no weather yet: leave it
      const byWeather = WALLPAPERS.filter((x) => fits(x, tag, WEATHER));
      const exact = byWeather.filter((x) => tagged(x, tag));
      const both = (exact.length ? exact : byWeather).filter((x) => fits(x, tod, TIME));
      list = both.length ? both : exact.length ? exact : byWeather;
      key = "weather:" + tag + ":" + tod + ":" + day;
    } else {
      const exact = list.filter((x) => tagged(x, tod));
      if (exact.length) list = exact;
    }
    if (!list.length) return null;
    return { key, id: list[hash(key) % list.length].id };
  }

  async function applyAuto(force) {
    if (!AS.app.autoWallpaper || AS.get().background.mode !== "video") return;
    const want = await wanted();
    if (!want) return;
    const o = await get([AUTO_KEY]);
    if (!force && o[AUTO_KEY] === want.key) return; // this period's pick is made; a hand pick holds
    await set({ [AUTO_KEY]: want.key });
    AS.app.autoWallpaper(want.id);
  }
  setInterval(() => applyAuto(false), 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) applyAuto(false); });
  AS.on((s, path) => { if (path === "background.auto") applyAuto(true); });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.weatherCache && AS.get().background.auto === "weather") applyAuto(false);
  });

  const isNew = (w) => w.added && Date.now() - new Date(w.added + "T00:00:00").getTime() < NEW_DAYS * 86400000;

  window.AtlasPremium = {
    ready,
    PREFIX,
    items: () => catalog.items,
    isPro,
    isNew,
    refresh,
    /* app.js calls this once the page's wallpaper is up */
    start: () => applyAuto(false),
    on: (fn) => listeners.push(fn),
  };
})();
