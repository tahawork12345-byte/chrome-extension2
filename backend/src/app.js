import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { cors } from "./middleware/cors.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./routes/auth.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { billingRouter, webhookRouter } from "./routes/billing.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { statsRouter } from "./routes/stats.routes.js";
import { syncRouter } from "./routes/sync.routes.js";
import { wallpapersRouter } from "./routes/wallpapers.routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Vercel sits in front; needed for rate-limit IPs

app.use(cors);
app.use(webhookRouter); // raw body, must come before express.json()
/* sync carries notes, history and the private space: a bigger body */
app.use("/sync", express.json({ limit: "2mb" }));
app.use(express.json({ limit: "200kb" }));

/* on Vercel, public/ is served by the CDN; this covers local dev */
app.use(express.static(path.join(here, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, model: env.geminiModel, geminiKeySet: Boolean(env.geminiKey) });
});

/* what the extension needs before sign-in: whether everything is free
   (ALL_FREE in .env) and how long the free trial is (TRIAL_DAYS) */
app.get("/config", (req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ allFree: env.allFree, trialDays: env.trialDays });
});

app.use(authRouter);
app.use(aiRouter);
app.use(billingRouter);
app.use(settingsRouter);
app.use(statsRouter);
app.use(syncRouter);
app.use(wallpapersRouter);

app.use(notFound);
app.use(errorHandler);
