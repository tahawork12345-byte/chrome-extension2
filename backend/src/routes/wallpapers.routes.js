import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { WALLPAPERS } from "../data/wallpapers.js";
import { isPro, verifyAccessToken } from "../services/tokens.js";

export const wallpapersRouter = Router();

const url = (path) => (/^https:\/\//.test(path) ? path : `${env.wallpaperCdn}/${String(path).replace(/^\/+/, "")}`);

/* GET /wallpapers -> { items: [{ id, label, category, tags, thumb, added,
   video }], pro }. Anyone sees the list and the thumbnails; the video link
   is only in the answer for Pro. Signed out (or an expired token) = free. */
wallpapersRouter.get("/wallpapers", async (req, res) => {
  let pro = false;
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (m) {
    try {
      const payload = verifyAccessToken(m[1]);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      pro = Boolean(user && isPro(user));
    } catch {
      /* not signed in, as far as the library cares */
    }
  }
  if (!env.wallpaperCdn) return res.json({ items: [], pro, note: "WALLPAPER_CDN is not set" });

  const items = [...WALLPAPERS]
    .sort((a, b) => String(b.added).localeCompare(String(a.added)))
    .map((w) => ({
      id: w.id,
      label: w.label,
      category: w.category || "",
      tags: Array.isArray(w.tags) ? w.tags : [],
      thumb: url(w.thumb),
      added: w.added || "",
      video: pro ? url(w.file) : null,
    }));
  res.set("Cache-Control", "private, max-age=300");
  res.json({ items, pro });
});
