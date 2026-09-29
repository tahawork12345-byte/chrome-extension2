import { env } from "../config/env.js";

/* Only the extension (and localhost pages, for testing) may call the API.
   Requests with no Origin (curl, Paddle webhooks) pass through; auth and
   signature checks protect those routes. */
export function allowedOrigin(origin) {
  if (!origin) return "";
  const ext = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  if (ext) {
    const ids = env.allowedExtensionIds;
    return !ids.length || ids.includes(ext[1]) ? origin : "";
  }
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (origin === env.appUrl) return origin;
  return "";
}

export function cors(req, res, next) {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "600");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.headers.origin && !origin) return res.status(403).json({ error: "Origin not allowed" });
  next();
}
