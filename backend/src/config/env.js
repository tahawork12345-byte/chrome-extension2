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

  /* where the premium wallpapers live (src/data/wallpapers.js), no trailing slash */
  wallpaperCdn: (process.env.WALLPAPER_CDN || "").replace(/\/+$/, ""),

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
