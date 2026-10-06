/* Paddle Billing: API calls and webhook signature check. */
import crypto from "node:crypto";
import { env, requireEnv } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const API = env.paddle.env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

async function paddle(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv(env.paddle.apiKey, "PADDLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[paddle]", r.status, JSON.stringify(data.error || data));
    throw new HttpError(502, (data.error && data.error.detail) || `Paddle returned ${r.status}`);
  }
  return data.data;
}

/* A draft transaction; its checkout.url opens our checkout page (the
   "default payment link" set in Paddle), where Paddle.js shows the form.
   custom_data.userId travels to the subscription and back in webhooks. */
export async function createCheckout({ priceId, user }) {
  const body = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: { userId: user.id },
    checkout: { url: env.siteUrl ? `${env.siteUrl}/checkout` : `${env.appUrl}/checkout.html` },
  };
  if (user.paddleCustomerId) body.customer_id = user.paddleCustomerId;
  const tx = await paddle("POST", "/transactions", body);
  if (!tx.checkout || !tx.checkout.url) throw new HttpError(502, "Paddle returned no checkout URL");
  return { url: tx.checkout.url, transactionId: tx.id };
}

export const getTransaction = (id) => paddle("GET", `/transactions/${encodeURIComponent(id)}`);
export const getSubscription = (id) => paddle("GET", `/subscriptions/${encodeURIComponent(id)}`);
export const listSubscriptions = (customerId) =>
  paddle("GET", `/subscriptions?customer_id=${encodeURIComponent(customerId)}&per_page=50`);

/* the price list shown on the extension's upgrade box; prices rarely
   change, so one answer is kept for an hour per server instance */
let pricesCache = null;
export async function getPlanPrices(ids) {
  if (pricesCache && Date.now() - pricesCache.at < 3_600_000) return pricesCache.value;
  const value = {};
  await Promise.all(Object.entries(ids).filter(([, id]) => id).map(async ([key, id]) => {
    const p = await paddle("GET", `/prices/${encodeURIComponent(id)}`);
    value[key] = {
      amount: Number(p.unit_price.amount) / 100,
      currency: p.unit_price.currency_code,
      interval: p.billing_cycle ? p.billing_cycle.interval : null,
    };
  }));
  pricesCache = { at: Date.now(), value };
  return value;
}

/* hosted page where the customer can cancel, change plan or update card */
export async function createPortalSession(customerId, subscriptionIds = []) {
  const s = await paddle("POST", `/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    subscription_ids: subscriptionIds,
  });
  return s.urls.general.overview;
}

/* Paddle-Signature: "ts=1671552777;h1=abc..." — HMAC-SHA256 of "ts:rawBody" */
export function verifyWebhook(rawBody, header) {
  const secret = requireEnv(env.paddle.webhookSecret, "PADDLE_WEBHOOK_SECRET");
  const parts = String(header || "").split(";");
  const ts = (parts.find((p) => p.startsWith("ts=")) || "").slice(3);
  const h1s = parts.filter((p) => p.startsWith("h1=")).map((p) => p.slice(3));
  if (!ts || !h1s.length) return false;
  /* reject events older than 5 minutes (replay protection) */
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return h1s.some((h1) => {
    const a = Buffer.from(h1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
