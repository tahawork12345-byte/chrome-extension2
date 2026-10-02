import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { isPro, verifyAccessToken } from "../services/tokens.js";

export const wallpapersRouter = Router();

/* The online wallpaper sources, each switched on in .env:
   - PIXABAY=true: live videos. This route only runs the search, so the API
     key stays here; the answer links straight to Pixabay's own files.
   - WALLHAVEN=true: still images. The extension calls WALLHAVEN_URL itself
     (no key needed), so its rate limit counts per user, not per server.
   Nothing is copied, cached or served from this server. */
const PIXABAY = "https://pixabay.com/api/videos/";
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

/* the sharpest landscape size up to 4K (Pixabay gives large, medium,
   small and tiny; a missing size has an empty url) */
function bestFile(videos) {
  const files = Object.values(videos || {}).filter(
    (f) => f && /^https:\/\//.test(f.url || "") && f.width >= f.height,
  );
  const fit = files.filter((f) => f.width <= MAX_WIDTH);
  return (fit.length ? fit : files).sort((a, b) => b.width - a.width)[0] || null;
}

/* GET /wallpapers/sources -> { pixabay: bool, wallhaven: url | null }:
   what the extension may show */
wallpapersRouter.get("/wallpapers/sources", (req, res) => {
  const wallhaven = env.wallhaven.on && /^https:\/\//.test(env.wallhaven.url) ? env.wallhaven.url : null;
  res.set("Cache-Control", "public, max-age=300");
  res.json({ pixabay: env.pixabay.on && Boolean(env.pixabay.key), wallhaven });
});

/* GET /wallpapers/live?q=&page= -> { items: [{ id, thumb, video, width,
   height, duration, credit, creditUrl, link }], page, more, pro }. No q =
   Pixabay's popular videos. Anyone sees the list and the thumbnails; the
   video link is only in the answer for Pro. */
wallpapersRouter.get("/wallpapers/live", async (req, res) => {
  if (!env.pixabay.on) throw new HttpError(404, "Live wallpapers are turned off (PIXABAY).", { code: "off" });
  if (!env.pixabay.key) throw new HttpError(503, "Live wallpapers aren't set up on the server (PIXABAY_API_KEY).", { code: "not_configured" });
  const q = String(req.query.q || "").trim().slice(0, 80);
  const page = Math.min(20, Math.max(1, parseInt(req.query.page, 10) || 1)); // Pixabay stops at 500 results

  const params = new URLSearchParams({
    key: env.pixabay.key,
    per_page: String(PER_PAGE),
    page: String(page),
    min_width: String(MAX_WIDTH), // 4K only: Pixabay's "large" file is then 3840x2160
    safesearch: "true",
    order: "popular",
  });
  if (q) params.set("q", q);
  const [pro, r] = await Promise.all([proFor(req), fetch(`${PIXABAY}?${params}`)]);
  if (r.status === 429) throw new HttpError(429, "Too many live wallpaper searches right now. Try again in a little while.");
  if (!r.ok) throw new HttpError(502, `Pixabay answered ${r.status}`);
  const data = await r.json();

  const items = (data.hits || [])
    .map((v) => {
      const file = bestFile(v.videos);
      const thumb = file && ["small", "medium", "large"].map((k) => v.videos[k] && v.videos[k].thumbnail).find((t) => /^https:\/\//.test(t || ""));
      if (!file || !thumb) return null;
      return {
        id: String(v.id),
        thumb,
        video: pro ? file.url : null,
        width: file.width,
        height: file.height,
        duration: v.duration || 0,
        credit: v.user || "",
        creditUrl: v.user && v.user_id ? `https://pixabay.com/users/${encodeURIComponent(v.user)}-${v.user_id}/` : "",
        link: v.pageURL || "",
      };
    })
    .filter(Boolean);
  res.set("Cache-Control", "private, max-age=600");
  res.json({ items, page, more: page * PER_PAGE < Math.min(500, Number(data.totalHits) || 0), pro });
});
