/* ATLAS NEW TAB — Atlas Pro on the page
   What a free account may use, and what it sees when it reaches a limit:
     - need(text): false for Pro; otherwise opens the upgrade box and
       answers true (the caller stops there);
     - wallpaper(key): wallpapers — PRO_CONFIG.freeWallpapers of them for
       free (built-in, online stills and live together, kept in "wp:used";
       one already used can always be set again, and the first built-in
       one, which a new tab starts on, never counts);
     - FREE_THEMES / FREE_CURSORS: the theme presets and cursor packs a
       free account can choose; the rest are Pro.
   Every new account gets Pro free for its first days (TRIAL_DAYS on the
   server). When the server says the account isn't Pro (AtlasAccount.verify),
   any Pro look still on is put back (AtlasSettings.dropPro), and the first
   time a trial is seen to have ended the upgrade box says so.
   Also the welcome card, once each time the browser opens.              */

(() => {
  "use strict";
  const A = window.AtlasAccount;
  const AS = window.AtlasSettings;
  const CFG = typeof PRO_CONFIG !== "undefined" ? PRO_CONFIG : {};
  const FREE_WALLPAPERS = Number.isFinite(CFG.freeWallpapers) ? CFG.freeWallpapers : 5;
  const FREE_THEMES = ["sand"];
  const FREE_CURSORS = ["default"];

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const get = (k) => new Promise((r) => (hasChrome ? chrome.storage.local.get([k], (o) => r(o[k])) : r(null)));
  const put = (obj) => new Promise((r) => (hasChrome ? chrome.storage.local.set(obj, r) : r()));
  /* cleared when Chrome closes */
  const session = hasChrome && chrome.storage.session;

  const isPro = () => !!(A && A.isPro());
  const signedIn = () => !!(A && A.signedIn());
  const trialDays = () => (A && A.trialDays) || 7;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  }

  /* a button that shows it is working; an error lands in `msg` */
  function busy(btn, text, msg, work) {
    const was = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
    msg.hidden = true;
    return Promise.resolve().then(work).catch((err) => {
      msg.textContent = (err && err.message) || String(err);
      msg.hidden = false;
    }).finally(() => { btn.disabled = false; btn.textContent = was; });
  }

  /* the button that leads to Pro: the plans box when signed in, otherwise
     sign in (which starts the free trial on a new account) */
  function upgradeButtons(msg, after) {
    if (!A || A.allFree) return [];
    if (!signedIn()) {
      return [h("button", {
        type: "button", class: "pro-btn is-primary", text: "Sign in — " + trialDays() + " days free",
        onclick: () => { after(); if (AS) AS.open("account"); },
      })];
    }
    return [h("button", { type: "button", class: "pro-btn is-primary", text: "See Atlas Pro",
      onclick: () => { after(); openBox(); } })];
  }

  /* ---------- the upgrade box ---------- */
  const ICON = {
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.3-.7-2.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.2" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18.5Z"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5M12 11v5"/>',
    spark: '<path d="M12 3.5 13.8 9 19.5 10.5 13.8 12 12 17.5 10.2 12 4.5 10.5 10.2 9Z"/><path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6Z"/><path d="m8.5 8.5 7 7"/>',
  };
  const svg = (name, cls) => {
    const s = h("span", { class: cls || "pro-ico", "aria-hidden": "true" });
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + "</svg>";
    return s;
  };
  const PERKS = [
    ["palette", "Every theme & cursor", "All presets, your own colours, glass and fonts, every cursor"],
    ["image", "Unlimited 4K wallpapers", "Stills and live videos — free accounts get " + FREE_WALLPAPERS],
    ["shield", "Site blocker", "Block distracting sites, on a schedule or all day"],
    ["lock", "Private space", "An encrypted corner for what's only yours"],
    ["mic", "Voice typing & assistant voice", "Talk to search and chat, hear answers read out"],
    ["cloud", "Sync & backup", "Everything in step on every computer"],
    ["spark", "AI planner & stats", "Day planner, calendar and 30-day insights"],
  ];
  const money = (p) => {
    if (!p || !Number.isFinite(p.amount)) return "";
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency || "USD", minimumFractionDigits: p.amount % 1 ? 2 : 0 }).format(p.amount);
    } catch { return "$" + p.amount; }
  };

  let box = null;
  let lastFocus = null;
  function closeBox() {
    if (!box) return;
    const b = box;
    box = null;
    b.classList.add("is-leaving");
    setTimeout(() => b.remove(), 180);
    document.removeEventListener("keydown", onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeBox(); }
  }
  /* title / text: why the box opened (e.g. "Backup is part of Atlas Pro.") */
  function openBox(title, text) {
    closeBox();
    lastFocus = document.activeElement;
    const msg = h("p", { class: "pro-err", role: "alert", hidden: true });
    const t = A && A.trial();
    let interval = "year";
    let prices = Object.assign({ monthly: { amount: 5, currency: "USD" } }, CFG.prices);

    /* plan picker: two cards, yearly first since it's the better deal */
    const planCard = (key, label) => h("button", {
      type: "button", class: "pro-plan", role: "radio", "data-key": key,
      onclick: () => { interval = key; paint(); },
    }, h("span", { class: "pro-plan-radio" }),
      h("span", { class: "pro-plan-body" },
        h("span", { class: "pro-plan-name", text: label }),
        h("span", { class: "pro-plan-note" })),
      h("span", { class: "pro-plan-price" }),
      h("span", { class: "pro-plan-badge", hidden: true }));
    const yearCard = planCard("year", "Yearly");
    const monthCard = planCard("month", "Monthly");
    const plans = h("div", { class: "pro-plans", role: "radiogroup", "aria-label": "Billing period" }, yearCard, monthCard);

    const cta = h("button", { type: "button", class: "pro-cta" });
    const ctaLabel = () => (!signedIn() ? "Sign in with Google — " + trialDays() + " days free" : "Continue to checkout");
    cta.addEventListener("click", () => {
      if (!signedIn()) { closeBox(); if (AS) AS.open("account"); return; }
      busy(cta, "Opening secure checkout…", msg, async () => {
        await A.upgrade(interval);
        closeBox();
      });
    });

    function paint() {
      const m = prices.monthly, y = prices.yearly;
      const save = m && y && m.amount > 0 ? Math.round((1 - y.amount / (m.amount * 12)) * 100) : 0;
      [[yearCard, "year", y], [monthCard, "month", m]].forEach(([card, key, p]) => {
        card.classList.toggle("is-on", interval === key);
        card.setAttribute("aria-checked", String(interval === key));
        card.querySelector(".pro-plan-price").textContent = p ? money(p) : "";
        card.querySelector(".pro-plan-note").textContent = key === "year"
          ? (y ? money({ amount: Math.floor((y.amount / 12) * 100) / 100, currency: y.currency }) + " / month, billed yearly" : "Billed once a year")
          : "Billed monthly, cancel anytime";
        const badge = card.querySelector(".pro-plan-badge");
        badge.hidden = !(key === "year" && save > 0);
        badge.textContent = "Save " + save + "%";
      });
      plans.hidden = !signedIn();
      cta.textContent = ctaLabel();
    }

    const status = t && t.active
      ? h("p", { class: "pro-pill", text: "Your free trial ends in " + t.daysLeft + (t.daysLeft === 1 ? " day" : " days") })
      : t && !t.active ? h("p", { class: "pro-pill is-warn", text: "Your free trial has ended" }) : null;

    box = h("div", { class: "pro-modal" },
      h("div", { class: "pro-backdrop", onclick: closeBox }),
      h("div", { class: "pro-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "proTitle" },
        h("button", { type: "button", class: "pro-x", "aria-label": "Close", text: "✕", onclick: closeBox }),
        h("div", { class: "pro-hero" },
          h("span", { class: "pro-tag", text: "ATLAS PRO" }),
          h("h2", { class: "pro-title", id: "proTitle", text: title && title !== "Atlas Pro" ? title : "Make Atlas entirely yours" }),
          h("p", { class: "pro-text", text: text || "Every theme, unlimited 4K wallpapers, sync and more — one small subscription." }),
          status),
        h("ul", { class: "pro-perks" }, PERKS.map(([ic, name, sub]) =>
          h("li", null, svg(ic), h("span", null, h("b", { text: name }), h("small", { text: sub }))))),
        plans,
        cta,
        msg,
        h("p", { class: "pro-fine", text: "Secure payment by Paddle · Cancel anytime from Customize › Account" })));
    document.body.append(box);
    document.addEventListener("keydown", onKey, true);
    paint();
    cta.focus();
    if (A && A.plans) A.plans().then((p) => {
      if (p && p.monthly) prices = Object.assign({}, prices, p);
      if (box) paint();
    });
  }

  /* ---------- after checkout ----------
     Paddle's page is in another tab. When this tab is looked at again, ask
     the server (which asks Paddle) until the subscription shows up. */
  let toast = null;
  let watching = false;
  function showToast(kind, title, text, actions) {
    if (toast) toast.remove();
    toast = h("div", { class: "pro-toast is-" + kind, role: "status", "aria-live": "polite" },
      kind === "wait" ? h("span", { class: "pro-spin", "aria-hidden": "true" }) : svg(kind === "ok" ? "check" : "spark", "pro-toast-ico"),
      h("div", { class: "pro-toast-body" }, h("b", { text: title }), text ? h("span", { text }) : null),
      actions && actions.length ? h("div", { class: "pro-toast-acts" }, actions) : null);
    document.body.append(toast);
    return toast;
  }
  function hideToast() {
    if (!toast) return;
    const t = toast;
    toast = null;
    t.classList.add("is-leaving");
    setTimeout(() => t.remove(), 220);
  }
  function celebrate() {
    hideToast();
    closeBox();
    const m = h("div", { class: "pro-modal" },
      h("div", { class: "pro-backdrop" }),
      h("div", { class: "pro-panel pro-done", role: "dialog", "aria-modal": "true", "aria-labelledby": "proDone" },
        svg("check", "pro-done-ico"),
        h("h2", { class: "pro-title", id: "proDone", text: "Welcome to Atlas Pro" }),
        h("p", { class: "pro-text", text: "Your payment went through and everything is unlocked: themes, wallpapers, sync, the lot. Thank you for supporting Atlas." }),
        h("button", { type: "button", class: "pro-cta", text: "Start exploring", onclick: () => {
          m.classList.add("is-leaving");
          setTimeout(() => m.remove(), 180);
        } })));
    document.body.append(m);
    m.querySelector(".pro-cta").focus();
  }
  async function watchPurchase() {
    /* while the user is still on Paddle's tab, wait until they're back */
    if (watching || document.hidden || !A || !A.pendingPurchase || !signedIn()) return;
    const pending = await A.pendingPurchase();
    if (!pending || watching) return;
    if (A.paid()) { A.clearPending(); return; }
    watching = true;
    showToast("wait", "Confirming your payment…", "This only takes a few seconds.");
    const until = Date.now() + 60_000;
    try {
      while (Date.now() < until) {
        const pro = await A.syncBilling().catch(() => false);
        if (pro) {
          await A.clearPending();
          celebrate();
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      const again = h("button", { type: "button", class: "pro-btn is-primary", text: "Check again", onclick: () => { hideToast(); watchPurchase(); } });
      const skip = h("button", { type: "button", class: "pro-btn is-quiet", text: "I didn't buy", onclick: () => { A.clearPending(); hideToast(); } });
      showToast("info", "We haven't seen your payment yet", "If you finished checkout, it can take a minute to arrive.", [again, skip]);
    } finally {
      watching = false;
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) watchPurchase(); });
  window.addEventListener("focus", () => watchPurchase());

  function need(text) {
    if (isPro()) return false;
    openBox("Atlas Pro", text);
    return true;
  }

  /* ---------- online wallpapers: a few for free ---------- */
  const USED_KEY = "wp:used";
  let used = [];
  const usedReady = get(USED_KEY).then((v) => { if (Array.isArray(v)) used = v.filter((k) => typeof k === "string").slice(0, 200); });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch[USED_KEY] && Array.isArray(ch[USED_KEY].newValue)) used = ch[USED_KEY].newValue;
  });
  const wallpapersLeft = () => Math.max(0, FREE_WALLPAPERS - used.length);
  const canUse = (key) => isPro() || used.includes(key) || used.length < FREE_WALLPAPERS;
  /* true = go ahead (and count it); false = the upgrade box is open */
  function wallpaper(key) {
    if (isPro() || used.includes(key)) return true;
    if (used.length >= FREE_WALLPAPERS) {
      openBox("Atlas Pro", "You've used your " + FREE_WALLPAPERS + " free wallpapers. Atlas Pro sets as many built-in, 4K and live wallpapers as you like.");
      return false;
    }
    used = used.concat(key);
    put({ [USED_KEY]: used });
    return true;
  }

  /* the built-in wallpapers (config.js) share the count */
  const firstBuiltIn = () => (typeof WALLPAPERS !== "undefined" && WALLPAPERS[0] ? WALLPAPERS[0].id : "");
  const canUseBuiltIn = (id) => id === firstBuiltIn() || canUse("bi:" + id);
  const builtIn = (id) => id === firstBuiltIn() || wallpaper("bi:" + id);
  /* the order a free account sees wallpapers in: its own first (already
     chosen, or the free built-in one), then ones it can still choose, then
     the locked ones. Pro: all 0, so lists keep their own order. */
  const rank = (key) => (isPro() || used.includes(key) || key === "bi:" + firstBuiltIn() ? 0 : canUse(key) ? 1 : 2);

  /* ---------- after the server has answered ---------- */
  /* only when this computer already thinks the account isn't Pro (a paid
     plan or a trial ends on the date it knows), and on a new tab at most
     every few minutes; a sign-in or plan change checks straight away */
  const TRIAL_SEEN = "pro:trialEndedSeen";
  const CHECKED_KEY = "pro:checkedAt";
  async function check(force) {
    if (!A || isPro()) return;
    if (!force && session) {
      const o = await session.get([CHECKED_KEY]).catch(() => ({}));
      if (Date.now() - (o[CHECKED_KEY] || 0) < 10 * 60_000) return;
    }
    if (session) session.set({ [CHECKED_KEY]: Date.now() }).catch(() => {});
    const pro = await A.verify();
    if (pro !== false) return; // Pro, or offline: change nothing
    if (AS && AS.dropPro) AS.dropPro();
    /* the trial has just run out: say so once per account */
    const t = A.trial();
    const u = A.user();
    if (t && !t.active && u && (await get(TRIAL_SEEN)) !== u.id) {
      await put({ [TRIAL_SEEN]: u.id });
      if (!document.querySelector(".pro-welcome.is-ended")) {
        openBox("Your free trial has ended", "Thanks for trying Atlas Pro. Subscribe to keep every theme, cursor and wallpaper, the private space and backup.");
      }
    }
  }

  /* ---------- welcome, once each time the browser opens ----------
     chrome.storage.session is cleared when Chrome closes, so the first new
     tab of every browser session shows it. */
  const WELCOME_KEY = "atlas:welcomed";
  async function firstTabOfSession() {
    try {
      if (session) {
        const o = await session.get([WELCOME_KEY]);
        if (o[WELCOME_KEY]) return false;
        await session.set({ [WELCOME_KEY]: Date.now() });
        return true;
      }
      if (sessionStorage.getItem(WELCOME_KEY)) return false;
      sessionStorage.setItem(WELCOME_KEY, "1");
      return true;
    } catch { return false; }
  }

  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 22 ? "Good evening" : "Good night";
  }

  /* a toast on the right: in, 5 seconds (hover pauses), out. `done` runs
     once it has gone, however it went (the tour waits for it). */
  const WELCOME_MS = 5000;
  function welcome(done) {
    const u = A && A.user();
    const first = u && u.name ? String(u.name).trim().split(/\s+/)[0] : "";
    const t = A && A.trial();
    const ended = !!(t && !t.active && !isPro());
    const msg = h("p", { class: "pro-err", role: "alert", hidden: true });
    let line = "";
    let badge = null;
    let buttons = [];
    let card = null;
    const close = () => {
      if (!card) return;
      card.classList.add("is-leaving");
      const c = card;
      card = null;
      setTimeout(() => { c.remove(); if (done) done(); }, 320);
    };
    if (A && !A.allFree) {
      if (!signedIn()) {
        line = "Sign in with Google to start your " + trialDays() + "-day free trial of Atlas Pro.";
        buttons = upgradeButtons(msg, close);
      } else if (t && t.active) {
        badge = t.daysLeft + (t.daysLeft === 1 ? " day" : " days") + " of Pro left";
        line = "Enjoying the trial? Keep every theme and wallpaper when it ends.";
        buttons = upgradeButtons(msg, close);
      } else if (ended) {
        line = "Your free trial has ended. Subscribe to keep every theme, cursor and wallpaper, the private space and backup.";
        buttons = upgradeButtons(msg, close);
      } else if (isPro()) {
        badge = "Pro";
        line = "Thank you for supporting Atlas.";
      }
    }
    if (window.AtlasTour) {
      buttons.push(h("button", { type: "button", class: "pro-btn is-quiet", text: "Take the tour",
        onclick: () => { done = null; close(); AtlasTour.start(); } }));
    }
    const hr = new Date().getHours();
    const emoji = hr < 5 || hr >= 22 ? "🌙" : hr < 12 ? "☀️" : hr < 17 ? "👋" : "🌆";
    const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const bar = h("span", { class: "pw-bar" });
    card = h("div", { class: "pro-welcome" + (ended ? " is-ended" : ""), role: "status", "aria-live": "polite" },
      h("span", { class: "pw-emoji", "aria-hidden": "true", text: emoji }),
      h("div", { class: "pw-body" },
        h("p", { class: "pro-welcome-date" }, date, badge ? h("span", { class: "pw-badge", text: badge }) : null),
        h("h2", { class: "pro-welcome-title", text: greeting() + (first ? ", " + first : "") }),
        line ? h("p", { class: "pro-text", text: line }) : null,
        buttons.length ? h("div", { class: "pro-btns" }, buttons) : null,
        msg),
      h("button", { type: "button", class: "pro-x", "aria-label": "Close", text: "✕", onclick: close }),
      h("span", { class: "pw-track", "aria-hidden": "true" }, bar));
    document.body.append(card);

    /* the bar drains with the time left; hover or focus inside pauses it */
    bar.style.animationDuration = WELCOME_MS + "ms";
    let left = WELCOME_MS;
    let since = Date.now();
    let timer = setTimeout(close, left);
    const pause = (on) => {
      if (!card || card.classList.contains("is-paused") === on) return;
      card.classList.toggle("is-paused", on);
      clearTimeout(timer);
      if (on) left -= Date.now() - since;
      else { since = Date.now(); timer = setTimeout(close, Math.max(400, left)); }
    };
    card.addEventListener("mouseenter", () => pause(true));
    card.addEventListener("mouseleave", () => { if (!card || !card.contains(document.activeElement)) pause(false); });
    card.addEventListener("focusin", () => pause(true));
    card.addEventListener("focusout", (e) => { if (card && !card.contains(e.relatedTarget) && !card.matches(":hover")) pause(false); });
  }

  const startTour = () => { if (window.AtlasTour) AtlasTour.auto(); };
  const accountReady = A ? Promise.resolve(A.ready).catch(() => {}) : Promise.resolve();
  accountReady.then(async () => {
    if (await firstTabOfSession()) welcome(startTour);
    else startTour();
    check().catch(() => {});
    watchPurchase();
  });
  /* signed in or out, or the plan changed in another tab */
  let was = null;
  if (A) A.on(() => {
    const now = signedIn() + ":" + isPro();
    if (was !== null && now !== was) check(true).catch(() => {});
    was = now;
  });
  accountReady.then(() => { was = signedIn() + ":" + isPro(); });

  window.AtlasPro = {
    isPro,
    need,
    open: openBox,
    watchPurchase,
    wallpaper,
    canUse,
    builtIn,
    canUseBuiltIn,
    rank,
    wallpapersLeft,
    freeWallpapers: FREE_WALLPAPERS,
    usedReady,
    freeTheme: (id) => FREE_THEMES.includes(id),
    freeCursor: (style) => FREE_CURSORS.includes(style),
    FREE_THEMES,
    FREE_CURSORS,
  };
})();
