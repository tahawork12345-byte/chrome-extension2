/* Anime wallpapers for the home page, from the same two libraries the
   extension uses: live 4K videos (WallpaperWaves) and 4K stills
   (Wallhaven). Neither can be called from the browser (no CORS / needs a
   user agent), so the site asks through its own server. */
import { createServerFn } from "@tanstack/react-start";

export type AnimeMode = "live" | "stills" | "summon";
export type AnimeItem = {
  id: string;
  kind: "live" | "still";
  title: string;
  thumb: string; // small, for the cards
  poster: string; // sharp still shown while the spotlight loads
  media: string; // live: the preview clip; still: the full 4K image
  resolution: string;
  colors: string[];
};
export type AnimeResult = { items: AnimeItem[]; lastPage: number };

const env = (k: string) => {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[k];
};
const WAVES = String(env("WALLPAPERWAVES_URL") || "https://wallpaperwaves.com/wp-json/wp/v2").replace(/\/+$/, "");
const WAVES_4K = "3840x2160"; // the category WallpaperWaves files its 4K videos under
const UA = { "user-agent": "Mozilla/5.0 (compatible; AtlasNewTab-site/1.0)" };
const PER = 12;

/* Wallhaven's purity=100 still lets fan-service through; this keeps the page safe to show anyone */
const EXCLUDE = "-ecchi -cleavage -swimwear -bikini -lingerie -underwear -panties -thighhighs -stockings -nude -topless";

/* the franchises offered as chips; only the ones with results are shown */
export const ANIME_TAGS = [
  "Demon Slayer",
  "Jujutsu Kaisen",
  "One Piece",
  "Naruto",
  "Dragon Ball",
  "Chainsaw Man",
  "Solo Leveling",
  "Attack on Titan",
  "Bleach",
  "Frieren",
  "Genshin Impact",
  "Wuthering Waves",
  "Evangelion",
  "Ghibli",
  "Spy x Family",
  "Blue Lock",
];

/* ---------- small server-side cache ---------- */
const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v as T;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

/* ---------- WallpaperWaves: live 4K ---------- */
const wavesCat = () =>
  cached("waves:cat", 864e5, async () => {
    const r = await fetch(`${WAVES}/categories?slug=${WAVES_4K}&_fields=id`, { headers: UA });
    const [c] = (await r.json()) as { id: number }[];
    if (!c?.id) throw new Error("no 4K category");
    return c.id;
  });

type WpPost = {
  id: number;
  link: string;
  title?: { rendered?: string };
  _embedded?: { "wp:featuredmedia"?: { source_url?: string; media_details?: { sizes?: Record<string, { source_url?: string }> } }[] };
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#\d+;/g, "")
    .replace(/\s*Live Wallpaper\s*$/i, "")
    .trim();

/* each post has a light 720p preview next to its 4K file; it is usually
   named after the cover image, otherwise it's read from the post's page */
async function previewOf(p: WpPost, cover: string) {
  return cached("waves:prev:" + p.id, 864e5, async () => {
    const guess = cover.replace(/-wallpaperwaves-com\.\w+$/, "-preview.mp4");
    if (guess !== cover) {
      const r = await fetch(guess, { method: "HEAD", headers: UA }).catch(() => null);
      if (r?.ok) return guess;
    }
    const html = await fetch(p.link, { headers: UA }).then(
      (r) => (r.ok ? r.text() : ""),
      () => "",
    );
    const m = /src="(https:\/\/wallpaperwaves\.com\/wp-content\/uploads\/[^"]+?-preview\.mp4)"/i.exec(html);
    return m ? m[1] : "";
  });
}

async function wavesSearch(q: string, page: number): Promise<AnimeResult> {
  const p = new URLSearchParams({
    categories: String(await wavesCat()),
    search: q || "anime",
    per_page: String(PER + 4), // a few spare, for posts without a preview clip
    page: String(page),
    _embed: "wp:featuredmedia",
    _fields: "id,link,title,_links,_embedded",
  });
  const r = await fetch(`${WAVES}/posts?${p}`, { headers: UA });
  if (r.status === 400) return { items: [], lastPage: 1 }; // past the last page
  if (!r.ok) throw new Error("waves " + r.status);
  const posts = (await r.json()) as WpPost[];
  const lastPage = Number(r.headers.get("x-wp-totalpages")) || 1;
  const items = await Promise.all(
    posts.map(async (post): Promise<AnimeItem | null> => {
      const m = post._embedded?.["wp:featuredmedia"]?.[0];
      const sizes = m?.media_details?.sizes || {};
      const big = m?.source_url || "";
      const small = sizes.medium_large?.source_url || sizes.large?.source_url || big;
      if (!/^https:\/\//.test(big)) return null;
      const media = await previewOf(post, big);
      if (!media) return null;
      return {
        id: "ww" + post.id,
        kind: "live",
        title: decode(post.title?.rendered || ""),
        thumb: small,
        poster: big,
        media,
        resolution: "3840 × 2160",
        colors: [],
      };
    }),
  );
  return { items: items.filter((x): x is AnimeItem => !!x).slice(0, PER), lastPage };
}

async function wavesTotal(q: string) {
  const p = new URLSearchParams({ categories: String(await wavesCat()), search: q, per_page: "1", _fields: "id" });
  const r = await fetch(`${WAVES}/posts?${p}`, { headers: UA });
  return r.ok ? Number(r.headers.get("x-wp-total")) || 0 : 0;
}

/* ---------- Wallhaven: 4K stills ---------- */
type WhRaw = { id: string; path: string; resolution: string; colors: string[]; thumbs: { large: string; original: string } };

async function whSearch(q: string, page: number, sorting: "toplist" | "random"): Promise<AnimeResult> {
  const p = new URLSearchParams({
    categories: "010", // anime only
    purity: "100", // SFW only
    ratios: "landscape",
    atleast: "3840x2160", // 4K and up
    sorting,
    page: String(page),
    q: (q ? q + " " : "") + EXCLUDE,
  });
  /* a picked series is ranked by all-time favourites; the year's toplist is too thin for it */
  if (sorting === "toplist" && q) p.set("sorting", "favorites");
  else if (sorting === "toplist") p.set("topRange", "1y");
  const r = await fetch("https://wallhaven.cc/api/v1/search?" + p, { headers: UA });
  if (!r.ok) throw new Error("wallhaven " + r.status);
  const j = (await r.json()) as { data: WhRaw[]; meta?: { last_page?: number } };
  return {
    items: (j.data || []).slice(0, PER).map((w) => ({
      id: "wh" + w.id,
      kind: "still" as const,
      title: "",
      thumb: w.thumbs.large,
      poster: w.thumbs.original,
      media: w.path,
      resolution: w.resolution.replace("x", " × "),
      colors: (w.colors || []).slice(0, 5),
    })),
    lastPage: j.meta?.last_page || 1,
  };
}

async function whTotal(q: string) {
  const p = new URLSearchParams({ categories: "010", purity: "100", ratios: "landscape", atleast: "3840x2160", q: q + " " + EXCLUDE });
  const r = await fetch("https://wallhaven.cc/api/v1/search?" + p, { headers: UA });
  if (!r.ok) throw new Error("wallhaven " + r.status);
  const j = (await r.json()) as { meta?: { total?: number } };
  return j.meta?.total || 0;
}

/* ---------- what the page calls ---------- */
export const getAnime = createServerFn({ method: "GET" })
  .inputValidator((d: { mode: AnimeMode; q?: string; page?: number }) => ({
    mode: (["live", "stills", "summon"] as const).includes(d.mode) ? d.mode : ("live" as const),
    q: ANIME_TAGS.includes(String(d.q)) ? String(d.q) : "",
    page: Math.max(1, Math.min(200, Number(d.page) || 1)),
  }))
  .handler(async ({ data }): Promise<AnimeResult> => {
    const { mode, q, page } = data;
    if (mode === "live") return cached(`live:${q}:${page}`, 6e5, () => wavesSearch(q, page));
    if (mode === "stills") return cached(`stills:${q}:${page}`, 6e5, () => whSearch(q, page, "toplist"));

    /* summon: a random page of live videos dealt in with random stills */
    const pages = await cached(`live:pages:${q}`, 36e5, async () => (await wavesSearch(q, 1)).lastPage);
    const pg = 1 + Math.floor(Math.random() * pages);
    const [live, still] = await Promise.allSettled([
      cached(`live:${q}:${pg}`, 6e5, () => wavesSearch(q, pg)),
      whSearch(q, 1, "random"),
    ]);
    const a = live.status === "fulfilled" ? [...live.value.items].sort(() => Math.random() - 0.5) : [];
    const b = still.status === "fulfilled" ? still.value.items : [];
    if (!a.length && !b.length) throw new Error("nothing came back");
    const items: AnimeItem[] = [];
    for (let i = 0; items.length < PER && (i < a.length || i < b.length); i++) {
      if (a[i]) items.push(a[i]);
      if (b[i] && items.length < PER) items.push(b[i]);
    }
    return { items, lastPage: 1 };
  });

/* which franchise chips have anything behind them, per source */
export const getAnimeTags = createServerFn({ method: "GET" }).handler(async (): Promise<{ live: string[]; stills: string[] }> => {
  const check = (src: "live" | "stills") =>
    cached("tags:" + src, 216e5, async () => {
      const out: string[] = [];
      /* a few at a time, to stay well inside Wallhaven's 45 calls a minute */
      for (let i = 0; i < ANIME_TAGS.length; i += 4) {
        const group = ANIME_TAGS.slice(i, i + 4);
        const n = await Promise.all(group.map((t) => (src === "live" ? wavesTotal(t) : whTotal(t)).catch(() => 0)));
        group.forEach((t, k) => n[k] > 0 && out.push(t));
      }
      return out;
    });
  const [live, stills] = await Promise.all([check("live"), check("stills")]);
  return { live, stills };
});
