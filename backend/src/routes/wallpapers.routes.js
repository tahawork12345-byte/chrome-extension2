import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { isPro, verifyAccessToken } from "../services/tokens.js";

export const wallpapersRouter = Router();

/* The online wallpaper sources, each switched on in .env:
   - PIXABAY=true: live videos. This route only runs the search, so the API
     key stays here; the answer links straight to Pixabay's own files.
   - WALLPAPERWAVES=true: live videos from wallpaperwaves.com (its public
     WordPress API, 4K posts only), searched here alongside Pixabay; the
     answer links straight to their download.
   - WALLHAVEN=true: still images. The extension calls WALLHAVEN_URL itself
     (no key needed), so its rate limit counts per user, not per server.
   Nothing is copied, cached or served from this server. */
const PIXABAY = "https://pixabay.com/api/videos/";
const PER_PAGE = 24;
const WAVES_PER_PAGE = 12;
const MAX_WIDTH = 3840; // 4K; anything bigger is too heavy for a new tab

const pixabayOn = () => env.pixabay.on && Boolean(env.pixabay.key);
const wavesOn = () => env.wallpaperwaves.on && /^https:\/\//.test(env.wallpaperwaves.url);

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

/* a light copy that starts playing in a moment: the smallest landscape
   size of at least 1280 wide below the full one (the extension streams it
   while the 4K file downloads behind it) */
function previewFile(videos, full) {
  return Object.values(videos || {})
    .filter((f) => f && /^https:\/\//.test(f.url || "") && f.width >= f.height && f.width >= 1280 && f.width < full.width)
    .sort((a, b) => a.width - b.width)[0] || null;
}

async function pixabayPage(q, page) {
  const params = new URLSearchParams({
    key: env.pixabay.key,
    per_page: String(PER_PAGE),
    page: String(page),
    min_width: String(MAX_WIDTH), // 4K only: Pixabay's "large" file is then 3840x2160
    safesearch: "true",
    order: "popular",
  });
  if (q) params.set("q", q);
  const r = await fetch(`${PIXABAY}?${params}`);
  if (r.status === 429) throw new HttpError(429, "Too many live wallpaper searches right now. Try again in a little while.");
  if (!r.ok) throw new HttpError(502, `Pixabay answered ${r.status}`);
  const data = await r.json();

  const items = (data.hits || [])
    .map((v) => {
      const file = bestFile(v.videos);
      const thumb = file && ["small", "medium", "large"].map((k) => v.videos[k] && v.videos[k].thumbnail).find((t) => /^https:\/\//.test(t || ""));
      if (!file || !thumb) return null;
      const light = previewFile(v.videos, file);
      return {
        id: String(v.id),
        source: "pixabay",
        thumb,
        video: file.url,
        preview: light ? light.url : "",
        width: file.width,
        height: file.height,
        duration: v.duration || 0,
        credit: v.user || "",
        creditUrl: v.user && v.user_id ? `https://pixabay.com/users/${encodeURIComponent(v.user)}-${v.user_id}/` : "",
        link: v.pageURL || "",
      };
    })
    .filter(Boolean);
  return { items, more: page * PER_PAGE < Math.min(500, Number(data.totalHits) || 0) };
}

/* WallpaperWaves files its 4K videos under the "3840x2160" category; its id
   is looked up once (a failed look-up isn't kept) */
let wavesCat = null;
async function wavesCategory() {
  if (wavesCat) return wavesCat;
  const r = await fetch(`${env.wallpaperwaves.url}/categories?slug=3840x2160&_fields=id`);
  if (!r.ok) throw new HttpError(502, `WallpaperWaves answered ${r.status}`);
  const [c] = await r.json();
  if (!c || !c.id) throw new HttpError(502, "WallpaperWaves has no 4K category.");
  wavesCat = c.id;
  return wavesCat;
}

/* each post links its full 4K file through download.php */
const WAVES_VIDEO = /https:\/\/wallpaperwaves\.com\/download\.php\?video=[^"'\s<>]+?\.mp4/i;
/* and plays a light 720p clip on its page, usually named after the cover
   image. Found once per post and remembered ("" = none). */
const WAVES_PREVIEW = /https:\/\/wallpaperwaves\.com\/wp-content\/uploads\/[^"'\s<>]+?-preview\.mp4/i;
const wavesPreviews = new Map();
async function wavesPreview(id, html, cover) {
  if (wavesPreviews.has(id)) return wavesPreviews.get(id);
  let url = (WAVES_PREVIEW.exec(html) || [""])[0];
  const guess = (cover || "").replace(/-wallpaperwaves-com\.\w+$/, "-preview.mp4");
  if (!url && guess !== cover) {
    const r = await fetch(guess, { method: "HEAD", signal: AbortSignal.timeout(2500) }).catch(() => null);
    if (r && r.ok) url = guess;
  }
  if (wavesPreviews.size > 2000) wavesPreviews.clear();
  wavesPreviews.set(id, url);
  return url;
}

async function wavesPage(q, page) {
  const params = new URLSearchParams({
    categories: String(await wavesCategory()),
    per_page: String(WAVES_PER_PAGE),
    page: String(page),
    _embed: "wp:featuredmedia",
    _fields: "id,link,content,_links,_embedded",
  });
  if (q) params.set("search", q);
  const r = await fetch(`${env.wallpaperwaves.url}/posts?${params}`);
  if (r.status === 400) return { items: [], more: false }; // past the last page
  if (!r.ok) throw new HttpError(502, `WallpaperWaves answered ${r.status}`);
  const data = await r.json();

  const posts = (Array.isArray(data) ? data : [])
    .map((p) => {
      const html = (p.content && p.content.rendered) || "";
      const m = WAVES_VIDEO.exec(html);
      const media = ((p._embedded && p._embedded["wp:featuredmedia"]) || [])[0] || {};
      const sizes = (media.media_details && media.media_details.sizes) || {};
      const thumb = ["medium_large", "large", "full"]
        .map((k) => sizes[k] && sizes[k].source_url)
        .concat(media.source_url)
        .find((t) => /^https:\/\//.test(t || ""));
      if (!m || !thumb) return null;
      return {
        id: String(p.id),
        source: "wallpaperwaves",
        thumb,
        video: m[0].replace(/&#0?38;|&amp;/g, "&"),
        html,
        cover: media.source_url || "",
        width: 3840,
        height: 2160,
        duration: 0,
        credit: "WallpaperWaves",
        creditUrl: "https://wallpaperwaves.com/",
        link: /^https:\/\//.test(p.link || "") ? p.link : "",
      };
    })
    .filter(Boolean);
  const items = await Promise.all(posts.map(async ({ html, cover, ...item }) => ({
    ...item,
    preview: await wavesPreview(item.id, html, cover),
  })));
  return { items, more: page < (Number(r.headers.get("x-wp-totalpages")) || 0) };
}

/* GET /wallpapers/sources -> { pixabay: bool, wallpaperwaves: bool,
   wallhaven: url | null }: what the extension may show */
wallpapersRouter.get("/wallpapers/sources", (req, res) => {
  const wallhaven = env.wallhaven.on && /^https:\/\//.test(env.wallhaven.url) ? env.wallhaven.url : null;
  res.set("Cache-Control", "public, max-age=300");
  res.json({ pixabay: pixabayOn(), wallpaperwaves: wavesOn(), wallhaven });
});

/* GET /wallpapers/live?q=&page= -> { items: [{ id, source, thumb, video,
   preview (a light clip to start on, or ""), width, height, duration,
   credit, creditUrl, link }], page, more, pro }.
   Pixabay's and WallpaperWaves' results take turns, and one source failing
   still gives the other's. No q = Pixabay's popular videos and
   WallpaperWaves' newest. Everyone gets the video links: free accounts
   may set a few online wallpapers (PRO_CONFIG.freeWallpapers, counted by
   the extension); `pro` says whether the limit applies. */
wallpapersRouter.get("/wallpapers/live", async (req, res) => {
  if (!env.pixabay.on && !env.wallpaperwaves.on) throw new HttpError(404, "Live wallpapers are turned off (PIXABAY / WALLPAPERWAVES).", { code: "off" });
  const runs = [pixabayOn() && pixabayPage, wavesOn() && wavesPage].filter(Boolean);
  if (!runs.length) throw new HttpError(503, "Live wallpapers aren't set up on the server (PIXABAY_API_KEY).", { code: "not_configured" });
  const q = String(req.query.q || "").trim().slice(0, 80);
  const page = Math.min(20, Math.max(1, parseInt(req.query.page, 10) || 1)); // Pixabay stops at 500 results

  const pro = await proFor(req);
  const results = await Promise.allSettled(runs.map((run) => run(q, page)));
  const ok = results.filter((x) => x.status === "fulfilled").map((x) => x.value);
  if (!ok.length) throw results[0].reason;

  const items = [];
  for (let i = 0; i < Math.max(0, ...ok.map((x) => x.items.length)); i++) {
    ok.forEach((x) => { if (x.items[i]) items.push(x.items[i]); });
  }
  res.set("Cache-Control", "private, max-age=600");
  res.json({ items, page, more: ok.some((x) => x.more), pro });
});
