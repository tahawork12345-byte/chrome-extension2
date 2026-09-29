/* ATLAS NEW TAB — page translator
   Puts every website (and the new tab itself) into the language picked in
   Customize > Language. Runs in the top frame of each page at
   document_idle, and in index.html. It swaps the text of the page in
   place, keeps the original next to each piece so "Show original" can put
   it back, and follows content that arrives later (feeds, SPAs).

   Settings come from the same "appearance" record as the rest of
   Customize (see cursor-apply.js); sites switched off with "Never on this
   site" are kept apart under "translate:never", so a web page never
   writes to the settings record. The words themselves are translated by
   background.js ("translate:batch").                                      */

(() => {
  "use strict";
  if (window.__atlasTranslate || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return;
  window.__atlasTranslate = true;

  const IS_NEWTAB = location.protocol === "chrome-extension:";
  if (!IS_NEWTAB && window.top !== window) return;
  const HOST = location.hostname;
  const NEVER_KEY = "translate:never";

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "KBD", "SAMP", "VAR", "SVG", "MATH", "CANVAS", "IFRAME", "TEMPLATE", "HEAD"]);
  const SKIP_SEL = '[translate="no"], .notranslate, [contenteditable=""], [contenteditable="true"], #atlas-tr-host';
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const HAS_LETTER = /\p{L}/u;
  const BATCH_ITEMS = 100;
  const BATCH_CHARS = 5000;
  const PARALLEL = 4;

  let target = "";       // language the page is in now ("" = original)
  let wanted = "";       // language the settings ask for
  let badgeOn = true;
  let paused = false;    // "Show original" on this page, until reload
  let failed = false;

  const textInfo = new WeakMap(); // Text -> { orig, out }
  const attrInfo = new WeakMap(); // Element -> { attr: { orig, out } }
  const queue = new Set();        // Text nodes and Elements waiting
  let flushTimer = 0;

  /* ---------- what gets translated ---------- */
  function skipped(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.tagName === "TITLE") return false; // the tab title, inside <head>
      if (SKIP_TAGS.has(e.tagName)) return true;
    }
    return !!(el && el.closest && el.closest(SKIP_SEL));
  }
  const worth = (s) => s && s.trim().length > 0 && HAS_LETTER.test(s);

  /* the source text of a node: its original if we changed it before */
  function sourceOf(node) {
    const info = textInfo.get(node);
    if (info && node.data === info.out) return info.orig;
    if (info) textInfo.delete(node); // the page rewrote it: a new original
    return node.data;
  }

  function collect(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (!skipped(root.parentElement) && worth(root.data)) queue.add(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && skipped(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (SKIP_TAGS.has(n.tagName) || n.matches(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        return worth(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const visit = (n) => {
      if (n.nodeType === 3) queue.add(n);
      else if (ATTRS.some((a) => n.hasAttribute(a))) queue.add(n);
    };
    if (root.nodeType === 1) visit(root);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) visit(n);
  }

  /* ---------- turning queued nodes into requests ---------- */
  /* each job: one string to translate + how to write the answer back */
  function jobs() {
    const out = [];
    queue.forEach((n) => {
      if (!n.isConnected) return;
      if (n.nodeType === 3) {
        const src = sourceOf(n);
        const m = src.match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!worth(m[2])) return;
        out.push({ text: m[2], put: (t) => write(n, src, m[1] + t + m[3]) });
        return;
      }
      const map = attrInfo.get(n) || {};
      ATTRS.filter((a) => n.hasAttribute(a)).forEach((a) => {
        const cur = n.getAttribute(a);
        const prev = map[a];
        const src = prev && cur === prev.out ? prev.orig : cur;
        if (!worth(src)) return;
        out.push({
          text: src.trim(),
          put: (t) => {
            map[a] = { orig: src, out: t };
            attrInfo.set(n, map);
            n.setAttribute(a, t);
          },
        });
      });
    });
    queue.clear();
    return out;
  }

  function write(node, orig, out) {
    if (!node.isConnected) return;
    /* the page may have changed it while the request was out */
    const info = textInfo.get(node);
    const now = info && node.data === info.out ? info.orig : node.data;
    if (now !== orig) return;
    textInfo.set(node, { orig, out });
    if (node.data !== out) node.data = out;
  }

  function send(texts, to) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "translate:batch", texts, to }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) resolve(null);
          else resolve(res.out);
        });
      } catch { resolve(null); } // the extension was reloaded under the page
    });
  }

  async function flush() {
    flushTimer = 0;
    const to = target;
    if (!to) { queue.clear(); return; }
    const list = jobs();
    if (!list.length) return;
    /* the same label repeated all over a page is asked once */
    const byText = new Map();
    list.forEach((j) => {
      if (!byText.has(j.text)) byText.set(j.text, []);
      byText.get(j.text).push(j);
    });
    const texts = [...byText.keys()];
    const batches = [];
    let cur = [], chars = 0;
    texts.forEach((t) => {
      if (cur.length && (cur.length >= BATCH_ITEMS || chars + t.length > BATCH_CHARS)) {
        batches.push(cur);
        cur = []; chars = 0;
      }
      cur.push(t);
      chars += t.length;
    });
    if (cur.length) batches.push(cur);

    let i = 0;
    const worker = async () => {
      while (i < batches.length && target === to) {
        const b = batches[i++];
        const out = await send(b, to);
        if (target !== to) return;
        if (!out) { failed = true; paintBadge(); return; }
        /* our own writes aren't news; the page's, still waiting, are */
        handle(observer.takeRecords());
        observer.disconnect();
        b.forEach((t, k) => byText.get(t).forEach((j) => j.put(out[k] || t)));
        observe();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
  }

  const schedule = (ms) => { if (!flushTimer) flushTimer = setTimeout(flush, ms); };

  /* ---------- following the page ---------- */
  function handle(records) {
    if (!target) return;
    records.forEach((r) => {
      if (r.type === "characterData") {
        const info = textInfo.get(r.target);
        if (info && r.target.data === info.out) return;
        collect(r.target);
      } else r.addedNodes.forEach(collect);
    });
    if (queue.size) schedule(350);
  }
  const observer = new MutationObserver(handle);
  function observe() {
    const root = document.documentElement;
    if (root) observer.observe(root, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- switching language ---------- */
  function restore() {
    observer.disconnect();
    queue.clear();
    clearTimeout(flushTimer);
    flushTimer = 0;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.currentNode; n; n = walker.nextNode()) {
      if (n.nodeType === 3) {
        const info = textInfo.get(n);
        if (info && n.data === info.out) n.data = info.orig;
        textInfo.delete(n);
      } else {
        const map = attrInfo.get(n);
        if (!map) continue;
        Object.entries(map).forEach(([a, v]) => {
          if (n.getAttribute(a) === v.out) n.setAttribute(a, v.orig);
        });
        attrInfo.delete(n);
      }
    }
  }

  /* a page already written in the language is left alone */
  function pageIs(lang) {
    const own = (document.documentElement.lang || "").toLowerCase();
    return !!own && own.split("-")[0] === lang.toLowerCase().split("-")[0];
  }

  function apply() {
    const to = paused || (!IS_NEWTAB && pageIs(wanted)) ? "" : wanted;
    if (to === target) { paintBadge(); return; }
    if (target) restore();
    target = to;
    failed = false;
    if (target) {
      collect(document.body);
      const t = document.querySelector("title");
      if (t && t.firstChild) queue.add(t.firstChild);
      observe();
      schedule(0);
    }
    paintBadge();
  }

  function readSettings(raw, never) {
    let s = null;
    try { s = JSON.parse(raw || "null"); } catch {}
    const lang = (s && s.settings && s.settings.language) || {};
    const on = IS_NEWTAB ? lang.newtab !== false : lang.pages !== false && !(never || []).includes(HOST);
    wanted = on && typeof lang.lang === "string" ? lang.lang : "";
    badgeOn = lang.badge !== false;
  }

  /* ---------- the little badge on web pages ---------- */
  let host = null, shadow = null, closed = false;
  function paintBadge() {
    if (IS_NEWTAB) return;
    const show = badgeOn && !closed && wanted && (target || paused || failed);
    if (!show) { if (host) host.hidden = true; return; }
    if (!host) {
      host = document.createElement("div");
      host.id = "atlas-tr-host";
      host.setAttribute("translate", "no");
      shadow = host.attachShadow({ mode: "closed" });
      document.documentElement.append(host);
    }
    host.hidden = false;
    const L = window.AtlasLangs && AtlasLangs.find(wanted);
    const name = L ? L.name : wanted;
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646}
      .b{display:flex;align-items:center;gap:4px;padding:5px 6px 5px 11px;border-radius:999px;
        background:rgba(18,18,22,.86);color:#f7f6f3;font:12px/1.2 system-ui,sans-serif;
        border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 24px -8px rgba(0,0,0,.6);
        backdrop-filter:blur(14px);opacity:.8;transition:opacity .2s}
      .b:hover{opacity:1}
      span{white-space:nowrap;margin-right:4px}
      button{all:unset;cursor:pointer;padding:4px 9px;border-radius:999px;color:#d8c3a5;white-space:nowrap}
      button:hover{background:rgba(255,255,255,.1)}
      .x{color:#aaa;padding:4px 7px}
    </style><div class="b" role="status"></div>`;
    const b = shadow.querySelector(".b");
    const btn = (text, fn, cls) => {
      const e = document.createElement("button");
      e.textContent = text;
      if (cls) e.className = cls;
      e.addEventListener("click", fn);
      b.append(e);
    };
    const label = document.createElement("span");
    b.append(label);
    if (failed) {
      label.textContent = "Couldn't translate this page";
      btn("Retry", () => { failed = false; target = ""; apply(); });
    } else if (paused) {
      label.textContent = "文A Original";
      btn("Translate to " + name, () => { paused = false; apply(); });
    } else {
      label.textContent = "文A " + name;
      btn("Show original", () => { paused = true; apply(); });
      btn("Never here", () => {
        chrome.storage.local.get([NEVER_KEY], (o) => {
          const list = Array.isArray(o[NEVER_KEY]) ? o[NEVER_KEY] : [];
          if (!list.includes(HOST)) list.push(HOST);
          chrome.storage.local.set({ [NEVER_KEY]: list });
        });
      });
    }
    btn("✕", () => { closed = true; paintBadge(); }, "x");
    b.lastChild.setAttribute("aria-label", "Hide");
  }

  /* ---------- boot + live settings ---------- */
  let rawSettings = null, never = [];
  const refresh = () => { readSettings(rawSettings, never); apply(); };
  chrome.storage.local.get(["appearance", NEVER_KEY], (o) => {
    rawSettings = o.appearance;
    never = Array.isArray(o[NEVER_KEY]) ? o[NEVER_KEY] : [];
    if (document.body) refresh();
    else document.addEventListener("DOMContentLoaded", refresh, { once: true });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(changes.appearance || changes[NEVER_KEY])) return;
    if (changes.appearance) rawSettings = changes.appearance.newValue;
    if (changes[NEVER_KEY]) never = Array.isArray(changes[NEVER_KEY].newValue) ? changes[NEVER_KEY].newValue : [];
    if (document.body) refresh();
  });
})();
