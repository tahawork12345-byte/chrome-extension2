import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();

const MAX_BYTES = 100_000;

/* Cloud sync for the extension's settings (wallpaper, shortcuts, cursor...).
   The shape is owned by the extension; the server stores it as-is.
   To make sync a Pro feature, add requirePro after requireAuth. */
settingsRouter.get("/settings", requireAuth, async (req, res) => {
  const row = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
  res.json({ data: row ? row.data : null, updatedAt: row ? row.updatedAt : null });
});

settingsRouter.put("/settings", requireAuth, async (req, res) => {
  const data = req.body && req.body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "Send { data: {...} }");
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) throw new HttpError(413, "Settings are too large");

  const row = await prisma.userSettings.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, data },
    update: { data },
  });
  res.json({ data: row.data, updatedAt: row.updatedAt });
});
