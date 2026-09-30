/* The AI day planner (Atlas Pro): the extension sends today's open tasks,
   calendar events, reminders and habits, and Gemini lays them out as a
   timeline between `from` and `to`. Everything the extension sends is
   checked and trimmed here; the answer is checked again before it goes back. */
import { HttpError } from "../lib/http-error.js";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["event", "task", "focus", "break", "habit", "routine"];
const MAX_BLOCKS = 40;

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const time = (v) => (TIME.test(v) ? v : "");
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
/* an end time of 00:00 is midnight tonight (the plan is for one day) */
const endMins = (t) => mins(t) || 24 * 60;
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const list = (v, n, fn) => (Array.isArray(v) ? v : []).slice(0, n).map(fn).filter(Boolean);

/* the request body -> a clean day, or a 400 */
export function readDay(body) {
  const b = body || {};
  const from = time(b.from);
  const to = time(b.to);
  if (!DATE.test(b.date || "") || !from || !to) throw new HttpError(400, "Send date, from and to.");
  if (endMins(to) - mins(from) < 30) throw new HttpError(400, "Give the plan at least 30 minutes, ending by midnight.");
  const work = Math.min(120, Math.max(10, Number(b.focus && b.focus.work) || 25));
  const rest = Math.min(30, Math.max(3, Number(b.focus && b.focus.short) || 5));
  return {
    date: b.date,
    weekday: str(b.weekday, 12),
    from,
    to,
    focus: { work, short: rest },
    tasks: list(b.tasks, 40, (t) => (t && str(t.text, 200) ? {
      id: str(t.id, 40), text: str(t.text, 200), goal: str(t.goal, 80),
      due: DATE.test(t.due || "") ? t.due : "", at: time(t.time),
    } : null)),
    events: list(b.events, 40, (e) => (e && str(e.title, 150) && (e.allDay || (time(e.start) && time(e.end))) ? {
      title: str(e.title, 150), allDay: !!e.allDay, start: e.allDay ? "" : e.start, end: e.allDay ? "" : e.end,
    } : null)),
    reminders: list(b.reminders, 30, (r) => (r && str(r.title, 150) && time(r.time) ? { title: str(r.title, 150), time: r.time } : null)),
    habits: list(b.habits, 20, (x) => (x && str(x.name, 60) ? { name: str(x.name, 60) } : null)),
    note: str(b.note, 1000),
  };
}

export const PLAN_SYSTEM =
  "You plan one day for the user of a browser new-tab page. You get JSON with a time window (from, to), " +
  "their calendar events, open tasks, reminders, habits still to do today, their focus-timer lengths and a free-text note. " +
  "Return a realistic timeline for the window only. Rules: " +
  "1) Calendar events are fixed: keep their exact times and titles, kind \"event\". Skip all-day events as blocks but take them into account. " +
  "2) Put tasks into the gaps as focus blocks (kind \"focus\", or \"task\" for quick ones under 15 minutes), set taskId to the task's id. " +
  "Overdue and due-today tasks first, then tasks with a time, then the rest. A long task can take several focus blocks. " +
  "3) Focus blocks last about the focus length, followed by a short break (kind \"break\"); after three or four focus blocks, a longer break. " +
  "If the window covers 12:00-14:00, include a lunch break; if it covers 18:00-20:00, a dinner break. " +
  "4) Place habits at a sensible time of day (kind \"habit\"). Reminders are fixed moments: do not schedule a focus block across one — end before it. " +
  "5) Use the note for extra wishes or tasks (kind \"routine\" or \"task\"). Do not invent other work. " +
  "6) Blocks must not overlap, must be in time order, times as HH:MM 24-hour, inside the window; a \"to\" of 00:00 means midnight tonight, and a block ending then ends at 00:00. Leave small gaps rather than packing every minute. " +
  "7) If not everything fits, put the titles of what did not fit in \"unplanned\". " +
  "8) \"summary\" is one or two friendly sentences about the day (what matters most, how busy it is). " +
  "Keep titles short. Write in the language of the note, or English if there is none.";

export const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          start: { type: "STRING" },
          end: { type: "STRING" },
          title: { type: "STRING" },
          kind: { type: "STRING", format: "enum", enum: KINDS },
          taskId: { type: "STRING" },
        },
        required: ["start", "end", "title", "kind"],
        propertyOrdering: ["start", "end", "title", "kind", "taskId"],
      },
    },
    unplanned: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "blocks"],
  propertyOrdering: ["summary", "blocks", "unplanned"],
};

export function planPrompt(day) {
  return "Plan this day:\n" + JSON.stringify(day);
}

/* Gemini's answer -> { summary, blocks, unplanned }, or a 502 */
export function readPlan(text, day) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(502, "The planner gave an answer that couldn't be read. Try again.");
  }
  const lo = mins(day.from);
  const hi = endMins(day.to);
  const ids = new Set(day.tasks.map((t) => t.id).filter(Boolean));
  const blocks = (Array.isArray(raw && raw.blocks) ? raw.blocks : [])
    .map((b) => {
      if (!b || !time(b.start) || !time(b.end) || !str(b.title, 120)) return null;
      const s = Math.max(lo, mins(b.start));
      const e = Math.min(hi, endMins(b.end));
      if (e <= s) return null;
      return {
        start: hhmm(s),
        end: hhmm(e),
        title: str(b.title, 120),
        kind: KINDS.includes(b.kind) ? b.kind : "task",
        taskId: ids.has(b.taskId) ? b.taskId : "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_BLOCKS);
  if (!blocks.length) throw new HttpError(502, "The planner came back empty. Try again, or widen the time window.");
  return {
    summary: str(raw.summary, 400),
    blocks,
    unplanned: list(raw.unplanned, 20, (u) => str(u, 120) || null),
  };
}
