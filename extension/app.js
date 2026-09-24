/* ATLAS NEW TAB — app logic
   All user-editable content lives in config.js                */

(() => {
  "use strict";

  /* border light for cards; same markup as the one inside the search form */
  const TRACE_SVG =
    '<svg class="trace" aria-hidden="true">' +
    '<rect class="trace-line" pathLength="100"/></svg>';

  /* ---------- storage (chrome.storage.local with localStorage fallback) --- */
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const store = {
    get(keys) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.get(keys, r));
      const out = {};
      keys.forEach((k) => {
        const v = localStorage.getItem("atlas:" + k);
        if (v !== null) out[k] = v;
      });
      return Promise.resolve(out);
    },
    set(obj) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.set(obj, r));
      Object.entries(obj).forEach(([k, v]) => localStorage.setItem("atlas:" + k, v));
      return Promise.resolve();
    },
  };

  const $ = (id) => document.getElementById(id);

  /* ================= CLOCK (12-hour) ===================================== */
  const timeEl = $("time");
  const meridiemEl = $("meridiem");
  const dateEl = $("date");
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function renderClock(animate = false) {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const next = `${h}:${m}`;
    if (animate && timeEl.textContent !== next) {
      timeEl.classList.remove("is-tick");
      void timeEl.offsetWidth; // restart the animation
      timeEl.classList.add("is-tick");
    }
    timeEl.textContent = next;
    meridiemEl.textContent = ap;
    dateEl.textContent = `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  renderClock();
  // tick exactly on the next minute, then every minute
  setTimeout(function tick() {
    renderClock(true);
    setInterval(() => renderClock(true), 60000);
  }, (60 - new Date().getSeconds()) * 1000);

  /* the rail and launcher sit below the clock block; its height depends on
     the clamped font sizes and the weather card, so measure the real thing
     instead of guessing an offset */
  const clockEl = document.querySelector(".clock");
  function syncClockHeight() {
    if (!clockEl) return;
    const h = Math.ceil(clockEl.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty("--clock-h", h + "px");
  }
  syncClockHeight();
  addEventListener("resize", syncClockHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncClockHeight);
  if (clockEl && typeof ResizeObserver !== "undefined") new ResizeObserver(syncClockHeight).observe(clockEl);

  /* ================= WALLPAPER =========================================== */
  const layers = [$("videoA"), $("videoB")];
  let front = 0;
  let currentWp = null;

  function playSafe(v) {
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  function setWallpaper(id, instant = false) {
    const wp = WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
    if (currentWp === wp.id) return;
    currentWp = wp.id;

    const showing = layers[front];
    const next = layers[1 - front];

    if (instant || !showing.src) {
      showing.src = wp.file;
      showing.classList.add("is-active");
      next.classList.remove("is-active");
      playSafe(showing);
    } else {
      next.src = wp.file;
      playSafe(next);
      next.classList.add("is-active");
      showing.classList.remove("is-active");
      setTimeout(() => {
        if (!showing.classList.contains("is-active")) {
          showing.pause();
          showing.removeAttribute("src");
          showing.load();
        }
      }, 1000);
      front = 1 - front;
    }
    renderWpMenu();
    store.set({ wallpaper: wp.id });
  }

  /* step through the wallpaper list — used by the wallpaper commands so they
     share one implementation with the menu above */
  function stepWallpaper(delta) {
    if (!WALLPAPERS.length) return;
    const i = WALLPAPERS.findIndex((w) => w.id === currentWp);
    const next = (((i < 0 ? 0 : i + delta) % WALLPAPERS.length) + WALLPAPERS.length) % WALLPAPERS.length;
    setWallpaper(WALLPAPERS[next].id);
  }

  const wpMenu = $("wpMenu");
  function renderWpMenu() {
    wpMenu.innerHTML = "";
    WALLPAPERS.forEach((w) => {
      const b = document.createElement("button");
      b.textContent = w.label;
      if (w.id === currentWp) b.classList.add("is-on");
      b.addEventListener("click", () => {
        setWallpaper(w.id);
        wpMenu.hidden = true;
      });
      wpMenu.appendChild(b);
    });
  }
  $("wpToggle").addEventListener("click", (e) => {
    e.stopPropagation();
    wpMenu.hidden = !wpMenu.hidden;
    if (!wpMenu.hidden) {
      // the list scrolls past 3 entries — bring the current one into view
      const on = wpMenu.querySelector("button.is-on");
      if (on) on.scrollIntoView({ block: "nearest" });
    }
  });
  document.addEventListener("click", (e) => {
    if (!$("wpControl").contains(e.target)) wpMenu.hidden = true;
  });

  // save power when the tab isn't visible
  document.addEventListener("visibilitychange", () => {
    layers.forEach((v) => {
      if (!v.src) return;
      if (document.hidden) v.pause();
      else if (v.classList.contains("is-active")) playSafe(v);
    });
  });

  /* ================= ICONS =============================================== */
  function iconSrc(key) {
    if (!key) return "";
    if (key.includes("/") || key.includes(".")) return key; // direct path
    const file = (typeof ICONS !== "undefined" && ICONS[key]) || "";
    return file ? (typeof ICON_DIR !== "undefined" ? ICON_DIR : "assets/icons/") + file : "";
  }
  function makeIcon(item, cls) {
    const src = iconSrc(item.icon);
    if (src) {
      const img = document.createElement("img");
      img.className = cls;
      img.src = src;
      img.alt = "";
      img.loading = "eager";
      img.addEventListener("error", () => {
        const fb = document.createElement("span");
        fb.className = "tile-fallback";
        fb.textContent = item.name[0];
        img.replaceWith(fb);
      });
      return img;
    }
    const fb = document.createElement("span");
    fb.className = "tile-fallback";
    fb.textContent = item.name[0];
    return fb;
  }

  /* ================= LAYOUT DATA =========================================
     config.js ships the defaults; anything the user changes is persisted
     under the "layout" key and replaces them from then on. The shape is the
     same one config.js already uses, so every consumer below (launcher, rail,
     command center) reads it exactly as before — only the source changes. */
  const LAYOUT_KEY = "layout";
  const LAYOUT_VERSION = 1;

  /* the live model. Seeded from config.js, replaced by stored data at boot.
     Mutated in place so existing references stay valid. */
  const WORKSPACES = [];

  const uid = (p) =>
    p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

  const clone = (v) => JSON.parse(JSON.stringify(v));

  /* Defaults come from config.js. It is only read here, never written. */
  function defaultLayout() {
    const src = typeof DEFAULT_WORKSPACES !== "undefined" ? DEFAULT_WORKSPACES : [];
    return clone(src);
  }

  /* Normalising keeps the rest of the app free of defensive checks: every
     workspace has an id and a cards array, every card an id and items, every
     item a name and url. Anything unusable is dropped rather than rendered
     broken. Unknown fields are preserved so a future version can add some. */
  function normalizeLayout(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    const wsIds = new Set();

    list.forEach((ws) => {
      if (!ws || typeof ws !== "object") return;
      let id = typeof ws.id === "string" && ws.id ? ws.id : uid("ws");
      while (wsIds.has(id)) id = uid("ws");
      wsIds.add(id);

      const cardIds = new Set();
      const cards = (Array.isArray(ws.cards) ? ws.cards : []).reduce((acc, card) => {
        if (!card || typeof card !== "object") return acc;
        let cid = typeof card.id === "string" && card.id ? card.id : uid("card");
        while (cardIds.has(cid)) cid = uid("card");
        cardIds.add(cid);

        const items = (Array.isArray(card.items) ? card.items : []).reduce((ia, it) => {
          if (!it || typeof it !== "object") return ia;
          const name = typeof it.name === "string" ? it.name.trim() : "";
          const url = typeof it.url === "string" ? it.url.trim() : "";
          if (!name || !url) return ia;
          ia.push(
            Object.assign({}, it, {
              id: typeof it.id === "string" && it.id ? it.id : uid("item"),
              name,
              url,
              icon: typeof it.icon === "string" ? it.icon : "",
            })
          );
          return ia;
        }, []);

        acc.push(
          Object.assign({}, card, {
            id: cid,
            title: typeof card.title === "string" && card.title.trim() ? card.title.trim() : "Untitled",
            hint: typeof card.hint === "string" ? card.hint : "",
            items,
          })
        );
        return acc;
      }, []);

      out.push(Object.assign({}, ws, { id, name: typeof ws.name === "string" && ws.name.trim() ? ws.name.trim() : "Workspace", cards }));
    });

    /* never hand back something with no workspace to render */
    if (!out.length) return normalizeLayout(defaultLayout());
    return out;
  }

  /* Replace the contents of WORKSPACES without breaking references to it. */
  function applyLayout(list) {
    WORKSPACES.length = 0;
    normalizeLayout(list).forEach((ws) => WORKSPACES.push(ws));
  }

  let saveTimer = 0;
  function saveLayout() {
    /* coalesce bursts (e.g. a rename typed then confirmed) into one write */
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      store.set({
        [LAYOUT_KEY]: JSON.stringify({ v: LAYOUT_VERSION, workspaces: WORKSPACES }),
      });
    }, 120);
  }

  /* Reads whatever is in storage and works out what to do with it:
       - nothing stored            -> config.js defaults (first launch)
       - versioned {v, workspaces} -> use as-is
       - a bare array              -> data from before versioning; adopt it
     Corrupt JSON falls back to defaults rather than throwing.              */
  function loadLayout(stored) {
    if (!stored) return defaultLayout();
    let parsed;
    try {
      parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
    } catch {
      return defaultLayout();
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.workspaces)) return parsed.workspaces;
    return defaultLayout();
  }

  /* --- lookups used by the editing UI --- */
  const findWs = (id) => WORKSPACES.find((w) => w.id === id) || null;
  const currentWs = () => findWs(activeWs) || WORKSPACES[0] || null;
  function findCard(cardId) {
    const ws = currentWs();
    if (!ws) return null;
    return ws.cards.find((c) => c.id === cardId) || null;
  }

  /* move an element within its array; returns true when something moved */
  function moveBy(arr, index, delta) {
    const to = index + delta;
    if (index < 0 || to < 0 || to >= arr.length) return false;
    const [el] = arr.splice(index, 1);
    arr.splice(to, 0, el);
    return true;
  }

  /* ================= WORKSPACE RAIL + LAUNCHER ===========================
     The rail (left edge) switches workspaces. The launcher next to it shows
     the active workspace's sections as tabs — "All" plus one per section —
     and their shortcuts as a grid of round app icons. */
  const rail = $("rail");
  const tabsEl = $("launcherTabs");
  const toolsEl = $("launcherTools");
  const gridEl = $("launcherGrid");
  let activeWs = null; // set at boot, once the layout is loaded
  let tabs = {};       // workspace id -> "all" | section id, persisted
  let launcherOpen = false; // hidden until a rail icon is clicked
  const launcherEl = $("launcher");

  const ICON_PATHS = {
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
    work: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M4 13h16"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
    game: '<path d="M7.5 8h9a4 4 0 0 1 3.9 4.9l-.8 3.4a2 2 0 0 1-3.4.9L14.5 15h-5l-1.7 2.2a2 2 0 0 1-3.4-.9l-.8-3.4A4 4 0 0 1 7.5 8z"/><path d="M8.5 11v3M7 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17" cy="13.2" r=".6"/>',
    folder: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
    music: '<path d="M9 17V6l10-2v11"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="15" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
  };
  const svgIcon = (key) =>
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON_PATHS[key] + "</svg>";

  /* a workspace may name its own icon (ws.icon); otherwise guess from the name */
  function railIconKey(ws) {
    if (ws.icon && ICON_PATHS[ws.icon]) return ws.icon;
    const n = ws.name.toLowerCase();
    if (/personal|home|\bme\b|main/.test(n)) return "home";
    if (/work|office|job|business/.test(n)) return "work";
    if (/game|play|fun/.test(n)) return "game";
    if (/music|media|video|watch/.test(n)) return "music";
    if (/dev|code|build|eng/.test(n)) return "code";
    if (/study|read|learn|school|uni/.test(n)) return "book";
    if (/file|doc|project/.test(n)) return "folder";
    if (/web|browse|social|news/.test(n)) return "globe";
    return "";
  }

  function renderRail() {
    rail.textContent = "";
    rail.insertAdjacentHTML("afterbegin", TRACE_SVG); // border light
    WORKSPACES.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rail-btn";
      b.dataset.label = w.name;
      b.setAttribute("aria-label", w.name);
      const key = railIconKey(w);
      if (key) b.innerHTML = svgIcon(key);
      else {
        const letter = document.createElement("span");
        letter.className = "rail-letter";
        letter.textContent = w.name[0].toUpperCase();
        b.appendChild(letter);
      }
      if (w.id === activeWs) {
        b.classList.add("is-on");
        b.setAttribute("aria-current", "true");
      }
      b.setAttribute("aria-expanded", String(launcherOpen && w.id === activeWs));
      b.setAttribute("aria-controls", "launcher");
      /* the active workspace's icon opens / closes the launcher; another
         workspace's icon switches to it and opens */
      b.addEventListener("click", () => {
        if (w.id === activeWs) return setLauncherOpen(!launcherOpen);
        setWorkspace(w.id);
        setLauncherOpen(true);
      });
      rail.appendChild(b);
    });

    const sep = document.createElement("span");
    sep.className = "rail-sep";
    rail.appendChild(sep);

    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "rail-btn";
    gear.dataset.label = "Command Center (Ctrl+Space)";
    gear.setAttribute("aria-label", "Open Command Center");
    gear.innerHTML = svgIcon("settings");
    gear.addEventListener("click", () => openCommandCenter());
    rail.appendChild(gear);
  }

  function setLauncherOpen(open) {
    launcherOpen = open;
    document.body.classList.toggle("launcher-open", open);
    launcherEl.inert = !open; // nothing inside is focusable while hidden
    if (open) renderLauncher(); // replays the icons' entrance
    else closeMenu();
    renderRail();
  }
  launcherEl.inert = true;

  /* the section tab to show; falls back to "All" if it was deleted */
  function activeTab(ws) {
    const t = tabs[ws.id];
    return t && ws.cards.some((c) => c.id === t) ? t : "all";
  }

  function setTab(id) {
    const ws = currentWs();
    if (!ws) return;
    tabs[ws.id] = id;
    store.set({ launcherTabs: JSON.stringify(tabs) });
    renderLauncher();
  }

  function renderLauncher() {
    const ws = currentWs();
    /* any open ⋮ menu is anchored to a button that is about to be removed */
    if (typeof closeMenu === "function") closeMenu();
    tabsEl.textContent = "";
    toolsEl.textContent = "";
    gridEl.textContent = "";
    if (!ws) return;
    const tab = activeTab(ws);

    const addTab = (id, label, hint) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ltab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.textContent = label;
      if (hint) b.title = hint;
      if (id !== "all") {
        /* right-click on a section tab opens the same menu as its ⋮ */
        b.dataset.kind = "card";
        b.dataset.id = id;
        b.draggable = true;
      }
      if (id === tab) b.classList.add("is-on");
      b.addEventListener("click", () => setTab(id));
      tabsEl.appendChild(b);
    };
    addTab("all", "All");
    ws.cards.forEach((c) => addTab(c.id, c.title, c.hint));
    const on = tabsEl.querySelector(".is-on");
    if (on) {
      /* keep the chosen tab visible when the row overflows */
      const l = on.offsetLeft, r = l + on.offsetWidth;
      if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = l - 8;
      else if (r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = r - tabsEl.clientWidth + 8;
    }

    if (tab !== "all") toolsEl.appendChild(menuButton("card", tab, "Section options"));
    const addSection = document.createElement("button");
    addSection.type = "button";
    addSection.className = "ltool";
    addSection.dataset.act = "add-card";
    addSection.setAttribute("aria-label", "Add section");
    addSection.title = "Add section";
    addSection.textContent = "+";
    toolsEl.appendChild(addSection);

    const shown = tab === "all" ? ws.cards : ws.cards.filter((c) => c.id === tab);
    const entries = shown.flatMap((c) => c.items.map((it) => [c, it]));
    entries.forEach(([c, it], i) => gridEl.appendChild(renderApp(c, it, i)));

    /* "Add" goes into the open section, or the first one from "All" */
    const target = tab === "all" ? ws.cards[0] : findCard(tab);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "app app-add";
    add.style.setProperty("--i", Math.min(entries.length, 18));
    if (target) {
      add.dataset.act = "add-item";
      add.dataset.card = target.id;
    } else {
      add.dataset.act = "add-card";
    }
    add.innerHTML = '<span class="app-bubble" aria-hidden="true">+</span>';
    const addName = document.createElement("span");
    addName.className = "app-name";
    addName.textContent = target ? "Add" : "Add section";
    add.appendChild(addName);
    gridEl.appendChild(add);
  }

  function renderApp(card, it, i) {
    const cell = document.createElement("div");
    cell.className = "app";
    cell.style.setProperty("--i", Math.min(i, 18)); // entrance stagger
    cell.draggable = true;
    cell.dataset.card = card.id;
    cell.dataset.item = it.id;

    const a = document.createElement("a");
    a.className = "app-link";
    a.href = it.url;
    a.title = it.name;
    a.draggable = false; // the whole cell is dragged, not the link
    const bubble = document.createElement("span");
    bubble.className = "app-bubble";
    bubble.appendChild(makeIcon(it, "app-icon"));
    const nm = document.createElement("span");
    nm.className = "app-name";
    nm.textContent = it.name;
    a.append(bubble, nm);
    a.addEventListener("click", () => bumpUsage(it));

    cell.append(a, menuButton("item", it.id, "Shortcut options", card.id));
    return cell;
  }

  /* the ⋮ trigger; the menu itself is built on demand in openMenu() */
  function menuButton(kind, id, label, parent) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dots";
    b.dataset.act = "menu";
    b.dataset.kind = kind;
    b.dataset.id = id;
    if (parent) b.dataset.parent = parent;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.textContent = "⋮";
    return b;
  }

  /* the single place a workspace change happens — the rail and the command
     center both go through here, so persistence stays in one spot */
  function setWorkspace(id) {
    if (!WORKSPACES.some((w) => w.id === id) || id === activeWs) return;
    activeWs = id;
    store.set({ workspace: id });
    renderRail();
    renderLauncher();
  }

  /* right-click anywhere on an app or a section tab = its ⋮ menu */
  gridEl.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest(".app:not(.app-add)");
    const dots = cell && cell.querySelector(".dots");
    if (!dots) return;
    e.preventDefault();
    openMenu(dots);
  });
  tabsEl.addEventListener("contextmenu", (e) => {
    const t = e.target.closest(".ltab[data-kind]");
    if (!t) return;
    e.preventDefault();
    openMenu(t);
  });
  /* a mouse wheel scrolls the tab row sideways */
  tabsEl.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    tabsEl.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  /* --- drag and drop ---------------------------------------------------
     Apps: drag within the grid to reorder, onto a section tab to move them
     there, or onto the remove bar to delete (with undo).
     Tabs: drag sideways to reorder sections, or onto the remove bar.
     The DOM is rearranged live while dragging; the data is updated once on
     drop, and a cancelled drag simply re-renders the saved order. */
  const trash = $("launcherTrash");
  let drag = null; // { type: "app" | "tab", el, card, item?, done }

  const apps = () => Array.from(gridEl.querySelectorAll(".app[data-item]"));

  function startDrag(e, info) {
    drag = Object.assign({ done: false }, info);
    closeMenu();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    /* let the browser grab its drag image before the source goes faint */
    requestAnimationFrame(() => {
      if (!drag) return;
      drag.el.classList.add("is-dragging");
      document.body.classList.add("is-dragging");
    });
  }

  function endDrag() {
    if (!drag) return;
    const redraw = !drag.done;
    drag = null;
    document.body.classList.remove("is-dragging");
    trash.classList.remove("is-over");
    tabsEl.querySelectorAll(".is-drop").forEach((t) => t.classList.remove("is-drop"));
    if (redraw) renderLauncher(); // cancelled: put everything back
  }

  /* clean up before re-rendering: the redraw removes the dragged element,
     and a removed element's dragend never reaches the document */
  function finishDrop() {
    drag.done = true;
    endDrag();
    commit();
  }

  gridEl.addEventListener("dragstart", (e) => {
    const cell = e.target.closest(".app[data-item]");
    if (!cell) return;
    startDrag(e, { type: "app", el: cell, card: cell.dataset.card, item: cell.dataset.item });
  });
  tabsEl.addEventListener("dragstart", (e) => {
    const t = e.target.closest(".ltab[data-id]");
    if (!t) return;
    startDrag(e, { type: "tab", el: t, card: t.dataset.id });
  });
  document.addEventListener("dragend", endDrag);

  /* grid: live reorder under the pointer */
  gridEl.addEventListener("dragover", (e) => {
    if (!drag || drag.type !== "app") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const over = e.target.closest(".app");
    if (!over || over === drag.el) return;
    if (over.classList.contains("app-add")) {
      gridEl.insertBefore(drag.el, over); // never past the Add tile
      return;
    }
    const r = over.getBoundingClientRect();
    const before = e.clientX < r.left + r.width / 2;
    gridEl.insertBefore(drag.el, before ? over : over.nextSibling);
  });
  gridEl.addEventListener("drop", (e) => {
    if (!drag || drag.type !== "app") return;
    e.preventDefault();
    placeApp(drag.card, drag.item, drag.el);
    finishDrop();
  });

  /* tabs: reorder sections, or receive an app */
  tabsEl.addEventListener("dragover", (e) => {
    if (!drag) return;
    const t = e.target.closest(".ltab[data-id]");
    if (drag.type === "tab") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!t || t === drag.el) return;
      const r = t.getBoundingClientRect();
      tabsEl.insertBefore(drag.el, e.clientX < r.left + r.width / 2 ? t : t.nextSibling);
      return;
    }
    tabsEl.querySelectorAll(".is-drop").forEach((x) => x !== t && x.classList.remove("is-drop"));
    if (!t || t.dataset.id === drag.card) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    t.classList.add("is-drop");
  });
  tabsEl.addEventListener("dragleave", (e) => {
    const t = e.target.closest(".ltab");
    if (t && !t.contains(e.relatedTarget)) t.classList.remove("is-drop");
  });
  tabsEl.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    const ws = currentWs();
    if (drag.type === "tab") {
      const order = Array.from(tabsEl.querySelectorAll(".ltab[data-id]")).map((x) => x.dataset.id);
      ws.cards.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else {
      const t = e.target.closest(".ltab[data-id]");
      const from = findCard(drag.card);
      const to = t && findCard(t.dataset.id);
      if (!from || !to || from === to) return;
      const i = from.items.findIndex((it) => it.id === drag.item);
      if (i < 0) return;
      to.items.push(from.items.splice(i, 1)[0]);
    }
    finishDrop();
  });

  /* remove bar */
  trash.addEventListener("dragover", (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    trash.classList.add("is-over");
  });
  trash.addEventListener("dragleave", () => trash.classList.remove("is-over"));
  trash.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    const d = drag;
    d.done = true;
    endDrag();
    if (d.type === "tab") {
      renderLauncher();
      deleteCard(d.card); // asks first: a section can hold many shortcuts
      return;
    }
    const card = findCard(d.card);
    const i = card ? card.items.findIndex((it) => it.id === d.item) : -1;
    if (i < 0) return renderLauncher();
    const before = clone(WORKSPACES);
    const [gone] = card.items.splice(i, 1);
    commit();
    toast('Removed "' + gone.name + '"', () => {
      applyLayout(before);
      saveLayout();
      renderLauncher();
    });
  });

  /* put the dragged item into the data where it now sits in the grid: after
     the app before it, or before the app after it. In "All" this is also how
     an app changes section — it joins the section of its new neighbour. */
  function placeApp(cardId, itemId, cell) {
    const from = findCard(cardId);
    if (!from) return;
    const i = from.items.findIndex((it) => it.id === itemId);
    if (i < 0) return;
    const list = apps();
    const at = list.indexOf(cell);
    const prev = list[at - 1];
    const next = list[at + 1];
    const [item] = from.items.splice(i, 1);
    const anchor = prev || next;
    const card = anchor && findCard(anchor.dataset.card);
    if (!card) { from.items.splice(i, 0, item); return; }
    const j = card.items.findIndex((it) => it.id === anchor.dataset.item);
    card.items.splice(prev ? j + 1 : j, 0, item);
  }

  /* small "Removed … Undo" note above the search bar */
  const toastEl = $("toast");
  let toastTimer = 0;
  function toast(text, undo) {
    clearTimeout(toastTimer);
    toastEl.textContent = "";
    const msg = document.createElement("span");
    msg.textContent = text;
    toastEl.appendChild(msg);
    if (undo) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Undo";
      b.addEventListener("click", () => { toastEl.hidden = true; undo(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    toastTimer = setTimeout(() => (toastEl.hidden = true), 6000);
  }

  /* ================= EDITING =============================================
     Sections and shortcuts are edited in place. Every mutation goes through
     one of the apply* helpers below so that persisting and re-rendering
     happen in exactly one place.                                          */

  /* --- the ⋮ context menu --- */
  const ctxMenu = $("ctxMenu");
  let ctxOwner = null; // the ⋮ button the menu belongs to

  function closeMenu() {
    if (!ctxOwner) return;
    ctxOwner.setAttribute("aria-expanded", "false");
    ctxOwner = null;
    ctxMenu.hidden = true;
    ctxMenu.textContent = "";
  }

  function openMenu(btn) {
    const sameOwner = ctxOwner === btn;
    closeMenu();
    if (sameOwner) return; // clicking the same ⋮ twice closes it

    const { kind, id, parent } = btn.dataset;
    const entries = kind === "card" ? cardMenu(id) : itemMenu(parent, id);
    if (!entries.length) return;

    entries.forEach((e) => {
      if (e.sep) {
        const hr = document.createElement("div");
        hr.className = "ctx-sep";
        hr.setAttribute("role", "separator");
        ctxMenu.appendChild(hr);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.textContent = e.label;
      if (e.danger) b.className = "is-danger";
      if (e.disabled) b.disabled = true;
      else b.addEventListener("click", () => { closeMenu(); e.run(); });
      ctxMenu.appendChild(b);
    });

    ctxOwner = btn;
    btn.setAttribute("aria-expanded", "true");
    ctxMenu.hidden = false;
    positionMenu(btn);
    const first = ctxMenu.querySelector("button:not([disabled])");
    if (first) first.focus();
  }

  /* anchor under the ⋮, flipped when it would leave the viewport */
  function positionMenu(btn) {
    const r = btn.getBoundingClientRect();
    const m = ctxMenu.getBoundingClientRect();
    let left = r.right - m.width;
    let top = r.bottom + 6;
    if (left < 8) left = 8;
    if (left + m.width > innerWidth - 8) left = innerWidth - 8 - m.width;
    if (top + m.height > innerHeight - 8) top = r.top - m.height - 6;
    ctxMenu.style.left = Math.max(8, left) + "px";
    ctxMenu.style.top = Math.max(8, top) + "px";
  }

  function cardMenu(cardId) {
    const ws = currentWs();
    if (!ws) return [];
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (i < 0) return [];
    return [
      { label: "Rename section", run: () => editCard(cardId) },
      { label: "Add shortcut", run: () => editItem(cardId, null) },
      { label: "Move left", disabled: i === 0, run: () => moveCard(cardId, -1) },
      { label: "Move right", disabled: i === ws.cards.length - 1, run: () => moveCard(cardId, 1) },
      { sep: true },
      { label: "Delete section", danger: true, run: () => deleteCard(cardId) },
    ];
  }

  function itemMenu(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return [];
    const i = card.items.findIndex((it) => it.id === itemId);
    if (i < 0) return [];
    return [
      { label: "Edit shortcut", run: () => editItem(cardId, itemId) },
      { label: "Move left", disabled: i === 0, run: () => moveItem(cardId, itemId, -1) },
      { label: "Move right", disabled: i === card.items.length - 1, run: () => moveItem(cardId, itemId, 1) },
      { sep: true },
      { label: "Delete shortcut", danger: true, run: () => deleteItem(cardId, itemId) },
    ];
  }

  /* --- the add/edit dialog --------------------------------------------
     One dialog serves sections and shortcuts; fields are shown or hidden
     to suit. It resolves through onSubmit rather than returning a value. */
  const dlg = $("editDialog");
  const dlgForm = $("editForm");
  const dlgTitle = $("editTitle");
  const dlgFields = $("editFields");
  const dlgError = $("editError");
  let dlgSubmit = null;
  let dlgLastFocus = null;

  function field(label, name, value, placeholder, hintText) {
    const wrap = document.createElement("label");
    wrap.className = "ed-field";
    const span = document.createElement("span");
    span.className = "ed-label";
    span.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.value = value || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    if (placeholder) input.placeholder = placeholder;
    wrap.append(span, input);
    if (hintText) {
      const h = document.createElement("span");
      h.className = "ed-hint";
      h.textContent = hintText;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function openDialog(title, fields, onSubmit) {
    dlgLastFocus = document.activeElement;
    dlgTitle.textContent = title;
    dlgFields.textContent = "";
    fields.forEach((f) => dlgFields.appendChild(f));
    dlgError.textContent = "";
    dlgError.hidden = true;
    dlgSubmit = onSubmit;
    dlg.hidden = false;
    const first = dlgFields.querySelector("input");
    if (first) { first.focus(); first.select(); }
  }

  function closeDialog() {
    if (dlg.hidden) return;
    dlg.hidden = true;
    dlgSubmit = null;
    dlgFields.textContent = "";
    if (dlgLastFocus && document.contains(dlgLastFocus)) dlgLastFocus.focus();
    dlgLastFocus = null;
  }

  function dialogError(msg) {
    dlgError.textContent = msg;
    dlgError.hidden = false;
  }

  /* a bare "github.com" should still work */
  function normalizeUrl(raw) {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
    return "https://" + v.replace(/^\/+/, "");
  }

  /* --- section actions --- */
  function editCard(cardId) {
    const card = findCard(cardId);
    if (!card) return;
    openDialog("Rename section", [
      field("Name", "title", card.title, "Quick Links"),
      field("Label", "hint", card.hint, "Jump to", "Optional, shown when hovering the tab"),
    ], (data) => {
      const title = data.title.trim();
      if (!title) return dialogError("Give the section a name.");
      card.title = title;
      card.hint = data.hint.trim();
      commit();
    });
  }

  function addCard() {
    const ws = currentWs();
    if (!ws) return;
    openDialog("New section", [
      field("Name", "title", "", "Reading"),
      field("Label", "hint", "", "Later", "Optional, shown when hovering the tab"),
    ], (data) => {
      const title = data.title.trim();
      if (!title) return dialogError("Give the section a name.");
      const card = { id: uid("card"), title, hint: data.hint.trim(), items: [] };
      ws.cards.push(card);
      tabs[ws.id] = card.id; // jump to the new section
      store.set({ launcherTabs: JSON.stringify(tabs) });
      commit();
    });
  }

  function deleteCard(cardId) {
    const ws = currentWs();
    if (!ws) return;
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (i < 0) return;
    const card = ws.cards[i];
    const n = card.items.length;
    const msg = n
      ? 'Delete "' + card.title + '" and its ' + n + " shortcut" + (n === 1 ? "" : "s") + "?"
      : 'Delete "' + card.title + '"?';
    if (!confirm(msg)) return;
    ws.cards.splice(i, 1);
    commit();
  }

  function moveCard(cardId, delta) {
    const ws = currentWs();
    if (!ws) return;
    const i = ws.cards.findIndex((c) => c.id === cardId);
    if (moveBy(ws.cards, i, delta)) commit();
  }

  /* --- shortcut actions --- */
  function editItem(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return;
    const item = itemId ? card.items.find((it) => it.id === itemId) : null;
    if (itemId && !item) return;

    openDialog(item ? "Edit shortcut" : "New shortcut", [
      field("Name", "name", item ? item.name : "", "GitHub"),
      field("URL", "url", item ? item.url : "", "github.com"),
      field("Icon", "icon", item ? item.icon : "", "github", "Optional icon name from config.js, or an image path"),
    ], (data) => {
      const name = data.name.trim();
      const url = normalizeUrl(data.url);
      if (!name) return dialogError("Give the shortcut a name.");
      if (!url) return dialogError("Give the shortcut a URL.");
      if (item) {
        item.name = name;
        item.url = url;
        item.icon = data.icon.trim();
      } else {
        card.items.push({ id: uid("item"), name, url, icon: data.icon.trim() });
      }
      commit();
    });
  }

  function deleteItem(cardId, itemId) {
    const card = findCard(cardId);
    if (!card) return;
    const i = card.items.findIndex((it) => it.id === itemId);
    if (i < 0) return;
    if (!confirm('Delete "' + card.items[i].name + '"?')) return;
    card.items.splice(i, 1);
    commit();
  }

  function moveItem(cardId, itemId, delta) {
    const card = findCard(cardId);
    if (!card) return;
    const i = card.items.findIndex((it) => it.id === itemId);
    if (moveBy(card.items, i, delta)) commit();
  }

  /* every mutation ends here: persist, redraw, close the dialog */
  function commit() {
    saveLayout();
    renderLauncher();
    closeDialog();
  }

  /* --- wiring ---------------------------------------------------------
     One delegated listener covers every ⋮, add button and dock control,
     so re-rendering never leaves stale listeners behind.                */
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-act]");
    if (!trigger) return;
    const act = trigger.dataset.act;
    if (act === "menu") { e.preventDefault(); openMenu(trigger); }
    else if (act === "add-item") { e.preventDefault(); editItem(trigger.dataset.card, null); }
    else if (act === "add-card") { e.preventDefault(); addCard(); }
  });

  /* close the menu on an outside click, and on scroll/resize where the
     anchored position would otherwise drift away from its button */
  document.addEventListener("mousedown", (e) => {
    if (!ctxOwner) return;
    if (ctxMenu.contains(e.target) || e.target.closest('[data-act="menu"]')) return;
    closeMenu();
  });
  addEventListener("resize", closeMenu);
  [gridEl, tabsEl].forEach((d) => d.addEventListener("scroll", closeMenu, { passive: true }));

  dlgForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!dlgSubmit) return;
    const data = {};
    dlgFields.querySelectorAll("input").forEach((i) => (data[i.name] = i.value));
    dlgSubmit(data);
  });
  $("editCancel").addEventListener("click", closeDialog);
  $("editBackdrop").addEventListener("click", closeDialog);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!dlg.hidden) { e.preventDefault(); closeDialog(); }
    else if (ctxOwner) { e.preventDefault(); closeMenu(); }
  });

  /* ================= QUICK PEEK (most-used shortcuts) ==================== */
  let usage = {};
  function bumpUsage(item) {
    const k = item.url;
    usage[k] = usage[k] || { name: item.name, icon: item.icon, url: item.url, n: 0 };
    usage[k].n += 1;
    store.set({ usage: JSON.stringify(usage) });
  }
  /* opening a shortcut anywhere but a plain link click goes through here so
     usage tracking stays consistent with the tiles */
  function openShortcut(item) {
    if (!item || !item.url) return;
    bumpUsage(item);
    window.location.href = item.url;
  }

  function renderPeek() {
    const panel = $("peekPanel");
    const top = Object.values(usage).sort((a, b) => b.n - a.n).slice(0, 5);
    panel.innerHTML = "";
    if (!top.length) {
      const p = document.createElement("div");
      p.style.cssText = "padding:8px 9px;font-size:12px;color:rgba(247,246,243,.48)";
      p.textContent = "Open a few shortcuts and they'll show up here.";
      panel.appendChild(p);
      return;
    }
    top.forEach((t) => {
      const a = document.createElement("a");
      a.href = t.url;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = t.name;
      a.append(makeIcon(t, "g"), n);
      panel.appendChild(a);
    });
  }
  $("peekToggle").addEventListener("click", () => {
    const panel = $("peekPanel");
    if (panel.hidden) renderPeek();
    panel.hidden = !panel.hidden;
  });

  /* ================= SEARCH ============================================== */
  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (!q) return;
    window.location.href = SEARCH_URL + encodeURIComponent(q);
  });

  /* ================= AI CHAT ============================================= */
  const aiPanel = $("aiPanel");
  const aiLog = $("aiLog");
  let aiSeeded = false;
  const history = [];

  function addMsg(text, who) {
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.textContent = text;
    aiLog.appendChild(d);
    aiLog.scrollTop = aiLog.scrollHeight;
  }

  function openAi() {
    aiPanel.hidden = false;
    if (!aiSeeded) {
      aiSeeded = true;
      addMsg(AI_CONFIG.endpoint ? AI_CONFIG.greeting : AI_CONFIG.notConfigured, "bot");
    }
    $("aiInput").focus();
  }
  $("aiToggle").addEventListener("click", () => (aiPanel.hidden ? openAi() : (aiPanel.hidden = true)));
  $("aiClose").addEventListener("click", () => (aiPanel.hidden = true));

  $("aiForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("aiInput");
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, "me");
    history.push({ role: "user", content: text });
    input.value = "";
    // comit
    if (!AI_CONFIG.endpoint) {
      addMsg(AI_CONFIG.notConfigured, "bot");
      return;
    }
    try {
      const res = await fetch(AI_CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      const reply = data.reply || "No reply returned by the configured endpoint.";
      history.push({ role: "assistant", content: reply });
      addMsg(reply, "bot");
    } catch (err) {
      addMsg("Couldn't reach the assistant endpoint.", "bot");
    }
  });

  /* ================= COMMAND CENTER ======================================
     A keyboard-first palette over the existing UI. Every command delegates
     to the functions above — no second state, storage or search system.   */
  const cc = $("cc");
  const ccPanel = $("ccPanel");
  const ccInput = $("ccInput");
  const ccList = $("ccList");
  const ccEmpty = $("ccEmpty");

  let ccCommands = [];      // rebuilt whenever the palette opens
  let ccShown = [];         // the commands currently rendered, in order
  let ccSel = 0;            // index into ccShown
  let ccOpen = false;
  let ccLastFocus = null;
  let ccRaf = 0;

  /* --- command builders --- */

  /* every shortcut in every workspace, so search reaches past the active one */
  function createShortcutCommands() {
    const out = [];
    const seen = new Set();
    WORKSPACES.forEach((ws) => {
      (ws.cards || []).forEach((card) => {
        (card.items || []).forEach((item) => {
          if (!item || !item.name || !item.url) return;
          const key = item.url + "|" + item.name;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            id: "open:" + key,
            title: "Open " + item.name,
            description: ws.name + " · " + (card.title || ""),
            category: "Shortcuts",
            keywords: [item.name, ws.name, card.title || "", hostOf(item.url)],
            item,
            usageKey: item.url,
            run: () => openShortcut(item),
          });
        });
      });
    });
    return out;
  }

  function createWorkspaceCommands() {
    return WORKSPACES.map((ws) => ({
      id: "ws:" + ws.id,
      title: "Switch to " + ws.name,
      description: ws.id === activeWs ? "Current workspace" : "Workspace",
      category: "Workspaces",
      keywords: [ws.name, "workspace", "switch"],
      mark: "◈",
      run: () => setWorkspace(ws.id),
    }));
  }

  function createWallpaperCommands() {
    if (!WALLPAPERS.length) return [];
    return [
      {
        id: "wp:next",
        title: "Next Wallpaper",
        description: "Cycle forward through the wallpapers",
        category: "Wallpaper",
        keywords: ["wallpaper", "background", "video", "next", "change"],
        mark: "◑",
        run: () => stepWallpaper(1),
      },
      {
        id: "wp:prev",
        title: "Previous Wallpaper",
        description: "Cycle back through the wallpapers",
        category: "Wallpaper",
        keywords: ["wallpaper", "background", "video", "previous", "back"],
        mark: "◐",
        run: () => stepWallpaper(-1),
      },
    ];
  }

  function createSystemCommands() {
    return [
      {
        id: "sys:search",
        title: "Search Google",
        description: "Search the web for your query",
        category: "Search",
        keywords: ["search", "google", "web", "find", "query"],
        mark: "⌕",
        /* always reachable, even when nothing else matches */
        fallback: true,
        /* the title picks up whatever follows "search" as you type */
        dynamic: (query) => {
          const term = stripLead(query, ["search google for", "search google", "search", "google"]);
          return term ? { title: "Search Google for “" + term + "”", term } : null;
        },
        run: (cmd) => {
          const term = (cmd && cmd.term) || "";
          if (term) window.location.href = SEARCH_URL + encodeURIComponent(term);
          else $("q").focus();
        },
      },
      {
        id: "sys:ai",
        title: "Ask Atlas",
        description: "Open the assistant",
        category: "Atlas",
        keywords: ["ai", "atlas", "assistant", "ask", "chat", "help"],
        mark: "✦",
        run: () => openAi(),
      },
    ];
  }

  function createCommands() {
    return [].concat(
      createShortcutCommands(),
      createWorkspaceCommands(),
      createWallpaperCommands(),
      createSystemCommands()
    );
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  /* "search laravel queues" -> "laravel queues" */
  function stripLead(query, leads) {
    const q = query.trim();
    const lower = q.toLowerCase();
    for (const lead of leads) {
      if (lower === lead) return "";
      if (lower.startsWith(lead + " ")) return q.slice(lead.length + 1).trim();
    }
    return q;
  }

  /* --- ranking ---------------------------------------------------------
     Exact title > title prefix > word prefix > title contains > keyword >
     description. Usage count only breaks ties, so a frequently opened
     shortcut floats above an equally-matching one.                       */
  function scoreCommand(cmd, q) {
    const title = cmd.title.toLowerCase();
    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 68;
    if (title.includes(q)) return 55;
    const keys = cmd.keywords || [];
    if (keys.some((k) => k && k.toLowerCase().startsWith(q))) return 44;
    if (keys.some((k) => k && k.toLowerCase().includes(q))) return 32;
    if ((cmd.description || "").toLowerCase().includes(q)) return 20;
    return 0;
  }

  function usageOf(cmd) {
    const u = cmd.usageKey && usage[cmd.usageKey];
    return u ? u.n || 0 : 0;
  }

  function filterCommands(query) {
    const q = query.trim().toLowerCase();
    if (!q) return defaultCommands();

    const hits = [];
    ccCommands.forEach((cmd) => {
      const score = scoreCommand(cmd, q);
      if (score > 0) hits.push({ cmd, score });
    });
    hits.sort((a, b) => b.score - a.score || usageOf(b.cmd) - usageOf(a.cmd));

    const out = hits.map((h) => resolve(h.cmd, query));

    /* searching the web stays reachable for anything typed */
    const search = ccCommands.find((c) => c.fallback);
    if (search && !out.some((c) => c.id === search.id)) {
      const resolved = resolve(search, query);
      if (resolved.term) out.push(resolved);
    }
    return out;
  }

  /* a dynamic command (currently only Search) rewrites its own title from
     the query; everything else passes straight through */
  function resolve(cmd, query) {
    if (!cmd.dynamic) return cmd;
    const patch = cmd.dynamic(query);
    return patch ? Object.assign({}, cmd, patch) : cmd;
  }

  /* empty query: most-used shortcuts first (reusing the Quick Peek usage
     data), then workspaces, wallpaper controls and the assistant */
  function defaultCommands() {
    const shortcuts = ccCommands.filter((c) => c.category === "Shortcuts");
    const used = shortcuts
      .filter((c) => usageOf(c) > 0)
      .sort((a, b) => usageOf(b) - usageOf(a))
      .slice(0, 4);
    const usedIds = new Set(used.map((c) => c.id));

    /* nothing used yet — fall back to the active workspace's shortcuts */
    const name = wsName(activeWs);
    const fillers = shortcuts
      .filter((c) => !usedIds.has(c.id) && c.description.indexOf(name) === 0)
      .slice(0, Math.max(0, 4 - used.length));

    return [].concat(
      used,
      fillers,
      ccCommands.filter((c) => c.category !== "Shortcuts" && !c.fallback)
    );
  }

  function wsName(id) {
    const ws = WORKSPACES.find((w) => w.id === id);
    return ws ? ws.name : "";
  }

  /* --- rendering -------------------------------------------------------
     One list rebuild per query, not per frame; a selection change only
     toggles a class on two rows.                                         */
  function renderCommands(list) {
    ccShown = list;
    ccList.textContent = "";

    if (!list.length) {
      ccEmpty.hidden = false;
      ccInput.removeAttribute("aria-activedescendant");
      return;
    }
    ccEmpty.hidden = true;

    const frag = document.createDocumentFragment();
    let group = null;
    list.forEach((cmd, i) => {
      if (cmd.category !== group) {
        group = cmd.category;
        const li = document.createElement("li");
        li.className = "cc-group";
        li.setAttribute("role", "presentation");
        li.textContent = group;
        frag.appendChild(li);
      }
      frag.appendChild(renderItem(cmd, i));
    });
    ccList.appendChild(frag);
    setSelection(0, false);
  }

  function renderItem(cmd, i) {
    const li = document.createElement("li");
    li.className = "cc-item";
    li.id = "cc-opt-" + i;
    li.dataset.index = String(i);
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");

    /* shortcuts carry their real icon; everything else gets a glyph */
    if (cmd.item) {
      li.appendChild(makeIcon(cmd.item, "cc-icon"));
    } else {
      const m = document.createElement("span");
      m.className = "cc-mark";
      m.setAttribute("aria-hidden", "true");
      m.textContent = cmd.mark || "✧";
      li.appendChild(m);
    }

    const text = document.createElement("span");
    text.className = "cc-text";
    const t = document.createElement("span");
    t.className = "cc-title";
    t.textContent = cmd.title;
    text.appendChild(t);
    if (cmd.description) {
      const d = document.createElement("span");
      d.className = "cc-desc";
      d.textContent = cmd.description;
      text.appendChild(d);
    }
    li.appendChild(text);

    const enter = document.createElement("span");
    enter.className = "cc-enter";
    enter.setAttribute("aria-hidden", "true");
    enter.textContent = "↵";
    li.appendChild(enter);

    return li;
  }

  function itemAt(i) {
    return ccList.querySelector(".cc-item[data-index=\"" + i + "\"]");
  }

  function setSelection(i, scroll) {
    if (!ccShown.length) return;
    const prev = itemAt(ccSel);
    if (prev) {
      prev.classList.remove("is-sel");
      prev.setAttribute("aria-selected", "false");
    }
    ccSel = Math.max(0, Math.min(i, ccShown.length - 1));
    const el = itemAt(ccSel);
    if (!el) return;
    el.classList.add("is-sel");
    el.setAttribute("aria-selected", "true");
    ccInput.setAttribute("aria-activedescendant", el.id);
    if (scroll !== false) el.scrollIntoView({ block: "nearest" });
  }

  function moveSelection(delta) {
    if (!ccShown.length) return;
    const n = ccShown.length;
    setSelection((((ccSel + delta) % n) + n) % n);
  }

  function refresh() {
    ccSel = 0;
    renderCommands(filterCommands(ccInput.value));
  }

  /* --- execute ---------------------------------------------------------- */
  function executeCommand(cmd) {
    if (!cmd || typeof cmd.run !== "function") return;
    closeCommandCenter();
    /* a broken command must never take the palette down with it */
    try {
      cmd.run(cmd);
    } catch (err) {
      console.error("Atlas command failed:", cmd.id, err);
    }
  }

  /* --- open / close ------------------------------------------------------ */
  function openCommandCenter() {
    if (ccOpen) return;
    ccOpen = true;
    ccLastFocus = document.activeElement;
    ccCommands = createCommands();
    ccInput.value = "";
    cc.hidden = false;
    refresh();
    ccInput.focus();
  }

  function closeCommandCenter() {
    if (!ccOpen) return;
    ccOpen = false;
    cc.hidden = true;
    ccList.textContent = "";
    ccShown = [];
    ccInput.removeAttribute("aria-activedescendant");
    /* hand focus back where it came from, but never to something gone */
    if (ccLastFocus && document.contains(ccLastFocus)) ccLastFocus.focus();
    else $("q").focus();
    ccLastFocus = null;
  }

  /* --- wiring ------------------------------------------------------------ */
  ccInput.addEventListener("input", () => {
    /* coalesce fast typing into one render per frame */
    if (ccRaf) cancelAnimationFrame(ccRaf);
    ccRaf = requestAnimationFrame(() => {
      ccRaf = 0;
      refresh();
    });
  });

  ccInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
    else if (e.key === "Home" && ccShown.length) { e.preventDefault(); setSelection(0); }
    else if (e.key === "End" && ccShown.length) { e.preventDefault(); setSelection(ccShown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); executeCommand(ccShown[ccSel]); }
    else if (e.key === "Escape") { e.preventDefault(); closeCommandCenter(); }
  });

  /* one delegated listener for the whole list */
  ccList.addEventListener("click", (e) => {
    const li = e.target.closest(".cc-item");
    if (!li) return;
    executeCommand(ccShown[Number(li.dataset.index)]);
  });
  ccList.addEventListener("mousemove", (e) => {
    const li = e.target.closest(".cc-item");
    if (!li) return;
    const i = Number(li.dataset.index);
    if (i !== ccSel) setSelection(i, false);
  });

  $("ccBackdrop").addEventListener("click", closeCommandCenter);
  /* clicks inside the panel (but outside the input) keep typing working */
  ccPanel.addEventListener("mousedown", (e) => {
    if (e.target !== ccInput) {
      e.preventDefault();
      if (ccOpen) ccInput.focus();
    }
  });

  document.addEventListener("keydown", (e) => {
    /* Ctrl+Space / Cmd+Space. Cmd+Space is usually swallowed by macOS
       Spotlight before it reaches the page — handled here for the cases
       where it does arrive. */
    if (e.code === "Space" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (ccOpen) closeCommandCenter();
      else openCommandCenter();
      return;
    }
    if (e.key === "Escape" && ccOpen) {
      e.preventDefault();
      closeCommandCenter();
    }
  });

  /* ================= NOW PLAYING =========================================
     Whatever is playing in another tab (see media-bridge.js and
     background.js). Hidden when nothing has played, or when the page is
     opened outside the extension. */
  (function nowPlaying() {
    const box = $("media");
    const hasRuntime =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.onMessage;
    if (!box || !hasRuntime) return;

    box.insertAdjacentHTML("afterbegin", TRACE_SVG);
    const img = $("mediaImg");
    const title = $("mediaTitle");
    const artist = $("mediaArtist");
    const fill = $("mediaFill");
    const bar = $("mediaBar");
    const cur = $("mediaCur");
    const dur = $("mediaDur");
    const toggle = $("mediaToggle");
    const prev = $("mediaPrev");
    const next = $("mediaNext");
    let now = null;
    let ticker = 0;

    const send = (msg) => {
      try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {}
    };
    const cmd = (action, time) => now && send({ type: "media:cmd", tabId: now.tabId, action, time });

    const fmt = (s) => {
      s = Math.max(0, Math.floor(s || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = String(s % 60).padStart(2, "0");
      return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
    };

    /* position is extrapolated between the worker's updates */
    function position() {
      if (!now) return 0;
      let p = now.position || 0;
      if (now.playing) p += ((Date.now() - now.at) / 1000) * (now.rate || 1);
      return now.duration ? Math.min(p, now.duration) : p;
    }

    function paintProgress() {
      if (!now) return;
      const d = now.duration || 0;
      const p = position();
      fill.style.width = d ? (p / d) * 100 + "%" : "0%";
      cur.textContent = d ? fmt(p) : "";
      dur.textContent = d ? fmt(d) : "LIVE";
    }

    function render(data) {
      now = data && data.title ? data : null;
      clearInterval(ticker);
      if (!now) {
        box.hidden = true;
        document.body.classList.remove("has-media");
        return;
      }
      box.hidden = false;
      document.body.classList.add("has-media");

      title.textContent = now.title;
      title.title = now.title;
      artist.textContent = [now.artist, now.source].filter(Boolean).join(" · ");
      $("mediaOpen").setAttribute("aria-label", `Open ${now.source || "the tab"}: ${now.title}`);

      if (now.art && img.getAttribute("src") !== now.art) img.src = now.art;
      img.hidden = !now.art;

      box.classList.toggle("is-paused", !now.playing);
      toggle.setAttribute("aria-label", now.playing ? "Pause" : "Play");
      prev.disabled = !(now.can && now.can.prev);
      next.disabled = !(now.can && now.can.next);
      bar.classList.toggle("is-seekable", !!(now.can && now.can.seek && now.duration));

      paintProgress();
      if (now.playing) ticker = setInterval(paintProgress, 500);
    }

    img.addEventListener("error", () => { img.hidden = true; });

    toggle.addEventListener("click", () => {
      if (!now) return;
      cmd("toggle");
      /* answer the click right away; the tab confirms a moment later */
      now = Object.assign({}, now, { playing: !now.playing, position: position(), at: Date.now() });
      render(now);
    });
    prev.addEventListener("click", () => cmd("prev"));
    next.addEventListener("click", () => cmd("next"));
    $("mediaOpen").addEventListener("click", () => {
      if (now) send({ type: "media:focus", tabId: now.tabId, windowId: now.windowId });
    });
    bar.addEventListener("click", (e) => {
      if (!now || !bar.classList.contains("is-seekable")) return;
      const r = bar.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * now.duration;
      cmd("seek", t);
      now = Object.assign({}, now, { position: t, at: Date.now() });
      paintProgress();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "media:now") render(msg.data);
    });
    const refresh = () => {
      try {
        chrome.runtime.sendMessage({ type: "media:get" }).then(render, () => {});
      } catch {}
    };
    refresh();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

    /* the left dock makes room for the widget, whatever height it ends up */
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        if (box.offsetHeight) {
          document.documentElement.style.setProperty("--media-h", box.offsetHeight + "px");
        }
      }).observe(box);
    }
  })();

  /* ================= WEATHER =============================================
     Current conditions from Open-Meteo (free, no key). Location, in order
     of preference: a city typed via the card, WEATHER_CONFIG.city, then the
     browser's own location. Cached for 30 minutes. */
  (function weather() {
    const btn = $("weather");
    if (!btn) return;
    const iconEl = $("weatherIcon");
    const tempEl = $("weatherTemp");
    const cityEl = $("weatherCity");
    const condEl = $("weatherCond");
    const cfg = typeof WEATHER_CONFIG !== "undefined" ? WEATHER_CONFIG : {};
    const units = cfg.units === "fahrenheit" ? "fahrenheit" : "celsius";
    const FRESH = 30 * 60 * 1000;

    const W_ICONS = {
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
      moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
      partly: '<path d="M8 3.5V5M3.5 8H5M4.8 4.8l1 1M11.2 4.8l-1 1"/><path d="M5.3 10.6a3 3 0 1 1 5.4-2.8"/><path d="M9 20h8a3.5 3.5 0 0 0 .5-6.96A4.5 4.5 0 0 0 8.8 12.3 3.9 3.9 0 0 0 9 20z"/>',
      cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.1 4.5 4.5 0 0 0 7 18z"/>',
      fog: '<path d="M4 8h16M6 12h12M4 16h16M8 20h8"/>',
      rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="m9 18-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
      snow: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="M9 18.5h.01M13 20h.01M17 18.5h.01" stroke-width="2.6"/>',
      storm: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.1 4.5 4.5 0 0 0 7 15z"/><path d="m12.5 15.5-2 3h3l-2 3"/>',
    };
    const wIcon = (k) =>
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      W_ICONS[k] + "</svg>";

    /* WMO weather codes -> words + icon */
    function describe(code, day) {
      const clear = day ? "sun" : "moon";
      if (code === 0) return ["Clear", clear];
      if (code === 1) return ["Mostly clear", clear];
      if (code === 2) return ["Partly cloudy", day ? "partly" : "cloud"];
      if (code === 3) return ["Overcast", "cloud"];
      if (code === 45 || code === 48) return ["Fog", "fog"];
      if (code >= 51 && code <= 57) return ["Drizzle", "rain"];
      if (code >= 61 && code <= 67) return ["Rain", "rain"];
      if (code >= 71 && code <= 77) return ["Snow", "snow"];
      if (code >= 80 && code <= 82) return ["Showers", "rain"];
      if (code === 85 || code === 86) return ["Snow showers", "snow"];
      if (code >= 95) return ["Thunderstorm", "storm"];
      return ["Cloudy", "cloud"];
    }

    let loc = null; // { name, lat, lon, manual?, fromConfig?, at }
    const parse = (v) => {
      try { return typeof v === "string" ? JSON.parse(v) : v || null; } catch { return null; }
    };

    function status(city, text) {
      tempEl.textContent = "--°";
      iconEl.innerHTML = wIcon("cloud");
      cityEl.textContent = city;
      condEl.textContent = text;
    }

    function paint(w) {
      const [text, icon] = describe(w.code, w.day);
      tempEl.textContent = Math.round(w.temp) + "°";
      iconEl.innerHTML = wIcon(icon);
      cityEl.textContent = loc.name || "Your location";
      condEl.textContent = text;
      btn.setAttribute("aria-label", `${Math.round(w.temp)} degrees, ${text} in ${cityEl.textContent}. Click to change city`);
    }

    async function load(force) {
      if (!loc) return;
      const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)},${units}`;
      const cached = parse((await store.get(["weatherCache"])).weatherCache);
      const usable = cached && cached.key === key;
      if (!force && usable && Date.now() - cached.at < FRESH) return paint(cached);
      try {
        const r = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
          "&current=temperature_2m,weather_code,is_day&temperature_unit=" + units
        );
        if (!r.ok) throw new Error(r.status);
        const c = (await r.json()).current;
        const w = { key, at: Date.now(), temp: c.temperature_2m, code: c.weather_code, day: c.is_day === 1 };
        store.set({ weatherCache: JSON.stringify(w) });
        paint(w);
      } catch {
        if (usable) paint(cached);
        else status(loc.name || "Weather", "Offline");
      }
    }

    async function geocode(name) {
      const r = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" +
        encodeURIComponent(name)
      );
      const hit = r.ok && ((await r.json()).results || [])[0];
      return hit ? { name: hit.name, lat: hit.latitude, lon: hit.longitude } : null;
    }

    function locate() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no geolocation"));
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          reject,
          { timeout: 10000, maximumAge: 60 * 60 * 1000 }
        );
      });
    }

    /* coordinates -> a city name for the card */
    async function placeName(lat, lon) {
      try {
        const r = await fetch(
          "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en&latitude=" + lat + "&longitude=" + lon
        );
        const j = await r.json();
        return j.city || j.locality || j.principalSubdivision || "";
      } catch {
        return "";
      }
    }

    async function useCurrentLocation() {
      status("Weather", "Locating…");
      try {
        const p = await locate();
        loc = { name: await placeName(p.lat, p.lon), lat: p.lat, lon: p.lon, at: Date.now() };
        store.set({ weatherLoc: JSON.stringify(loc) });
        await load(true);
      } catch {
        loc = null;
        status("Weather", "Click to set city");
      }
    }

    async function useCity(name, extra) {
      const hit = await geocode(name);
      if (!hit) return false;
      loc = Object.assign(hit, extra, { at: Date.now() });
      store.set({ weatherLoc: JSON.stringify(loc) });
      await load(true);
      return true;
    }

    btn.addEventListener("click", () => {
      openDialog("Weather location", [
        field("City", "city", loc && loc.manual ? loc.name : "", "Karachi", "Leave empty to use your current location"),
      ], async (data) => {
        const city = data.city.trim();
        if (!city) {
          closeDialog();
          store.set({ weatherLoc: "" });
          useCurrentLocation();
          return;
        }
        try {
          if (await useCity(city, { manual: true })) closeDialog();
          else dialogError("Couldn't find that city. Try adding the country, e.g. \"Lahore, Pakistan\".");
        } catch {
          dialogError("Couldn't reach the weather service. Check your connection.");
        }
      });
    });

    store.get(["weatherLoc"]).then(async (s) => {
      loc = parse(s.weatherLoc);
      if (loc && !(isFinite(loc.lat) && isFinite(loc.lon))) loc = null;
      const cfgCity = typeof cfg.city === "string" ? cfg.city.trim() : "";
      try {
        if (cfgCity && !(loc && (loc.manual || loc.fromConfig === cfgCity))) {
          if (await useCity(cfgCity, { fromConfig: cfgCity })) return;
        }
      } catch {}
      /* a detected location is re-checked every few hours in case you moved */
      if (loc && !loc.manual && !loc.fromConfig && Date.now() - (loc.at || 0) > 6 * 60 * 60 * 1000) {
        return useCurrentLocation();
      }
      if (loc) return load();
      useCurrentLocation();
    });

    setInterval(() => load(), FRESH);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  })();

  /* ================= LAUNCHER: CLOSE ===================================
     Esc (when nothing else used it) or a click on the bare wallpaper hides
     the launcher again. Registered last so dialogs, menus and the command
     center get the Escape key first. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && launcherOpen && !e.defaultPrevented) setLauncherOpen(false);
  });
  document.querySelector(".wallpaper").addEventListener("click", () => {
    if (launcherOpen) setLauncherOpen(false);
  });

  /* ================= BOOT ================================================ */
  store.get(["wallpaper", "workspace", "usage", "launcherTabs", LAYOUT_KEY]).then((s) => {
    /* the saved layout replaces the config.js defaults; a first launch, or
       anything unreadable, falls back to them */
    applyLayout(loadLayout(s[LAYOUT_KEY]));
    activeWs = WORKSPACES[0].id;
    if (s.workspace && WORKSPACES.some((w) => w.id === s.workspace)) activeWs = s.workspace;
    try { usage = s.usage ? JSON.parse(s.usage) : {}; } catch { usage = {}; }
    try { tabs = s.launcherTabs ? JSON.parse(s.launcherTabs) || {} : {}; } catch { tabs = {}; }
    renderRail();
    renderLauncher();
    syncClockHeight();
    setWallpaper(s.wallpaper || WALLPAPERS[0].id, true);
    $("q").focus();
  });
})();
