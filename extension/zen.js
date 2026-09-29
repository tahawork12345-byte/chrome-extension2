/* ATLAS NEW TAB — Zen clock
   A full-screen clock. Opened from the dock (the clock icon), the Command
   Center ("Zen Clock") or by pressing Z. Its own menu — the sliders
   button beside ✕ — has five things:
     1. show the day / date / year (and seconds)
     2. show the page's widgets over it
     3. show the wallpaper behind it
     4. a background colour instead of the wallpaper
     5. other places' time and date (a city, a country or a time zone)
   Settings live in Customize under `zen` (customize.js).               */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  if (!AS) return;

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /* countries -> a representative time zone (cities come from the zone list) */
  const COUNTRIES = {
    pakistan: "Asia/Karachi", india: "Asia/Kolkata", bangladesh: "Asia/Dhaka", "sri lanka": "Asia/Colombo",
    nepal: "Asia/Kathmandu", afghanistan: "Asia/Kabul", iran: "Asia/Tehran", "united arab emirates": "Asia/Dubai",
    uae: "Asia/Dubai", "saudi arabia": "Asia/Riyadh", qatar: "Asia/Qatar", kuwait: "Asia/Kuwait", oman: "Asia/Muscat",
    bahrain: "Asia/Bahrain", turkey: "Europe/Istanbul", egypt: "Africa/Cairo", "united kingdom": "Europe/London",
    uk: "Europe/London", england: "Europe/London", ireland: "Europe/Dublin", france: "Europe/Paris",
    germany: "Europe/Berlin", italy: "Europe/Rome", spain: "Europe/Madrid", netherlands: "Europe/Amsterdam",
    sweden: "Europe/Stockholm", norway: "Europe/Oslo", poland: "Europe/Warsaw", russia: "Europe/Moscow",
    ukraine: "Europe/Kyiv", greece: "Europe/Athens", "united states": "America/New_York", usa: "America/New_York",
    america: "America/New_York", canada: "America/Toronto", mexico: "America/Mexico_City", brazil: "America/Sao_Paulo",
    argentina: "America/Argentina/Buenos_Aires", china: "Asia/Shanghai", japan: "Asia/Tokyo", "south korea": "Asia/Seoul",
    korea: "Asia/Seoul", singapore: "Asia/Singapore", malaysia: "Asia/Kuala_Lumpur", indonesia: "Asia/Jakarta",
    thailand: "Asia/Bangkok", vietnam: "Asia/Ho_Chi_Minh", philippines: "Asia/Manila", australia: "Australia/Sydney",
    "new zealand": "Pacific/Auckland", "south africa": "Africa/Johannesburg", nigeria: "Africa/Lagos",
    kenya: "Africa/Nairobi", morocco: "Africa/Casablanca", "hong kong": "Asia/Hong_Kong", taiwan: "Asia/Taipei",
    israel: "Asia/Jerusalem", jordan: "Asia/Amman", iraq: "Asia/Baghdad", uzbekistan: "Asia/Tashkent",
    kazakhstan: "Asia/Almaty", maldives: "Indian/Maldives",
  };
  const ZONES = (() => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return []; }
  })();
  const cityOf = (tz) => tz.split("/").pop().replace(/_/g, " ");
  const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  /* "Karachi", "Pakistan", "Asia/Karachi", "karachi (asia/karachi)" -> a zone */
  function findZone(text) {
    const t = String(text || "").trim().toLowerCase();
    if (!t) return null;
    const inParens = /\(([^)]+)\)\s*$/.exec(t);
    const key = inParens ? inParens[1] : t;
    const exact = ZONES.find((z) => z.toLowerCase() === key);
    if (exact) return { tz: exact, label: cityOf(exact) };
    if (COUNTRIES[key]) return { tz: COUNTRIES[key], label: titleCase(key.length <= 3 ? key.toUpperCase() : key) };
    const city = ZONES.find((z) => cityOf(z).toLowerCase() === key);
    if (city) return { tz: city, label: cityOf(city) };
    const part = ZONES.find((z) => cityOf(z).toLowerCase().startsWith(key));
    return part ? { tz: part, label: cityOf(part) } : null;
  }

  /* ---------- building the overlay ---------- */
  const el = (tag, cls, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => (k === "text" ? (e.textContent = v) : e.setAttribute(k, v)));
    return e;
  };
  const ICON_SLIDERS = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  const root = el("div", "zen", { id: "zen", role: "region", "aria-label": "Zen clock" });
  root.hidden = true;
  const bg = el("div", "zen-bg");
  const center = el("div", "zen-center");
  const timeEl = el("div", "zen-time", { translate: "no" });
  const dateEl = el("div", "zen-date");
  const placesEl = el("div", "zen-places");
  center.append(timeEl, dateEl, placesEl);

  const bar = el("div", "zen-bar");
  const menuBtn = el("button", "zen-btn", { type: "button", "aria-label": "Customize Zen clock", title: "Customize", "aria-haspopup": "dialog", "aria-expanded": "false" });
  menuBtn.innerHTML = ICON_SLIDERS;
  const closeBtn = el("button", "zen-btn", { type: "button", "aria-label": "Close Zen clock", title: "Close (Esc)" });
  closeBtn.innerHTML = ICON_CLOSE;
  bar.append(menuBtn, closeBtn);
  const menu = el("div", "zen-menu", { role: "dialog", "aria-label": "Zen clock options" });
  menu.hidden = true;
  root.append(bg, center);
  /* the controls are a layer of their own, so they stay above the page's
     widgets when those are shown over the clock */
  const ui = el("div", "zen-ui");
  ui.hidden = true;
  ui.append(bar, menu);
  document.body.append(root, ui);

  /* ---------- the clock ---------- */
  const zen = () => AS.get().zen;
  const h24 = () => AS.get().widgets.clock.h24;
  let timer = 0;

  function parts(date, tz) {
    const o = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, weekday: "long", year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).forEach((p) => (o[p.type] = p.value));
    return {
      h: Number(o.hour) % 24, m: o.minute, s: o.second, weekday: o.weekday,
      day: Number(o.day), month: Number(o.month) - 1, year: Number(o.year),
    };
  }
  function clockText(h, m) {
    if (h24()) return { hm: String(h).padStart(2, "0") + ":" + m, ap: "" };
    return { hm: (h % 12 || 12) + ":" + m, ap: h >= 12 ? "PM" : "AM" };
  }

  function render() {
    const z = zen();
    const now = new Date();
    const d = parts(now);
    const t = clockText(d.h, d.m);
    timeEl.textContent = "";
    timeEl.append(t.hm);
    if (z.seconds) timeEl.append(el("span", "zen-sec", { text: ":" + d.s }));
    if (t.ap) timeEl.append(el("span", "zen-ap", { text: t.ap }));

    const bits = [];
    if (z.day) bits.push(DAYS[now.getDay()]);
    if (z.date) bits.push(now.getDate() + " " + MONTHS[now.getMonth()]);
    if (z.year) bits.push(String(now.getFullYear()));
    dateEl.textContent = bits.join(" · ");
    dateEl.hidden = !bits.length;

    placesEl.textContent = "";
    const nowSec = Math.floor(now.getTime() / 1000) * 1000;
    z.places.forEach((p) => {
      let q;
      try { q = parts(now, p.tz); } catch { return; }
      const pt = clockText(q.h, q.m);
      /* hours ahead or behind this computer: that zone's offset minus ours */
      const theirOffset = (Date.UTC(q.year, q.month, q.day, q.h, Number(q.m), Number(q.s)) - nowSec) / 60000;
      const diff = Math.round((theirOffset + now.getTimezoneOffset()) / 15) / 4;
      const card = el("div", "zen-place");
      card.append(
        el("span", "zen-place-name", { text: p.label }),
        el("span", "zen-place-time", { text: pt.hm + (pt.ap ? " " + pt.ap : ""), translate: "no" }),
        el("span", "zen-place-date", {
          text: [z.day ? q.weekday.slice(0, 3) : "", z.date ? q.day + " " + MONTHS[q.month].slice(0, 3) : "", z.year ? q.year : ""]
            .filter(Boolean).join(" · ") + (diff ? "  (" + (diff > 0 ? "+" : "") + diff + "h)" : "  (same time)"),
        }));
      placesEl.append(card);
    });
    placesEl.hidden = !z.places.length;
  }

  function schedule() {
    clearTimeout(timer);
    if (root.hidden) return;
    render();
    const ms = zen().seconds ? 1000 - (Date.now() % 1000) : 60000 - (Date.now() % 60000);
    timer = setTimeout(schedule, ms + 5);
  }

  function applyLook() {
    const z = zen();
    root.classList.toggle("is-solid", !z.background);
    bg.style.background = z.background ? "" : z.color;
    document.body.classList.toggle("zen-solo", !root.hidden && !z.widgets);
  }

  /* ---------- the menu: five groups ---------- */
  function checkRow(label, key) {
    const row = el("label", "zen-check");
    const box = el("input", "", { type: "checkbox" });
    box.checked = !!zen()[key];
    box.addEventListener("change", () => AS.set("zen." + key, box.checked));
    row.append(box, el("span", "", { text: label }));
    return row;
  }
  function switchRow(label, key, onChange) {
    const row = el("label", "zen-row");
    const sw = el("input", "cz-switch", { type: "checkbox", role: "switch" });
    sw.checked = !!zen()[key];
    sw.addEventListener("change", () => { AS.set("zen." + key, sw.checked); if (onChange) onChange(sw.checked); });
    row.append(el("span", "", { text: label }), sw);
    return row;
  }
  const section = (n, title, ...kids) => {
    const s = el("section", "zen-sec-block");
    s.append(el("h3", "zen-h", { text: n + ". " + title }), ...kids);
    return s;
  };

  const SWATCHES = ["#0b0b10", "#101826", "#1b1024", "#0f1d17", "#241611", "#1e1e1e", "#f4efe6", "#2b2d42"];

  function buildMenu() {
    const z = zen();
    menu.textContent = "";

    /* 1 */
    const checks = el("div", "zen-checks");
    checks.append(checkRow("Day", "day"), checkRow("Date", "date"), checkRow("Year", "year"), checkRow("Seconds", "seconds"));
    menu.append(section(1, "Show date / year / day", checks));

    /* 2, 3 */
    menu.append(section(2, "Widgets", switchRow("Show widgets", "widgets")));
    menu.append(section(3, "Background", switchRow("Show wallpaper", "background", () => buildMenu())));

    /* 4 */
    const colors = el("div", "zen-swatches");
    const pick = (c) => { AS.set("zen.color", c); if (zen().background) AS.set("zen.background", false); buildMenu(); };
    SWATCHES.forEach((c) => {
      const b = el("button", "zen-swatch" + (!z.background && z.color === c ? " is-on" : ""), { type: "button", "aria-label": "Colour " + c, title: c });
      b.style.background = c;
      b.addEventListener("click", () => pick(c));
      colors.append(b);
    });
    const own = el("label", "zen-swatch zen-own", { title: "Your own colour" });
    const input = el("input", "", { type: "color", "aria-label": "Your own colour" });
    input.value = z.color;
    input.addEventListener("input", () => { AS.set("zen.color", input.value); if (zen().background) AS.set("zen.background", false); });
    input.addEventListener("change", () => buildMenu());
    own.append(input);
    colors.append(own);
    menu.append(section(4, "Background colour", colors,
      el("p", "zen-note", { text: z.background ? "Picking a colour replaces the wallpaper." : "Shown instead of the wallpaper." })));

    /* 5 */
    const list = el("div", "zen-plist");
    z.places.forEach((p) => {
      const row = el("div", "zen-prow");
      const del = el("button", "zen-pdel", { type: "button", "aria-label": "Remove " + p.label, title: "Remove", text: "✕" });
      del.addEventListener("click", () => {
        AS.set("zen.places", zen().places.filter((x) => x.id !== p.id));
        buildMenu();
      });
      row.append(el("span", "", { text: p.label }), el("span", "zen-ptz", { text: p.tz, translate: "no" }), del);
      list.append(row);
    });
    const form = el("form", "zen-padd");
    const place = el("input", "zen-input", { type: "text", list: "zenZones", placeholder: "City, country or time zone", "aria-label": "Place", spellcheck: "false" });
    const label = el("input", "zen-input zen-label", { type: "text", placeholder: "Name (optional)", "aria-label": "Name", maxlength: "32" });
    const add = el("button", "zen-add", { type: "submit", text: "Add" });
    const msg = el("p", "zen-note is-error");
    msg.hidden = true;
    form.append(place, label, add);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const hit = findZone(place.value);
      if (!hit) { msg.textContent = "Couldn't find that place. Try a big city near it, e.g. Dubai or London."; msg.hidden = false; return; }
      const places = zen().places.slice();
      if (places.length >= 8) { msg.textContent = "That's the most places there's room for."; msg.hidden = false; return; }
      places.push({ id: "pl-" + Date.now().toString(36), label: label.value.trim().slice(0, 32) || hit.label, tz: hit.tz });
      AS.set("zen.places", places);
      buildMenu();
      menu.querySelector(".zen-input").focus();
    });
    menu.append(section(5, "Other places", list, form, msg));
  }
  /* suggestions while typing a place: every zone + the countries above */
  const dl = el("datalist", "", { id: "zenZones" });
  Object.keys(COUNTRIES).filter((k) => k.length > 3).forEach((k) => dl.append(new Option(titleCase(k))));
  ZONES.forEach((z) => dl.append(new Option(cityOf(z) + " (" + z + ")")));
  ui.append(dl);

  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.classList.toggle("is-on", open);
    if (open) buildMenu();
  }
  menuBtn.addEventListener("click", () => setMenu(menu.hidden));
  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });

  /* ---------- open / close ---------- */
  let lastFocus = null;
  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    ui.hidden = false;
    document.body.classList.add("zen-on");
    applyLook();
    schedule();
    closeBtn.focus();
  }
  function close() {
    if (root.hidden) return;
    setMenu(false);
    root.hidden = true;
    ui.hidden = true;
    document.body.classList.remove("zen-on", "zen-solo");
    clearTimeout(timer);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  closeBtn.addEventListener("click", close);
  /* the button beside the wallpaper toggle */
  const zenBtn = document.getElementById("zenBtn");
  if (zenBtn) zenBtn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if (!root.hidden && e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!menu.hidden) { setMenu(false); menuBtn.focus(); } else close();
      return;
    }
    /* Z opens it, unless typing somewhere */
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (root.hidden && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      open();
    }
  }, true);

  AS.on((s, path) => {
    if (path !== "*" && !path.startsWith("zen.") && path !== "widgets.clock.h24") return;
    applyLook();
    if (!root.hidden) schedule();
  });

  window.AtlasZen = { open, close, isOpen: () => !root.hidden };
})();
