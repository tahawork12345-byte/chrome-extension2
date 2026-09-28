/* ATLAS NEW TAB — schedules
   One small date engine shared by the wallpaper schedule (customize.js /
   app.js), reminders (reminders.js) and the background worker, which
   loads it with importScripts. Everything is local time.

   A rule is { repeat, date, time, days }:
     repeat  "once" | "daily" | "weekly" | "monthly" | "yearly"
     date    "YYYY-MM-DD"  once: the day; monthly: its day of the month;
                           yearly: its month and day (the year is ignored)
     time    "HH:MM"
     days    [0..6] (Sunday = 0), for weekly
   A monthly rule on the 31st falls on the last day of shorter months, and
   a yearly 29 February on the 28th outside leap years.                   */

(function (root) {
  "use strict";

  const REPEATS = ["once", "daily", "weekly", "monthly", "yearly"];
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const pad = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

  function parseTime(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    return h < 24 && min < 60 ? [h, min] : null;
  }
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    return mo < 12 && d >= 1 && d <= 31 ? [y, mo, d] : null;
  }
  const lastDay = (y, mo) => new Date(y, mo + 1, 0).getDate();

  /* a clean copy, or null when the rule can't be scheduled */
  function normalize(r) {
    if (!r || typeof r !== "object") return null;
    const repeat = REPEATS.includes(r.repeat) ? r.repeat : "once";
    const time = parseTime(r.time) ? r.time.padStart(5, "0") : null;
    if (!time) return null;
    const date = parseDate(r.date) ? r.date : today();
    const days = Array.from(new Set((Array.isArray(r.days) ? r.days : []).map(Number)))
      .filter((d) => d >= 0 && d <= 6).sort();
    if (repeat === "weekly" && !days.length) return null;
    return { repeat, date, time, days };
  }

  /* the occurrence of `r` on the calendar day (y, mo, d), as a timestamp */
  function at(y, mo, d, time) {
    const [h, min] = parseTime(time);
    return new Date(y, mo, d, h, min, 0, 0).getTime();
  }

  /* walk day by day around `from`; step = +1 (forward) or -1 (back) */
  function scan(r, from, step, strict) {
    const [, dmo, dd] = parseDate(r.date);
    const base = new Date(from);
    /* 400 days covers every yearly rule, leap years included */
    for (let i = 0; i <= 400; i++) {
      const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * step);
      const y = day.getFullYear(), mo = day.getMonth(), d = day.getDate(), wd = day.getDay();
      let hit = false;
      if (r.repeat === "daily") hit = true;
      else if (r.repeat === "weekly") hit = r.days.includes(wd);
      else if (r.repeat === "monthly") hit = d === Math.min(dd, lastDay(y, mo));
      else if (r.repeat === "yearly") hit = mo === dmo && d === Math.min(dd, lastDay(y, mo));
      if (!hit) continue;
      const t = at(y, mo, d, r.time);
      if (step > 0 ? (strict ? t > from : t >= from) : t <= from) return t;
    }
    return null;
  }

  /* first occurrence strictly after `after` (ms), or null */
  function next(rule, after) {
    const r = normalize(rule);
    if (!r) return null;
    if (r.repeat === "once") {
      const [y, mo, d] = parseDate(r.date);
      const t = at(y, mo, d, r.time);
      return t > after ? t : null;
    }
    return scan(r, after, 1, true);
  }

  /* latest occurrence at or before `before` (ms), or null */
  function last(rule, before) {
    const r = normalize(rule);
    if (!r) return null;
    if (r.repeat === "once") {
      const [y, mo, d] = parseDate(r.date);
      const t = at(y, mo, d, r.time);
      return t <= before ? t : null;
    }
    return scan(r, before, -1);
  }

  function formatTime(time, h24) {
    const [h, m] = parseTime(time) || [0, 0];
    if (h24) return pad(h) + ":" + pad(m);
    return (h % 12 || 12) + ":" + pad(m) + " " + (h < 12 ? "AM" : "PM");
  }

  /* "Every Mon, Wed at 9:00 AM", "Every year on 14 Feb at 9:00 AM" … */
  function describe(rule, h24) {
    const r = normalize(rule);
    if (!r) return "Not scheduled";
    const t = " at " + formatTime(r.time, h24);
    const [y, mo, d] = parseDate(r.date);
    switch (r.repeat) {
      case "daily": return "Every day" + t;
      case "weekly":
        if (r.days.length === 7) return "Every day" + t;
        if (r.days.join() === "1,2,3,4,5") return "Weekdays" + t;
        if (r.days.join() === "0,6") return "Weekends" + t;
        return "Every " + r.days.map((x) => DAY_NAMES[x]).join(", ") + t;
      case "monthly": return "Monthly on the " + ordinal(d) + t;
      case "yearly": return "Every year on " + d + " " + MONTH_NAMES[mo] + t;
      default: return DAY_NAMES[new Date(y, mo, d).getDay()] + ", " + d + " " + MONTH_NAMES[mo] + " " + y + t;
    }
  }
  function ordinal(n) {
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
    return n + s;
  }

  /* "in 3 hours", "tomorrow at 9:00 AM" — for the next-up line */
  function relative(ts, h24) {
    if (ts == null) return "";
    const diff = ts - Date.now();
    const min = Math.round(diff / 60000);
    if (diff < 0) return "passed";
    if (min < 1) return "in under a minute";
    if (min < 60) return "in " + min + " min";
    const d = new Date(ts);
    const hhmm = formatTime(pad(d.getHours()) + ":" + pad(d.getMinutes()), h24);
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(d) - startOf(new Date())) / 86400000);
    if (days === 0) return "today at " + hhmm;
    if (days === 1) return "tomorrow at " + hhmm;
    if (days < 7) return DAY_NAMES[d.getDay()] + " at " + hhmm;
    return d.getDate() + " " + MONTH_NAMES[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") + " at " + hhmm;
  }

  root.AtlasSchedule = { REPEATS, DAY_NAMES, MONTH_NAMES, normalize, next, last, describe, relative, formatTime, today };
})(globalThis);
