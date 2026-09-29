/* ATLAS NEW TAB — daily quote
   A quote on the new tab: the same one all day ("day"), or a fresh one on
   every new tab ("tab"). It comes from the built-in list below, your own
   quotes, or both, filtered by category. ↻ picks another right away and
   that pick holds for the rest of the day.

   Settings: widgets.quote (show, placement, source, cat, every) and
   quotes.custom (your quotes), both in customize.js. Quick tools → Daily
   quote is where they are changed. Today's pick: "quote:today".          */

(() => {
  "use strict";
  const AS = window.AtlasSettings;
  if (!AS) return;

  const CATS = [
    ["all", "All"], ["motivation", "Motivation"], ["focus", "Focus"], ["wisdom", "Wisdom"], ["calm", "Calm"],
  ];
  /* [text, author, category] */
  const BUILT_IN = [
    ["The secret of getting ahead is getting started.", "Mark Twain", "motivation"],
    ["It always seems impossible until it's done.", "Nelson Mandela", "motivation"],
    ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson", "motivation"],
    ["Well done is better than well said.", "Benjamin Franklin", "motivation"],
    ["You don't have to be great to start, but you have to start to be great.", "Zig Ziglar", "motivation"],
    ["Act as if what you do makes a difference. It does.", "William James", "motivation"],
    ["Believe you can and you're halfway there.", "Theodore Roosevelt", "motivation"],
    ["Success is the sum of small efforts, repeated day in and day out.", "Robert Collier", "motivation"],
    ["The future depends on what you do today.", "Mahatma Gandhi", "motivation"],
    ["Quality is not an act, it is a habit.", "Aristotle", "motivation"],
    ["What you do today can improve all your tomorrows.", "Ralph Marston", "motivation"],
    ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe", "motivation"],
    ["Great things are done by a series of small things brought together.", "Vincent van Gogh", "motivation"],
    ["Energy and persistence conquer all things.", "Benjamin Franklin", "motivation"],
    ["Little by little, one travels far.", "J. R. R. Tolkien", "motivation"],
    ["Where focus goes, energy flows.", "Tony Robbins", "focus"],
    ["Concentrate all your thoughts upon the work at hand.", "Alexander Graham Bell", "focus"],
    ["The main thing is to keep the main thing the main thing.", "Stephen Covey", "focus"],
    ["Simplicity boils down to two steps: identify the essential, eliminate the rest.", "Leo Babauta", "focus"],
    ["It's not that I'm so smart, it's just that I stay with problems longer.", "Albert Einstein", "focus"],
    ["Lost time is never found again.", "Benjamin Franklin", "focus"],
    ["Until we can manage time, we can manage nothing else.", "Peter Drucker", "focus"],
    ["Do the hard jobs first. The easy jobs will take care of themselves.", "Dale Carnegie", "focus"],
    ["You can do anything, but not everything.", "David Allen", "focus"],
    ["Deep work is the superpower of the 21st century.", "Cal Newport", "focus"],
    ["Focus on being productive instead of busy.", "Tim Ferriss", "focus"],
    ["The shorter way to do many things is to do only one thing at a time.", "Mozart", "focus"],
    ["Knowing yourself is the beginning of all wisdom.", "Aristotle", "wisdom"],
    ["The only true wisdom is in knowing you know nothing.", "Socrates", "wisdom"],
    ["In the middle of difficulty lies opportunity.", "Albert Einstein", "wisdom"],
    ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche", "wisdom"],
    ["We are what we repeatedly do.", "Will Durant", "wisdom"],
    ["Life is really simple, but we insist on making it complicated.", "Confucius", "wisdom"],
    ["The wound is the place where the light enters you.", "Rumi", "wisdom"],
    ["Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", "Rumi", "wisdom"],
    ["An investment in knowledge pays the best interest.", "Benjamin Franklin", "wisdom"],
    ["The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese proverb", "wisdom"],
    ["Be kind, for everyone you meet is fighting a hard battle.", "Ian Maclaren", "wisdom"],
    ["Learn as if you will live forever, live like you will die tomorrow.", "Mahatma Gandhi", "wisdom"],
    ["We suffer more often in imagination than in reality.", "Seneca", "wisdom"],
    ["Waste no more time arguing what a good man should be. Be one.", "Marcus Aurelius", "wisdom"],
    ["Nature does not hurry, yet everything is accomplished.", "Lao Tzu", "calm"],
    ["Almost everything will work again if you unplug it for a few minutes, including you.", "Anne Lamott", "calm"],
    ["Peace comes from within. Do not seek it without.", "Buddha", "calm"],
    ["Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure.", "Oprah Winfrey", "calm"],
    ["Slow down and everything you are chasing will come around and catch you.", "John De Paola", "calm"],
    ["Within you, there is a stillness and a sanctuary.", "Hermann Hesse", "calm"],
    ["Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", "Buddha", "calm"],
    ["Rest is not idleness.", "John Lubbock", "calm"],
    ["The quieter you become, the more you can hear.", "Ram Dass", "calm"],
    ["Wherever you are, be all there.", "Jim Elliot", "calm"],
    ["Keep your face always toward the sunshine, and shadows will fall behind you.", "Walt Whitman", "calm"],
    ["Take rest; a field that has rested gives a bountiful crop.", "Ovid", "calm"],
  ].map(([text, author, cat], i) => ({ id: "b" + i, text, author, cat }));

  const TODAY_KEY = "quote:today";
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const dayStamp = () => new Date().toDateString();
  const cfg = () => AS.get().widgets.quote;

  function pool() {
    const c = cfg();
    const mine = (AS.get().quotes.custom || []).map((q) => Object.assign({ cat: "mine" }, q));
    let list = c.source === "mine" ? mine : c.source === "builtin" ? BUILT_IN.slice() : BUILT_IN.concat(mine);
    /* your own quotes aren't filed under a category, so a filter keeps them */
    if (c.cat !== "all") list = list.filter((q) => q.cat === c.cat || q.cat === "mine");
    return list;
  }

  /* the same quote all day: a hash of the date, over today's pool */
  function dailyIndex(n) {
    let h = 0;
    for (const ch of dayStamp()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % n;
  }

  let today = null; // { day, id } — a pick that holds for the day
  let current = null;
  let lastRandom = "";

  function choose() {
    const list = pool();
    if (!list.length) return null;
    if (today && today.day === dayStamp()) {
      const held = list.find((q) => q.id === today.id);
      if (held) return held;
    }
    if (cfg().every === "tab") {
      const others = list.length > 1 ? list.filter((q) => q.id !== lastRandom) : list;
      const q = others[Math.floor(Math.random() * others.length)];
      lastRandom = q.id;
      return q;
    }
    return list[dailyIndex(list.length)];
  }

  /* ↻: another quote, which then holds for the rest of the day */
  function next() {
    const list = pool();
    if (!list.length) return null;
    const others = list.length > 1 ? list.filter((q) => !current || q.id !== current.id) : list;
    const q = others[Math.floor(Math.random() * others.length)];
    today = { day: dayStamp(), id: q.id };
    if (hasChrome) chrome.storage.local.set({ [TODAY_KEY]: today });
    show(q);
    return q;
  }

  /* ---------- the widget ---------- */
  const el = document.createElement("figure");
  el.className = "quote";
  el.id = "quote";
  el.hidden = true;
  el.innerHTML =
    '<blockquote class="quote-text"></blockquote>' +
    '<figcaption class="quote-by"></figcaption>' +
    '<div class="quote-tools">' +
    '<button type="button" class="quote-btn" data-act="next" title="Another quote" aria-label="Another quote">' +
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v3.7h-3.7"/></svg></button>' +
    '<button type="button" class="quote-btn" data-act="copy" title="Copy" aria-label="Copy quote">' +
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg></button>' +
    '<button type="button" class="quote-btn" data-act="edit" title="Quote settings" aria-label="Quote settings">' +
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></button>' +
    "</div>";
  document.body.append(el);
  const textEl = el.querySelector(".quote-text");
  const byEl = el.querySelector(".quote-by");

  el.addEventListener("click", (e) => {
    const b = e.target.closest(".quote-btn");
    if (!b) return;
    if (b.dataset.act === "next") next();
    else if (b.dataset.act === "copy" && current && navigator.clipboard) {
      navigator.clipboard.writeText("“" + current.text + "”" + (current.author ? " — " + current.author : ""));
      b.classList.add("is-done");
      setTimeout(() => b.classList.remove("is-done"), 1200);
    } else if (b.dataset.act === "edit" && window.AtlasQuickTools) AtlasQuickTools.open("quote");
  });

  const listeners = [];
  function show(q) {
    current = q;
    const on = cfg().show && !!q;
    el.hidden = !on;
    if (q) {
      el.classList.remove("is-in");
      void el.offsetWidth; // replay the fade
      el.classList.add("is-in");
      textEl.textContent = "“" + q.text + "”";
      byEl.textContent = q.author ? "— " + q.author : "";
      byEl.hidden = !q.author;
    }
    listeners.forEach((fn) => fn(q));
  }
  const refresh = () => show(choose());

  AS.on((s, path) => {
    if (path === "*" || path.startsWith("widgets.quote.") || path.startsWith("quotes.")) refresh();
  });
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[TODAY_KEY]) return;
    today = ch[TODAY_KEY].newValue || null;
    const q = choose();
    if (!current || !q || q.id !== current.id) show(q);
  });
  /* a new day brings a new quote to a tab left open */
  setInterval(() => {
    if (cfg().every === "day" && current && (!today || today.day !== dayStamp())) {
      const q = choose();
      if (q && q.id !== current.id) show(q);
    }
  }, 60000);

  Promise.all([AS.ready, hasChrome ? new Promise((r) => chrome.storage.local.get([TODAY_KEY], r)) : {}]).then(([, o]) => {
    today = (o && o[TODAY_KEY]) || null;
    refresh();
  });

  window.AtlasQuote = {
    CATS,
    builtInCount: BUILT_IN.length,
    current: () => current,
    next,
    poolSize: () => pool().length,
    on: (fn) => listeners.push(fn),
  };
})();
