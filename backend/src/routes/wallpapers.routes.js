import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { isPro, verifyAccessToken } from "../services/tokens.js";

export const wallpapersRouter = Router();

/* The online wallpaper sources, each switched on in .env:
   - PEXELS=true: live videos. This route only runs the search, so the API
     key stays here; the answer links straight to Pexels' own files.
   - WALLHAVEN=true: still images. The extension calls WALLHAVEN_URL itself
     (no key needed), so its rate limit counts per user, not per server.
   Nothing is copied, cached or served from this server. */
const PEXELS = "https://api.pexels.com/videos";
const PER_PAGE = 24;
const MAX_WIDTH = 3840; // 4K; anything bigger is too heavy for a new tab

/* signed out (or an expired token) = free */
async function proFor(req) {
  if (env.allFree) return true; // everything free: the videos for everyone, signed in or not
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  try {
    const payload = verifyAccessToken(m[1]);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return Boolean(user && isPro(user));
  } catch {
    return false;
  }
}

/* the sharpest mp4 up to 4K, landscape */
function bestFile(files) {
  const mp4 = (Array.isArray(files) ? files : []).filter(
    (f) => f && f.file_type === "video/mp4" && /^https:\/\//.test(f.link || "") && f.width >= f.height,
  );
  const fit = mp4.filter((f) => f.width <= MAX_WIDTH);
  return (fit.length ? fit : mp4).sort((a, b) => b.width - a.width)[0] || null;
}

/* GET /wallpapers/sources -> { pexels: bool, wallhaven: url | null }:
   what the extension may show */
wallpapersRouter.get("/wallpapers/sources", (req, res) => {
  const wallhaven = env.wallhaven.on && /^https:\/\//.test(env.wallhaven.url) ? env.wallhaven.url : null;
  res.set("Cache-Control", "public, max-age=300");
  res.json({ pexels: env.pexels.on && Boolean(env.pexels.key), wallhaven });
});

/* GET /wallpapers/live?q=&page= -> { items: [{ id, thumb, video, width,
   height, duration, credit, creditUrl, link }], page, more, pro }. No q =
   Pexels' popular videos. Anyone sees the list and the thumbnails; the
   video link is only in the answer for Pro. */
wallpapersRouter.get("/wallpapers/live", async (req, res) => {
  if (!env.pexels.on) throw new HttpError(404, "Live wallpapers are turned off (PEXELS).", { code: "off" });
  if (!env.pexels.key) throw new HttpError(503, "Live wallpapers aren't set up on the server (PEXELS_API_KEY).", { code: "not_configured" });
  const q = String(req.query.q || "").trim().slice(0, 80);
  const page = Math.min(100, Math.max(1, parseInt(req.query.page, 10) || 1));

  const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page), min_width: "1920" });
  if (q) {
    params.set("query", q);
    params.set("orientation", "landscape");
    params.set("size", "large"); // 4K
  }
  const [pro, r] = await Promise.all([
    proFor(req),
    fetch(`${PEXELS}/${q ? "search" : "popular"}?${params}`, { headers: { Authorization: env.pexels.key } }),
  ]);
  if (r.status === 429) throw new HttpError(429, "Too many live wallpaper searches right now. Try again in a little while.");
  if (!r.ok) throw new HttpError(502, `Pexels answered ${r.status}`);
  const data = await r.json();

  const items = (data.videos || [])
    .map((v) => {
      const file = bestFile(v.video_files);
      if (!file || !/^https:\/\//.test(v.image || "")) return null;
      return {
        id: String(v.id),
        thumb: v.image,
        video: pro ? file.link : null,
        width: file.width,
        height: file.height,
        duration: v.duration || 0,
        credit: (v.user && v.user.name) || "",
        creditUrl: (v.user && v.user.url) || "",
        link: v.url || "",
      };
    })
    .filter(Boolean);
  res.set("Cache-Control", "private, max-age=600");
  res.json({ items, page, more: Boolean(data.next_page), pro });
});
