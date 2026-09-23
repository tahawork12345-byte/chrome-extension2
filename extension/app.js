/* ATLAS NEW TAB — app logic
   All user-editable content lives in config.js                */

(() => {
  "use strict";

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

  /* the docks sit below the clock block; its height depends on the clamped
     font sizes, so measure the real thing instead of guessing an offset */
  const clockEl = document.querySelector(".clock");
  function syncClockHeight() {
    if (!clockEl) return;
    const h = Math.ceil(clockEl.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty("--clock-h", h + "px");
  }
  syncClockHeight();
  addEventListener("resize", syncClockHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncClockHeight);

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
     same one config.js already uses, so every consumer below (cards, strip,
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

  /* ================= WORKSPACES + CARDS ================================== */
  const docks = [$("dockLeft"), $("dockRight")];
  const strip = $("strip");
  let activeWs = null; // set at boot, once the layout is loaded

  function renderCards() {
    const ws = currentWs();
    /* any open ⋮ menu is anchored to a button that is about to be removed */
    if (typeof closeMenu === "function") closeMenu();
    docks.forEach((d) => (d.innerHTML = ""));
    if (!ws) return;

    /* split the sections across the two docks instead of capping at 4, so
       added sections have somewhere to go */
    const cards = ws.cards;
    const half = Math.ceil(cards.length / 2);

    cards.forEach((card, i) => {
      const el = document.createElement("article");
      el.className = "card";
      el.dataset.card = card.id;

      const head = document.createElement("div");
      head.className = "card-head";
      const title = document.createElement("span");
      title.className = "card-title";
      title.textContent = card.title;
      const hint = document.createElement("span");
      hint.className = "card-hint";
      hint.textContent = card.hint || "";
      head.append(title, hint, menuButton("card", card.id, "Section options"));
      el.appendChild(head);

      const tiles = document.createElement("div");
      tiles.className = "tiles";
      card.items.forEach((it) => tiles.appendChild(renderTile(card, it)));

      /* inline affordance to add a link straight into this section */
      const add = document.createElement("button");
      add.type = "button";
      add.className = "tile tile-add";
      add.dataset.act = "add-item";
      add.dataset.card = card.id;
      add.innerHTML = '<span class="tile-plus" aria-hidden="true">+</span>';
      const addLabel = document.createElement("span");
      addLabel.className = "tile-name";
      addLabel.textContent = "Add shortcut";
      add.appendChild(addLabel);
      tiles.appendChild(add);

      el.appendChild(tiles);
      docks[i < half ? 0 : 1].appendChild(el);
    });

    /* + Add Section lives at the foot of the second dock */
    const addSection = document.createElement("button");
    addSection.type = "button";
    addSection.className = "add-section";
    addSection.dataset.act = "add-card";
    addSection.textContent = "+ Add Section";
    docks[1].appendChild(addSection);
  }

  function renderTile(card, it) {
    const row = document.createElement("div");
    row.className = "tile-row";

    const a = document.createElement("a");
    a.className = "tile";
    a.href = it.url;
    a.title = it.name;
    const nm = document.createElement("span");
    nm.className = "tile-name";
    nm.textContent = it.name;
    a.append(makeIcon(it, "tile-icon"), nm);
    a.addEventListener("click", () => bumpUsage(it));

    row.append(a, menuButton("item", it.id, "Shortcut options", card.id));
    return row;
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

  function renderStrip() {
    strip.innerHTML = "";
    WORKSPACES.forEach((w) => {
      const b = document.createElement("button");
      b.textContent = w.name;
      if (w.id === activeWs) b.classList.add("is-on");
      b.addEventListener("click", () => setWorkspace(w.id));
      strip.appendChild(b);
    });
  }

  /* the single place a workspace change happens — the strip and the command
     center both go through here, so persistence stays in one spot */
  function setWorkspace(id) {
    if (!WORKSPACES.some((w) => w.id === id) || id === activeWs) return;
    activeWs = id;
    store.set({ workspace: id });
    renderStrip();
    renderCards();
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
      { label: "Move up", disabled: i === 0, run: () => moveCard(cardId, -1) },
      { label: "Move down", disabled: i === ws.cards.length - 1, run: () => moveCard(cardId, 1) },
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
      { label: "Move up", disabled: i === 0, run: () => moveItem(cardId, itemId, -1) },
      { label: "Move down", disabled: i === card.items.length - 1, run: () => moveItem(cardId, itemId, 1) },
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
      field("Label", "hint", card.hint, "Jump to", "Optional, shown in the corner"),
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
      field("Label", "hint", "", "Later", "Optional, shown in the corner"),
    ], (data) => {
      const title = data.title.trim();
      if (!title) return dialogError("Give the section a name.");
      ws.cards.push({ id: uid("card"), title, hint: data.hint.trim(), items: [] });
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
    renderCards();
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
  docks.forEach((d) => d.addEventListener("scroll", closeMenu, { passive: true }));

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

  /* ================= BOOT ================================================ */
  store.get(["wallpaper", "workspace", "usage", LAYOUT_KEY]).then((s) => {
    /* the saved layout replaces the config.js defaults; a first launch, or
       anything unreadable, falls back to them */
    applyLayout(loadLayout(s[LAYOUT_KEY]));
    activeWs = WORKSPACES[0].id;
    if (s.workspace && WORKSPACES.some((w) => w.id === s.workspace)) activeWs = s.workspace;
    try { usage = s.usage ? JSON.parse(s.usage) : {}; } catch { usage = {}; }
    renderStrip();
    renderCards();
    syncClockHeight(); // the strip is part of the clock block
    setWallpaper(s.wallpaper || WALLPAPERS[0].id, true);
    $("q").focus();
  });
})();
