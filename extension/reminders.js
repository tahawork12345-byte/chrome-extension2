/* ATLAS NEW TAB — reminders
   The Reminders panel (the bell on the dock): reminders at a time, on a
   date, on weekdays, monthly or every year — a friend's birthday, say —
   and the alarm sound they ring with, including the user's own sound.

   This page only edits the list in storage. The background worker keeps a
   chrome.alarms alarm per reminder and does the ringing (system
   notification + looping sound), so reminders go off anywhere in Chrome.
   An open new tab also shows the alarm as a card while it rings.         */

(() => {
  "use strict";

  const S = window.AtlasSchedule;
  const Snd = window.AtlasSounds;
  const AS = window.AtlasSettings;
  const REM_KEY = "reminders";
  const PREF_KEY = "alarmPrefs";
  const PREF_DEFAULTS = { sound: "chime", volume: 80, ringFor: 60, snooze: 10 };
  const MAX_REMINDERS = 100;

  /* ---------- storage (objects in chrome.storage, JSON elsewhere) ---------- */
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const inExtension = hasChrome && chrome.runtime && chrome.runtime.id;
  function read(key, fallback) {
    if (hasChrome) return new Promise((r) => chrome.storage.local.get([key], (o) => r(o[key] === undefined ? fallback : o[key])));
    try { const v = localStorage.getItem("atlas:" + key); return Promise.resolve(v ? JSON.parse(v) : fallback); } catch { return Promise.resolve(fallback); }
  }
  function write(key, value) {
    if (hasChrome) return new Promise((r) => chrome.storage.local.set({ [key]: value }, r));
    try { localStorage.setItem("atlas:" + key, JSON.stringify(value)); } catch {}
    return Promise.resolve();
  }
  const send = (msg) => { if (inExtension) chrome.runtime.sendMessage(msg).catch(() => {}); };

  let reminders = [];
  let prefs = Object.assign({}, PREF_DEFAULTS);
  let hasCustomSound = false;
  let customName = "";

  const uid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const h24 = () => AS.get().widgets.clock.h24;
  const nextOf = (r) => (r.enabled ? S.next(r, Date.now()) : null);

  const saveReminders = () => write(REM_KEY, reminders);
  const savePrefs = () => write(PREF_KEY, prefs);

  /* ---------- tiny element builder (as in customize.js) ---------- */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };
  const group = (title, ...rows) =>
    h("section", { class: "cz-group" }, title ? h("h3", { class: "cz-gtitle", text: title }) : null, ...rows);
  const note = (text) => h("p", { class: "cz-note", text });
  const seg = (options, current, onPick, label) => {
    const wrap = h("div", { class: "cz-seg", role: "radiogroup", "aria-label": label });
    options.forEach(([v, text]) => wrap.append(h("button", {
      type: "button", role: "radio", text, class: v === current ? "is-on" : null, "aria-checked": String(v === current),
      onclick: (e) => {
        wrap.querySelectorAll("button").forEach((b) => { b.classList.remove("is-on"); b.setAttribute("aria-checked", "false"); });
        e.currentTarget.classList.add("is-on");
        e.currentTarget.setAttribute("aria-checked", "true");
        onPick(v);
      },
    })));
    return wrap;
  };

  /* ---------- panel shell: the same drawer and transitions as Customize ---------- */
  const body = h("div", { class: "cz-body rm-body" });
  const titleEl = h("span", { class: "cz-title", text: "Reminders" });
  const panel = h("aside", { class: "cz rm", id: "rm", role: "dialog", "aria-label": "Reminders", hidden: true },
    h("div", { class: "cz-head" },
      titleEl,
      h("button", { type: "button", class: "cz-x", "aria-label": "Close", text: "✕", onclick: () => close() })),
    body);
  document.body.append(panel);

  let view = "list"; // "list" | "edit"
  let editing = null; // the reminder being edited (a copy)
  let closing = false;
  let lastFocus = null;
  let tick = 0;
  let stopPreview = null;

  const isOpen = () => !panel.hidden && !closing;

  function enter(dir) {
    body.dataset.enter = dir;
    Array.from(body.children).forEach((c, i) => c.style.setProperty("--k", Math.min(i, 10)));
    setTimeout(() => delete body.dataset.enter, 1200);
  }

  function render(dir) {
    const scroll = body.scrollTop;
    body.textContent = "";
    body.append(...(view === "edit" ? editView() : listView()));
    titleEl.textContent = view === "edit" ? (editing && editing.isNew ? "New reminder" : "Edit reminder") : "Reminders";
    if (dir) { enter(dir); body.scrollTop = 0; } else body.scrollTop = scroll;
  }

  async function open(startNew) {
    if (AS.isOpen()) AS.close();
    const fresh = panel.hidden || closing;
    if (panel.hidden) lastFocus = document.activeElement;
    closing = false;
    panel.classList.remove("is-closing");
    panel.inert = false;
    panel.dataset.fx = AS.get().lighting.panelFx || "glide";
    await load();
    view = startNew ? "edit" : "list";
    editing = startNew ? blank() : null;
    panel.hidden = false;
    render(fresh ? "open" : "fwd");
    clearInterval(tick);
    /* keep "in 5 min" lines honest while the panel is open */
    tick = setInterval(() => { if (isOpen() && view === "list") render(); }, 30000);
    const first = body.querySelector("input, button");
    if (first && startNew) first.focus();
    markBell();
  }

  function close() {
    if (!isOpen()) return;
    if (stopPreview) { stopPreview(); stopPreview = null; }
    clearInterval(tick);
    closing = true;
    panel.classList.add("is-closing");
    panel.inert = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    const finish = () => {
      if (!closing) return;
      closing = false;
      panel.hidden = true;
      panel.inert = false;
      panel.classList.remove("is-closing");
      body.textContent = "";
      markBell();
    };
    panel.addEventListener("animationend", (e) => { if (e.target === panel) finish(); }, { once: true });
    setTimeout(finish, 1600);
  }

  function markBell() {
    const bell = document.getElementById("railBell");
    if (bell) bell.classList.toggle("is-lit", isOpen());
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen() || e.defaultPrevented) return;
    e.preventDefault();
    if (view === "edit") { view = "list"; editing = null; render("back"); }
    else close();
  });

  async function load() {
    const list = await read(REM_KEY, []);
    reminders = (Array.isArray(list) ? list : []).filter((r) => r && r.id && S.normalize(r));
    prefs = Object.assign({}, PREF_DEFAULTS, await read(PREF_KEY, {}));
    const blob = Snd ? await Snd.getCustom() : null;
    hasCustomSound = !!blob;
    customName = blob && blob.name ? blob.name : prefs.customName || "";
  }

  function blank() {
    const d = new Date(Date.now() + 60 * 60000);
    return {
      isNew: true, id: uid(), title: "", note: "", repeat: "once", date: S.today(),
      time: String(d.getHours()).padStart(2, "0") + ":00", days: [], sound: "default", enabled: true,
    };
  }

  /* ---------- list view ---------- */
  function listView() {
    const out = [];
    const upcoming = reminders
      .map((r) => ({ r, t: nextOf(r) }))
      .sort((a, b) => (a.t == null) - (b.t == null) || (a.t || 0) - (b.t || 0));
    const first = upcoming.find((x) => x.t != null);

    out.push(h("div", { class: "rm-hero" + (first ? "" : " is-empty") },
      h("span", { class: "rm-hero-bell", "aria-hidden": "true", text: "⏰" }),
      first
        ? h("div", { class: "rm-hero-text" },
            h("span", { class: "rm-hero-label", text: "Next up" }),
            h("strong", { text: first.r.title }),
            h("span", { class: "rm-hero-when", text: cap(S.relative(first.t, h24())) }))
        : h("div", { class: "rm-hero-text" },
            h("strong", { text: reminders.length ? "Nothing coming up" : "No reminders yet" }),
            h("span", { class: "rm-hero-when", text: "Birthdays, meetings, medicine — they'll ring here and anywhere in Chrome." }))));

    if (!inExtension) out.push(note("Reminders ring through Chrome's notifications, so they only go off when Atlas runs as the installed extension."));

    out.push(h("div", { class: "cz-btns" },
      h("button", {
        type: "button", class: "cz-btn is-primary", text: "+ New reminder", disabled: reminders.length >= MAX_REMINDERS,
        onclick: () => { view = "edit"; editing = blank(); render("fwd"); },
      })));

    if (upcoming.length) {
      out.push(group("Your reminders", ...upcoming.map(({ r, t }, i) => reminderRow(r, t, i))));
    }
    out.push(soundGroup());
    return out;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function reminderRow(r, t, i) {
    const sw = h("input", {
      class: "cz-switch", type: "checkbox", role: "switch", "aria-label": (r.enabled ? "Turn off " : "Turn on ") + r.title,
      onchange: () => {
        r.enabled = sw.checked;
        r.updatedAt = Date.now(); // don't ring for anything that passed while it was off
        saveReminders();
        render();
      },
    });
    sw.checked = !!r.enabled;
    sw.addEventListener("click", (e) => e.stopPropagation());
    const when = t != null ? cap(S.relative(t, h24())) : r.repeat === "once" ? "Done" : "Off";
    return h("div", {
      class: "rm-item" + (t == null ? " is-off" : ""), role: "button", tabindex: "0", style: "--i:" + i,
      onclick: () => edit(r),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); edit(r); } },
    },
      h("span", { class: "rm-item-icon", "aria-hidden": "true", text: iconFor(r) }),
      h("span", { class: "rm-item-text" },
        h("span", { class: "rm-item-title", text: r.title }),
        h("span", { class: "rm-item-sub", text: S.describe(r, h24()) }),
        h("span", { class: "rm-item-when", text: when })),
      sw);
  }
  /* a hint of what kind of reminder it is */
  function iconFor(r) {
    const t = (r.title + " " + r.note).toLowerCase();
    if (/birthday|bday|b-day|anniversary/.test(t)) return "🎂";
    if (/meet|call|standup|interview/.test(t)) return "📞";
    if (/pill|medicine|meds|dose/.test(t)) return "💊";
    if (/pay|bill|rent|invoice/.test(t)) return "💳";
    return r.repeat === "once" ? "📌" : "🔁";
  }

  function edit(r) {
    editing = Object.assign({}, r, { days: (r.days || []).slice(), isNew: false });
    view = "edit";
    render("fwd");
  }

  /* ---------- edit view ---------- */
  const TEMPLATES = [
    ["🎂 Birthday", { repeat: "yearly", time: "09:00", title: "'s birthday", caret: 0 }],
    ["📌 One-time", { repeat: "once" }],
    ["🔁 Every day", { repeat: "daily" }],
    ["📅 Weekdays", { repeat: "weekly", days: [1, 2, 3, 4, 5] }],
    ["🗓 Monthly", { repeat: "monthly" }],
  ];

  function editView() {
    const r = editing;
    const msg = h("p", { class: "cz-msg is-error", role: "alert", hidden: true });
    const fail = (t) => { msg.textContent = t; msg.hidden = false; };
    const title = h("input", {
      class: "cz-text", type: "text", value: r.title, maxlength: 80, placeholder: "e.g. Sara's birthday", "aria-label": "Title",
      oninput: () => { r.title = title.value; },
    });
    const noteEl = h("textarea", {
      class: "cz-text rm-note", rows: 2, maxlength: 300, placeholder: "Note (optional) — shown in the notification", "aria-label": "Note",
      oninput: () => { r.note = noteEl.value; },
    });
    noteEl.value = r.note || "";

    const out = [];
    if (r.isNew) {
      out.push(h("div", { class: "rm-templates" }, TEMPLATES.map(([label, tpl]) => h("button", {
        type: "button", class: "rm-tpl", text: label,
        onclick: () => {
          Object.assign(r, { repeat: tpl.repeat, days: tpl.days || [] });
          if (tpl.time) r.time = tpl.time;
          render();
          if (tpl.title && !r.title) {
            const t = body.querySelector(".rm-title input");
            t.value = tpl.title;
            r.title = tpl.title;
            t.focus();
            t.setSelectionRange(0, 0); // type the name before "'s birthday"
          }
        },
      }))));
    }
    out.push(
      h("div", { class: "cz-row is-stack rm-title" }, h("span", { class: "cz-label", text: "Remind me about" }), title),
      h("div", { class: "cz-row is-stack" }, noteEl),
      group("When", AS.scheduleFields(r, () => { msg.hidden = true; }, { yearlyLabel: "Every year on (year ignored)" })),
      group("Sound", soundPicker(r)),
      msg,
      h("div", { class: "cz-btns rm-actions" },
        h("button", {
          type: "button", class: "cz-btn is-primary", text: r.isNew ? "Add reminder" : "Save",
          onclick: () => {
            r.title = title.value.trim();
            if (!r.title) { title.focus(); return fail("Give the reminder a name."); }
            if (!S.normalize(r)) return fail("Pick at least one day.");
            if (S.next(r, Date.now()) == null) return fail("That time has already passed — pick a later one.");
            const clean = {
              id: r.id, title: r.title.slice(0, 80), note: (r.note || "").trim().slice(0, 300),
              repeat: r.repeat, date: r.date, time: r.time, days: r.days, sound: r.sound || "default",
              enabled: true, updatedAt: Date.now(), lastFired: 0,
            };
            const i = reminders.findIndex((x) => x.id === r.id);
            if (i >= 0) reminders[i] = clean; else reminders.push(clean);
            saveReminders();
            view = "list";
            editing = null;
            render("back");
          },
        }),
        h("button", { type: "button", class: "cz-btn", text: "Cancel", onclick: () => { view = "list"; editing = null; render("back"); } }),
        r.isNew ? null : h("button", {
          type: "button", class: "cz-btn is-danger", text: "Delete",
          onclick: () => {
            if (!confirm("Delete “" + r.title + "”?")) return;
            reminders = reminders.filter((x) => x.id !== r.id);
            saveReminders();
            view = "list";
            editing = null;
            render("back");
          },
        })));
    if (r.isNew) setTimeout(() => title.focus(), 0);
    return out;
  }

  /* per reminder: the default alarm, any other sound, or silent */
  function soundPicker(r) {
    const defLabel = "Default (" + soundLabel(prefs.sound) + ")";
    const opts = [["default", defLabel]].concat(Snd.BUILTIN.map((s) => [s.id, s.label]));
    if (hasCustomSound) opts.push(["custom", "My sound"]);
    opts.push(["none", "Silent (notification only)"]);
    const sel = h("select", {
      class: "cz-select", "aria-label": "Sound",
      onchange: () => { r.sound = sel.value; },
    }, opts.map(([v, t]) => h("option", { value: v, text: t })));
    sel.value = opts.some(([v]) => v === r.sound) ? r.sound : "default";
    const play = h("button", {
      type: "button", class: "cz-btn", text: "▶ Play",
      onclick: () => preview(sel.value === "default" ? prefs.sound : sel.value, play),
    });
    return h("div", { class: "cz-row" }, sel, sel.value === "none" ? null : play);
  }
  const soundLabel = (id) => (id === "custom" ? "My sound" : (Snd.BUILTIN.find((s) => s.id === id) || Snd.BUILTIN[0]).label);

  /* ---------- the alarm sound: built-ins + the user's own ---------- */
  function preview(id, btn) {
    if (stopPreview) { stopPreview(); stopPreview = null; }
    if (id === "none") return;
    if (btn) { btn.classList.add("is-playing"); }
    Snd.play(id, { volume: prefs.volume, loop: false }).then((stop) => {
      stopPreview = stop;
      setTimeout(() => btn && btn.classList.remove("is-playing"), 2200);
    });
  }

  function soundGroup() {
    const tiles = h("div", { class: "rm-sounds", role: "radiogroup", "aria-label": "Alarm sound" });
    const all = Snd.BUILTIN.map((s) => [s.id, s.label]).concat(hasCustomSound ? [["custom", "My sound"]] : []);
    all.forEach(([id, label]) => {
      const on = prefs.sound === id;
      tiles.append(h("button", {
        type: "button", role: "radio", "aria-checked": String(on), class: "rm-sound" + (on ? " is-on" : ""),
        onclick: (e) => {
          prefs.sound = id;
          savePrefs();
          tiles.querySelectorAll(".rm-sound").forEach((b) => { b.classList.remove("is-on"); b.setAttribute("aria-checked", "false"); });
          e.currentTarget.classList.add("is-on");
          e.currentTarget.setAttribute("aria-checked", "true");
          preview(id, e.currentTarget);
        },
      }, h("span", { class: "rm-sound-wave", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), h("span", { text: label })));
    });

    /* the custom alarm sound, kept on its own */
    const file = h("input", { type: "file", accept: "audio/*", hidden: true });
    const status = h("p", { class: "cz-msg", hidden: true });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      if (!/^audio\//.test(f.type)) { status.textContent = "Pick an audio file (MP3, WAV, OGG, M4A…)."; status.hidden = false; status.classList.add("is-error"); return; }
      if (f.size > 15 * 1024 * 1024) { status.textContent = "That file is over 15 MB — pick a shorter sound."; status.hidden = false; status.classList.add("is-error"); return; }
      try {
        await Snd.setCustom(f);
        prefs.sound = "custom";
        prefs.customName = f.name;
        await savePrefs();
        await load();
        render();
      } catch {
        status.textContent = "Couldn't save that sound.";
        status.hidden = false;
        status.classList.add("is-error");
      }
    });
    const custom = h("div", { class: "rm-custom" },
      h("span", { class: "rm-custom-icon", "aria-hidden": "true", text: "♫" }),
      h("span", { class: "rm-custom-name", text: hasCustomSound ? customName || "Your sound" : "No custom sound yet" }),
      h("button", { type: "button", class: "cz-btn" + (hasCustomSound ? "" : " is-primary"), text: hasCustomSound ? "Replace…" : "Upload…", onclick: () => file.click() }),
      hasCustomSound ? h("button", {
        type: "button", class: "cz-btn", text: "Remove",
        onclick: async () => {
          await Snd.clearCustom();
          if (prefs.sound === "custom") prefs.sound = "chime";
          reminders.forEach((r) => { if (r.sound === "custom") r.sound = "default"; });
          delete prefs.customName;
          await savePrefs();
          await saveReminders();
          await load();
          render();
        },
      }) : null,
      file);

    const vol = h("input", {
      class: "cz-range", type: "range", min: 5, max: 100, step: 5, value: prefs.volume, "aria-label": "Alarm volume",
      oninput: () => { prefs.volume = Number(vol.value); volVal.textContent = vol.value + "%"; },
      onchange: () => { savePrefs(); preview(prefs.sound); },
    });
    const volVal = h("span", { class: "cz-val", text: prefs.volume + "%" });

    return group("Alarm sound",
      tiles,
      h("div", { class: "cz-row is-stack" }, h("span", { class: "cz-label", text: "Custom alarm sound" }), custom, status),
      note("Upload any audio file — a song, a voice note. It loops until you snooze or dismiss the alarm."),
      h("div", { class: "cz-row" }, h("span", { class: "cz-label", text: "Volume" }), h("span", { class: "cz-ctl" }, vol, volVal)),
      h("div", { class: "cz-row is-stack" }, h("span", { class: "cz-label", text: "Ring for" }),
        seg([[30, "30 s"], [60, "1 min"], [120, "2 min"], [300, "5 min"]], prefs.ringFor, (v) => { prefs.ringFor = v; savePrefs(); }, "Ring for")),
      h("div", { class: "cz-row is-stack" }, h("span", { class: "cz-label", text: "Snooze for" }),
        seg([[5, "5 min"], [10, "10 min"], [15, "15 min"], [30, "30 min"]], prefs.snooze, (v) => { prefs.snooze = v; savePrefs(); }, "Snooze for")),
      h("div", { class: "cz-btns" },
        h("button", {
          type: "button", class: "cz-btn", text: "Test alarm", disabled: !inExtension,
          title: inExtension ? "Rings a test reminder now" : "Only in the installed extension",
          onclick: () => send({ type: "reminder:test", title: "Test alarm" }),
        })),
      note("Alarms show as system notifications. If a test doesn't appear, check that notifications for Chrome are allowed in your computer's settings."));
  }

  /* ---------- a ringing reminder, shown on open new tabs ---------- */
  const cards = new Map(); // nid -> element
  function showRinging(m) {
    if (cards.has(m.nid)) return;
    const card = h("div", { class: "rm-ring", role: "alertdialog", "aria-label": "Reminder: " + m.title },
      h("span", { class: "rm-ring-bell", "aria-hidden": "true", text: "⏰" }),
      h("div", { class: "rm-ring-text" },
        h("strong", { text: m.title }),
        m.note ? h("span", { text: m.note }) : null,
        m.late ? h("span", { class: "rm-ring-late", text: "Missed while Chrome was closed" }) : null),
      h("div", { class: "rm-ring-btns" },
        h("button", { type: "button", class: "cz-btn", text: "Snooze " + m.snooze + " min", onclick: () => send({ type: "reminder:snooze", nid: m.nid }) }),
        h("button", { type: "button", class: "cz-btn is-primary", text: "Dismiss", onclick: () => send({ type: "reminder:dismiss", nid: m.nid }) })));
    document.body.append(card);
    cards.set(m.nid, card);
    const b = card.querySelector(".is-primary");
    if (b) b.focus({ preventScroll: true });
  }
  function hideRinging(nid) {
    const card = cards.get(nid);
    if (!card) return;
    cards.delete(nid);
    card.classList.add("is-leaving");
    setTimeout(() => card.remove(), 320);
  }
  if (inExtension) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === "reminder:ring") showRinging(msg);
      else if (msg.type === "reminder:done") hideRinging(msg.nid);
    });
  }
  /* the list changes as reminders ring (a one-time one turns itself off) */
  if (hasChrome && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[REM_KEY] && isOpen() && view === "list") load().then(() => render());
    });
  }

  window.AtlasReminders = {
    open: (startNew) => open(!!startNew),
    close,
    toggle: () => (isOpen() ? close() : open(false)),
    isOpen,
  };
})();
