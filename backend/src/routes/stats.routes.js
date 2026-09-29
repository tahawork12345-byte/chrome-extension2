import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requirePro } from "../middleware/auth.js";
import { isPro } from "../services/tokens.js";
import { sendEmail } from "../services/email.js";
import { weeklyEmail } from "../services/weekly-email.js";

export const statsRouter = Router();

const MAX_BYTES = 20_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/* the Monday a week starts on, as a UTC date */
function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

statsRouter.get("/stats/prefs", requireAuth, (req, res) => {
  res.json({ weeklyEmail: req.user.weeklyEmail && isPro(req.user) });
});

/* body { weeklyEmail: boolean } */
statsRouter.put("/stats/prefs", requireAuth, async (req, res) => {
  const on = Boolean(req.body && req.body.weeklyEmail);
  if (on && !isPro(req.user)) throw new HttpError(402, "The weekly email is part of Atlas Pro", { code: "pro_required" });
  await prisma.user.update({ where: { id: req.user.id }, data: { weeklyEmail: on } });
  res.json({ weeklyEmail: on });
});

/* body { weeks: [{ week: "YYYY-MM-DD" (a Monday), data: {...} }] }. The
   extension sends this week and last week, so last week is complete by the
   time the email goes out. */
statsRouter.put("/stats/week", requireAuth, requirePro, async (req, res) => {
  const weeks = Array.isArray(req.body && req.body.weeks) ? req.body.weeks.slice(0, 2) : [];
  if (!weeks.length) throw new HttpError(400, "Send { weeks: [{ week, data }] }");
  const now = Date.now();
  for (const w of weeks) {
    if (!w || !YMD.test(w.week) || !w.data || typeof w.data !== "object" || Array.isArray(w.data)) throw new HttpError(400, "Bad week");
    const week = new Date(w.week + "T00:00:00Z");
    if (week.getUTCDay() !== 1 || week.getTime() > now + DAY_MS || week.getTime() < now - 21 * DAY_MS) throw new HttpError(400, "Bad week");
    if (Buffer.byteLength(JSON.stringify(w.data)) > MAX_BYTES) throw new HttpError(413, "Week is too large");
    const key = { userId: req.user.id, week };
    /* a week that was already emailed stays as it was sent */
    const row = await prisma.weeklyReport.findUnique({ where: { userId_week: key } });
    if (row && row.sentAt) continue;
    await prisma.weeklyReport.upsert({ where: { userId_week: key }, create: { ...key, data: w.data }, update: { data: w.data } });
  }
  res.json({ ok: true });
});

/* Vercel Cron, Mondays (vercel.json): email last week to everyone who
   asked for it. Vercel sends Authorization: Bearer $CRON_SECRET. */
statsRouter.get("/cron/weekly-email", async (req, res) => {
  if (!env.cronSecret || req.headers.authorization !== `Bearer ${env.cronSecret}`) throw new HttpError(401, "Not allowed");
  const week = new Date(mondayOf(new Date()).getTime() - 7 * DAY_MS);
  const rows = await prisma.weeklyReport.findMany({
    where: { week, sentAt: null, user: { weeklyEmail: true } },
    include: { user: true },
    take: 500,
  });
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (!isPro(row.user)) continue;
    try {
      await sendEmail({ to: row.user.email, ...weeklyEmail(row.user, week, row.data) });
      await prisma.weeklyReport.update({ where: { userId_week: { userId: row.userId, week } }, data: { sentAt: new Date() } });
      sent++;
    } catch (err) {
      failed++;
      console.error("[weekly-email]", row.userId, err.message);
    }
  }
  res.json({ week: week.toISOString().slice(0, 10), sent, failed });
});
