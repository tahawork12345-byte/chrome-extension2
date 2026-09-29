import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requirePro } from "../middleware/auth.js";

export const syncRouter = Router();

/* Automatic sync (Atlas Pro). The extension keeps a handful of stored
   values in step across computers: settings, shortcuts, notes & goals,
   habits, reminders, focus history, the (already encrypted) private space.
   Each value travels with the time it last changed; per value, the newest
   wins. The shape of the values is the extension's business.

   PUT /sync  { keys: { name: { value, at } } }  (may be empty = just read)
           -> { keys: { name: { value, at } }, rev }  — everything stored */

const MAX_BYTES = 1_800_000;
const MAX_KEYS = 40;
const KEY_RE = /^[A-Za-z0-9:_-]{1,40}$/;
const SKEW_MS = 60_000; // a clock ahead of ours can't claim the future

syncRouter.put("/sync", requireAuth, requirePro, async (req, res) => {
  const incoming = req.body && req.body.keys;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new HttpError(400, "Send { keys: {...} }");
  const names = Object.keys(incoming);
  if (names.length > MAX_KEYS || names.some((k) => !KEY_RE.test(k))) throw new HttpError(400, "Bad keys");
  const now = Date.now();
  for (const k of names) {
    const v = incoming[k];
    if (!v || typeof v !== "object" || !Number.isFinite(v.at) || v.at <= 0) throw new HttpError(400, `Bad value for ${k}`);
  }

  /* optimistic: re-read and retry if another computer wrote in between */
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.syncDoc.findUnique({ where: { userId: req.user.id } });
    const doc = row && row.data && typeof row.data === "object" ? row.data : {};
    const merged = { ...doc };
    let changed = false;
    for (const k of names) {
      const at = Math.min(incoming[k].at, now + SKEW_MS);
      if (!merged[k] || at > merged[k].at) {
        merged[k] = { value: incoming[k].value === undefined ? null : incoming[k].value, at };
        changed = true;
      }
    }
    if (!changed) return res.json({ keys: doc, rev: row ? row.rev : 0 });
    if (Object.keys(merged).length > MAX_KEYS) throw new HttpError(400, "Too many keys");
    if (Buffer.byteLength(JSON.stringify(merged)) > MAX_BYTES) {
      throw new HttpError(413, "Your synced data is too large. Delete some notes or history and try again.", { code: "too_large" });
    }

    if (row) {
      const { count } = await prisma.syncDoc.updateMany({
        where: { userId: req.user.id, rev: row.rev },
        data: { data: merged, rev: row.rev + 1 },
      });
      if (count === 1) return res.json({ keys: merged, rev: row.rev + 1 });
    } else {
      try {
        await prisma.syncDoc.create({ data: { userId: req.user.id, data: merged, rev: 1 } });
        return res.json({ keys: merged, rev: 1 });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      }
    }
  }
  throw new HttpError(409, "Sync is busy, try again", { code: "sync_busy" });
});

/* forget everything synced (the extension's "Turn off and delete") */
syncRouter.delete("/sync", requireAuth, async (req, res) => {
  await prisma.syncDoc.deleteMany({ where: { userId: req.user.id } });
  res.status(204).end();
});
