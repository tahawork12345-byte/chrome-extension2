/* ATLAS NEW TAB — online wallpapers
   Customize > Background > Online library. Two sources, each switched on
   in the backend's .env (GET /wallpapers/sources says which), both shown
   straight from their own servers (nothing is copied or re-hosted):
     - still 4K wallpapers from Wallhaven (WALLHAVEN_URL, SFW only), called
       from here — it needs no key;
     - live wallpapers from Pixabay Videos, searched through the backend
       (GET /wallpapers/live) so the API key stays there. Everyone sees the
       thumbnails; the video link is only in the answer for Pro.
   The chosen one is kept in settings.background.online (mode "online")
   and app.js shows it. Search results live in memory for this page only.
   Starred wallpapers are kept in "wp:favs" (newest first, synced with the
   account): the Favourites kind, and first in All.
   Loads before app.js, which waits for `ready`.                          */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  const A = window.AtlasAccount;
  if (!AS || typeof WALLPAPERS === "undefined") return;

  const API = String((typeof ACCOUNT_CONFIG !== "undefined" && ACCOUNT_CONFIG.api) || "").replace(/\/+$/, "");

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  if (hasChrome) chrome.storage.local.remove(["wp:catalog", "wp:autoKey"]); // left by the old premium library
  const FAVS_KEY = "wp:favs";
  const MAX_FAVS = 300;

  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  const isPro = () => !!(A && A.isPro());
  const https = (u) => typeof u === "string" && /^https:\/\//.test(u);

  /* ---------- the online library ----------
     still: Wallhaven's filters (none = no stills); live: include Pixabay
     (a string: what to search Pixabay for instead of the topic); topic:
     Wallhaven's tag, added to the search or the search itself when the box
     is empty. With no search typed, a kind shows its most popular
     wallpapers of the year (Wallhaven's toplist), not just any match. */
  const HD = { categories: "111", atleast: "1920x1080" };
  const FILTERS = [
    { id: "favs", label: "★ Favourites", favs: true },
    { id: "all", label: "All", still: HD, live: true },
    { id: "4k", label: "4K", still: { categories: "111", atleast: "3840x2160" } },
    { id: "live", label: "Live", live: true },
    { id: "anime", label: "Anime", still: { categories: "010", atleast: "1920x1080" } },
    { id: "nature", label: "Nature", still: { categories: "100", atleast: "1920x1080" }, live: true, topic: "nature" },
    { id: "space", label: "Space", still: HD, live: true, topic: "space" },
    { id: "city", label: "Cityscape", still: HD, live: "city night", topic: "cityscape" },
    { id: "mountains", label: "Mountains", still: HD, live: true, topic: "mountains" },
    { id: "ocean", label: "Ocean", still: HD, live: "ocean", topic: "sea" },
    { id: "sunset", label: "Sunset", still: HD, live: true, topic: "sunset" },
    { id: "forest", label: "Forest", still: HD, live: true, topic: "forest" },
    { id: "snow", label: "Snow", still: HD, live: true, topic: "snow" },
    { id: "minimal", label: "Minimal", still: HD, topic: "minimalism" },
    { id: "abstract", label: "Abstract", still: HD, live: true, topic: "abstract" },
    { id: "dark", label: "Dark", still: HD, topic: "dark" },
    { id: "cyberpunk", label: "Cyberpunk", still: HD, live: "neon city", topic: "cyberpunk" },
    { id: "fantasy", label: "Fantasy", still: HD, topic: "fantasy art" },
    { id: "architecture", label: "Architecture", still: HD, topic: "architecture" },
    { id: "cars", label: "Cars", still: HD, live: "sports car", topic: "car" },
    { id: "games", label: "Games", still: HD, topic: "video games" },
  ];

  /* which sources the server has on: { pixabay: bool, wallhaven: url | null }.
     A failed ask isn't kept, so the next search asks again. */
  let sources = null;
  async function loadSources() {
    if (sources) return sources;
    if (!API) throw new Error("Online wallpapers need the Atlas server (ACCOUNT_CONFIG.api in config.js).");
    let d;
    try {
      const r = await fetch(API + "/wallpapers/sources");
      if (!r.ok) throw new Error();
      d = await r.json();
    } catch { throw new Error("Can't reach the Atlas server. Check your connection."); }
    sources = { pixabay: !!d.pixabay, wallhaven: https(d.wallhaven) ? d.wallhaven : null };
    return sources;
  }
  const available = (f) => !!sources && (f.favs ? favs.length > 0 : (f.still && !!sources.wallhaven) || (f.live && sources.pixabay));

  async function stills(f, q, typed, page) {
    const p = new URLSearchParams({ purity: "100", categories: f.still.categories, atleast: f.still.atleast, ratios: "landscape", page: String(page) });
    if (q) p.set("q", q);
    /* a search typed in: the best matches; a kind alone: the year's most
       popular; nothing at all: this month's */
    if (typed) p.set("sorting", "relevance");
    else { p.set("sorting", "toplist"); p.set("topRange", q ? "1y" : "1M"); }
    let r;
    const url = new URL(sources.wallhaven);
    p.forEach((v, k) => url.searchParams.set(k, v));
    try { r = await fetch(url); } catch { throw new Error("Can't reach Wallhaven. Check your connection."); }
    if (r.status === 429) throw new Error("Wallhaven is busy. Try again in a minute.");
    if (!r.ok) throw new Error("Wallhaven answered " + r.status + ".");
    const d = await r.json();
    const items = (d.data || []).filter((w) => w && w.id && https(w.path) && w.thumbs && https(w.thumbs.large)).map((w) => ({
      key: "wh:" + w.id,
      source: "wallhaven",
      kind: "image",
      thumb: w.thumbs.large,
      src: w.path,
      width: Number(w.dimension_x) || 0,
      height: Number(w.dimension_y) || 0,
      credit: "",
      creditUrl: "",
      link: https(w.url) ? w.url : "",
    }));
    const meta = d.meta || {};
    return { items, more: Number(meta.current_page) < Number(meta.last_page) };
  }

  async function lives(q, page) {
    if (!API) throw new Error("Live wallpapers need the Atlas server (ACCOUNT_CONFIG.api in config.js).");
    const path = "/wallpapers/live?" + new URLSearchParams({ q, page: String(page) });
    const d = A && A.signedIn()
      ? await A.api(path)
      : await fetch(API + path).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Live wallpapers answered " + r.status + ".");
        return body;
      }, () => { throw new Error("Can't reach the Atlas server. Check your connection."); });
    const items = (d.items || []).filter((v) => v && v.id && https(v.thumb)).map((v) => ({
      key: "pb:" + v.id,
      source: "pixabay",
      kind: "video",
      thumb: v.thumb,
      src: https(v.video) ? v.video : null, // null: locked (not Pro)
      width: Number(v.width) || 0,
      height: Number(v.height) || 0,
      credit: String(v.credit || "").slice(0, 80),
      creditUrl: https(v.creditUrl) ? v.creditUrl : "",
      link: https(v.link) ? v.link : "",
    }));
    return { items, more: !!d.more };
  }

  /* ---------- favourites ---------- */
  let favs = []; // the items as the library gave them, newest first
  const cleanFav = (v) => (v && typeof v.key === "string" && /^(wh|pb):/.test(v.key) && https(v.thumb) ? {
    key: v.key.slice(0, 40),
    source: v.source === "pixabay" ? "pixabay" : "wallhaven",
    kind: v.kind === "video" ? "video" : "image",
    thumb: v.thumb,
    src: https(v.src) ? v.src : null,
    width: Number(v.width) || 0,
    height: Number(v.height) || 0,
    credit: String(v.credit || "").slice(0, 80),
    creditUrl: https(v.creditUrl) ? v.creditUrl : "",
    link: https(v.link) ? v.link : "",
  } : null);
  const readFavs = (list) => (Array.isArray(list) ? list.map(cleanFav).filter(Boolean).slice(0, MAX_FAVS) : []);
  const isFav = (key) => favs.some((f) => f.key === key);

  /* what the grid shows when it changes: Favourites follows the list */
  function favsChanged() {
    if (lib && lib.filter === "favs" && !favs.length) return browse("all", ""); // the last one went
    if (lib && lib.filter === "favs") lib.items = lib.q ? lib.items.filter((i) => isFav(i.key)) : favs.slice();
    emit();
  }
  function toggleFav(item) {
    const it = cleanFav(item);
    if (!it) return false;
    const on = !isFav(it.key);
    favs = on ? [it, ...favs].slice(0, MAX_FAVS) : favs.filter((f) => f.key !== it.key);
    if (hasChrome) chrome.storage.local.set({ [FAVS_KEY]: favs });
    favsChanged();
    return on;
  }
  const favsLoaded = new Promise((r) => (hasChrome ? chrome.storage.local.get([FAVS_KEY], r) : r({})))
    .then((o) => { favs = readFavs(o[FAVS_KEY]); });
  /* starred in another tab, or arrived by sync */
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[FAVS_KEY]) return;
    favs = readFavs(ch[FAVS_KEY].newValue);
    favsChanged();
  });

  /* one search at a time; a new one drops the answers of the last */
  let lib = null;
  let seq = 0;
  const filterOf = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

  async function browse(filter, q) {
    const my = ++seq;
    const side = () => ({ page: 0, more: false, error: "" });
    lib = { filter: filterOf(filter).id, q: String(q || "").trim().slice(0, 80), items: [], still: side(), live: side(), loading: true };
    emit();
    try { await loadSources(); } catch (err) {
      if (my !== seq) return;
      lib.loading = false;
      lib.still.error = err.message;
      return emit();
    }
    await favsLoaded;
    if (my !== seq) return;
    /* a kind whose source is off (or Favourites, empty) falls back to the
       first one that's on */
    const f = available(filterOf(filter)) ? filterOf(filter) : FILTERS.find((x) => !x.favs && available(x));
    lib.loading = false;
    if (!f) {
      lib.still.error = "No wallpaper sources are turned on (PIXABAY / WALLHAVEN on the server).";
      return emit();
    }
    lib.filter = f.id;
    /* Favourites: the saved list, searched by who made it or where from */
    if (f.favs) {
      const words = lib.q.toLowerCase().split(/\s+/).filter(Boolean);
      const text = (i) => [i.credit, i.source, i.kind === "video" ? "live video" : "image", i.width >= 3840 ? "4k" : ""].join(" ").toLowerCase();
      lib.items = favs.filter((i) => words.every((w) => text(i).includes(w)));
      return emit();
    }
    /* All, with nothing typed: the favourites come first */
    if (f.id === "all" && !lib.q) lib.items = favs.slice();
    lib.still.more = !!f.still && !!sources.wallhaven;
    lib.live.more = !!f.live && sources.pixabay;
    return more();
  }

  async function more() {
    if (!lib || lib.loading || !(lib.still.more || lib.live.more)) return;
    const my = seq;
    const f = filterOf(lib.filter);
    const join = (topic) => (topic ? (lib.q ? lib.q + " " + topic : topic) : lib.q);
    const q = join(f.topic);
    const liveQ = join(typeof f.live === "string" ? f.live : f.topic);
    lib.loading = true;
    emit();
    const fail = (err) => ({ error: (err && err.message) || "Something went wrong." });
    const [a, b] = await Promise.all([
      lib.still.more ? stills(f, q, !!lib.q, lib.still.page + 1).catch(fail) : null,
      lib.live.more ? lives(liveQ, lib.live.page + 1).catch(fail) : null,
    ]);
    if (my !== seq) return;
    const take = (res, side) => {
      if (!res) return [];
      if (res.error) { side.error = res.error; side.more = false; return []; }
      side.page++;
      side.more = res.more && res.items.length > 0;
      return res.items;
    };
    const x = take(a, lib.still);
    const y = take(b, lib.live);
    /* stills and videos take turns */
    const seen = new Set(lib.items.map((i) => i.key));
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      [x[i], y[i]].forEach((it) => { if (it && !seen.has(it.key)) { seen.add(it.key); lib.items.push(it); } });
    }
    lib.loading = false;
    emit();
  }

  /* signed in or out, or the plan changed: the video links change too
     (the session also changes on every token refresh — that's no reason) */
  const ready = Promise.resolve(A ? A.ready : null).catch(() => {});
  let who = "";
  ready.then(() => { who = (A && A.signedIn()) + ":" + isPro(); });
  if (A) A.on(() => {
    const now = A.signedIn() + ":" + isPro();
    if (now === who) return;
    who = now;
    if (lib) browse(lib.filter, lib.q);
    else emit();
  });

  window.AtlasLibrary = {
    ready,
    /* the kinds whose source is on (none until the server has said) */
    filters: () => FILTERS.filter(available).map((f) => ({ id: f.id, label: f.label })),
    sources: () => sources,
    state: () => lib,
    browse,
    more,
    isPro,
    isFav,
    toggleFav,
    on: (fn) => listeners.push(fn),
  };
})();
