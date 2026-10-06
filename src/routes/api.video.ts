import { createFileRoute } from "@tanstack/react-router";

/* Streams a WallpaperWaves preview clip through this site, for when the
   browser can't load it from wallpaperwaves.com directly. Only their
   preview clips are allowed, so this can't be used as an open proxy.
   Range requests are passed through, so the video can seek and stream. */
const ALLOWED = /^https:\/\/wallpaperwaves\.com\/wp-content\/uploads\/[\w/.-]+-preview\.mp4$/;
const PASS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
];

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("u") || "";
        if (!ALLOWED.test(u)) return new Response("Not allowed", { status: 400 });

        const range = request.headers.get("range");
        const up = await fetch(u, {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; AtlasNewTab-site/1.0)",
            ...(range ? { range } : {}),
          },
        }).catch(() => null);
        if (!up || (!up.ok && up.status !== 206))
          return new Response("Upstream failed", { status: 502 });

        const headers = new Headers({ "cache-control": "public, max-age=86400, s-maxage=86400" });
        for (const h of PASS) {
          const v = up.headers.get(h);
          if (v) headers.set(h, v);
        }
        return new Response(up.body, { status: up.status, headers });
      },
    },
  },
});
