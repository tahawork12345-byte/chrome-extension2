/* ATLAS NEW TAB — the guided tour
   A few steps, each lighting up one part of the page with a card beside
   it: Back / Next / Skip, arrow keys and Esc. It runs once by itself, the
   first time Atlas opens (after the welcome toast, see pro.js), and again
   whenever AtlasTour.start() is called (the toast's "Take the tour").
   A step whose element isn't on the page (hidden, turned off) is skipped. */

(() => {
  "use strict";

  const DONE_KEY = "atlas:tourDone";
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const get = (k) => new Promise((r) => (hasChrome ? chrome.storage.local.get([k], (o) => r(o[k])) : r(localStorage.getItem(k))));
  const put = (k, v) => (hasChrome ? chrome.storage.local.set({ [k]: v }) : localStorage.setItem(k, v));

  const STEPS = [
    { el: "#q", pad: 10, title: "Search from here", text: "Type and press Enter. The icon on the left switches the search engine, and the clock icon shows your recent searches." },
    { el: "#rail", title: "Your workspaces", text: "Keep separate shortcut sets, like Personal and Work, and switch between them with one click." },
    { el: "#launcher", title: "Shortcuts", text: "Your favourite sites in tidy cards. Drag to reorder, right-click to edit or remove, and use the tabs to move between sections." },
    { el: '.rail-btn[aria-label="Customize appearance"]', title: "Make it yours", text: "Themes, wallpapers (including live 4K video), cursors, fonts and your account all live in Customize." },
    { el: '.rail-btn[aria-label="Open Command Center"]', title: "Command Center", text: "Press Ctrl + Space anywhere on the page to jump to any setting, tool or shortcut in a couple of keystrokes." },
    { el: ".qt-bubble", title: "Quick tools", text: "Notes, habits, reminders, focus timer, tab manager and more, one click away." },
    { el: "#aiToggle", title: "Ask Atlas", text: "Your built-in assistant. Ask questions, plan your day or draft something quickly." },
    { el: "#weather", title: "Weather", text: "Click it to set your city if your location isn't detected." },
    { el: "#wpControl", title: "Zen and minimal", text: "Z shows a calm full-screen clock, M hides everything but the essentials. That's the tour. Enjoy Atlas!" },
  ];

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

  const visible = (el) => {
    if (!el || el.closest("[hidden]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };

  let root = null;
  let steps = [];
  let i = 0;
  let spot, card, counter, dots, title, text, back, next;

  function close() {
    if (!root) return;
    put(DONE_KEY, Date.now());
    const r = root;
    root = null;
    r.classList.add("is-leaving");
    setTimeout(() => r.remove(), 260);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight" || e.key === "Enter") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  function go(d) {
    const n = i + d;
    if (n < 0) return;
    if (n >= steps.length) return close();
    i = n;
    paint();
  }

  /* the light around the element, and the card on whichever side has room */
  function place() {
    if (!root) return;
    const s = steps[i];
    const el = document.querySelector(s.el);
    if (!visible(el)) return go(1);
    const pad = s.pad || 8;
    const r = el.getBoundingClientRect();
    const box = {
      left: Math.max(6, r.left - pad), top: Math.max(6, r.top - pad),
      width: Math.min(innerWidth - 12, r.width + pad * 2), height: Math.min(innerHeight - 12, r.height + pad * 2),
    };
    Object.assign(spot.style, { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px" });

    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 16, m = 16;
    const room = {
      bottom: innerHeight - (box.top + box.height), top: box.top,
      right: innerWidth - (box.left + box.width), left: box.left,
    };
    let side = room.bottom >= ch + gap + m ? "bottom" : room.top >= ch + gap + m ? "top"
      : room.right >= cw + gap + m ? "right" : room.left >= cw + gap + m ? "left" : "center";
    let x, y;
    if (side === "bottom" || side === "top") {
      x = box.left + box.width / 2 - cw / 2;
      y = side === "bottom" ? box.top + box.height + gap : box.top - ch - gap;
    } else if (side === "right" || side === "left") {
      x = side === "right" ? box.left + box.width + gap : box.left - cw - gap;
      y = box.top + box.height / 2 - ch / 2;
    } else {
      x = (innerWidth - cw) / 2;
      y = (innerHeight - ch) / 2;
    }
    x = Math.min(Math.max(m, x), innerWidth - cw - m);
    y = Math.min(Math.max(m, y), innerHeight - ch - m);
    card.dataset.side = side;
    card.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)";
  }

  function paint() {
    const s = steps[i];
    counter.textContent = (i + 1) + " of " + steps.length;
    title.textContent = s.title;
    text.textContent = s.text;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? "Finish" : "Next";
    [...dots.children].forEach((d, k) => d.classList.toggle("is-on", k === i));
    card.classList.remove("is-swap");
    void card.offsetWidth; // restart the fade for the new text
    card.classList.add("is-swap");
    place();
    next.focus({ preventScroll: true });
  }

  function start() {
    if (root) return;
    steps = STEPS.filter((s) => visible(document.querySelector(s.el)));
    if (!steps.length) return;
    i = 0;
    /* close anything that would sit on top */
    document.querySelectorAll(".pro-welcome").forEach((n) => n.remove());

    spot = h("div", { class: "tour-spot" });
    counter = h("span", { class: "tour-count" });
    title = h("h3", { class: "tour-title", id: "tourTitle" });
    text = h("p", { class: "tour-text" });
    dots = h("div", { class: "tour-dots", "aria-hidden": "true" }, steps.map(() => h("i")));
    back = h("button", { type: "button", class: "tour-btn", text: "Back", onclick: () => go(-1) });
    next = h("button", { type: "button", class: "tour-btn is-primary", text: "Next", onclick: () => go(1) });
    card = h("div", { class: "tour-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "tourTitle" },
      h("div", { class: "tour-top" }, counter,
        h("button", { type: "button", class: "tour-skip", text: "Skip tour", onclick: () => close() })),
      title, text,
      h("div", { class: "tour-foot" }, dots, h("div", { class: "tour-nav" }, back, next)));
    root = h("div", { class: "tour" },
      /* clicks outside the card don't fall through to the page */
      h("div", { class: "tour-block" }), spot, card);
    document.body.append(root);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    paint();
  }

  /* the first time only */
  async function auto() {
    if (root || (await get(DONE_KEY))) return;
    setTimeout(start, 600);
  }

  window.AtlasTour = { start, auto, reset: () => put(DONE_KEY, 0) };
})();
