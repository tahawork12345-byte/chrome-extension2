import { HttpError } from "../lib/http-error.js";

/* All configuration in one place. Required values are checked lazily
   (on first use) so a missing Paddle key doesn't stop the AI routes. */

const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const int = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : d);

export const env = {
  port: int(process.env.PORT, 3001),
  appUrl: (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, ""),
  allowedExtensionIds: list(process.env.ALLOWED_EXTENSION_IDS),

  jwtSecret: process.env.JWT_SECRET || "",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenDays: int(process.env.REFRESH_TOKEN_DAYS, 30),
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS),

  /* every Pro feature open to everyone, signed in or not (for now). Set
     ALL_FREE=false to bring the Pro plan back. */
  allFree: process.env.ALL_FREE !== "false",

  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  aiDailyLimit: {
    FREE: int(process.env.AI_DAILY_LIMIT_FREE, 20),
    PRO: int(process.env.AI_DAILY_LIMIT_PRO, 500),
  },

  /* the weekly stats email (Resend) and the cron that sends it */
  email: {
    resendKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "",
  },
  cronSecret: process.env.CRON_SECRET || "",

  /* the online wallpaper sources (routes/wallpapers.routes.js), each on
     or off: Pexels (live videos, searched here with the key) and
     Wallhaven (still images, the extension calls WALLHAVEN_URL itself) */
  pexels: {
    on: process.env.PEXELS === "true",
    key: process.env.PEXELS_API_KEY || "",
  },
  wallhaven: {
    on: process.env.WALLHAVEN === "true",
    url: process.env.WALLHAVEN_URL || "https://wallhaven.cc/api/v1/search",
  },

  paddle: {
    env: process.env.PADDLE_ENV === "production" ? "production" : "sandbox",
    apiKey: process.env.PADDLE_API_KEY || "",
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || "",
    clientToken: process.env.PADDLE_CLIENT_TOKEN || "",
    prices: {
      monthly: process.env.PADDLE_PRICE_MONTHLY || "",
      yearly: process.env.PADDLE_PRICE_YEARLY || "",
    },
  },
};

export function requireEnv(value, name) {
  if (!value) throw new HttpError(500, `Server misconfigured: ${name} is not set.`);
  return value;
}
