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

const here = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Vercel sits in front; needed for rate-limit IPs

app.use(cors);
app.use(webhookRouter); // raw body, must come before express.json()
app.use(express.json({ limit: "200kb" }));

/* on Vercel, public/ is served by the CDN; this covers local dev */
app.use(express.static(path.join(here, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, model: env.geminiModel, geminiKeySet: Boolean(env.geminiKey) });
});

app.use(authRouter);
app.use(aiRouter);
app.use(billingRouter);
app.use(settingsRouter);

app.use(notFound);
app.use(errorHandler);
