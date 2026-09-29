import express, { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { createCheckout, createPortalSession, verifyWebhook } from "../services/paddle.js";

export const billingRouter = Router();

/* statuses that keep Pro on; past_due keeps it while Paddle retries the card */
const ACTIVE = ["active", "trialing", "past_due"];
/* renewals can land a little after the period ends */
const GRACE_MS = 2 * 86_400_000;

/* public: used by the extension's pricing screen and by checkout.html */
billingRouter.get("/billing/config", (req, res) => {
  res.json({
    environment: env.paddle.env,
    clientToken: env.paddle.clientToken,
    prices: env.paddle.prices,
  });
});

/* body { interval: "month" | "year" }  ->  { url }  (open it in a new tab) */
billingRouter.post("/billing/checkout", requireAuth, async (req, res) => {
  const interval = req.body && req.body.interval;
  const priceId = interval === "year" ? env.paddle.prices.yearly : interval === "month" ? env.paddle.prices.monthly : "";
  if (!priceId) throw new HttpError(400, 'Send { interval: "month" | "year" }');

  const active = await prisma.subscription.count({ where: { userId: req.user.id, status: { in: ACTIVE } } });
  if (active) throw new HttpError(409, "You already have an active subscription. Manage it from the billing portal.", { code: "already_subscribed" });

  res.json(await createCheckout({ priceId, user: req.user }));
});

/* -> { url } of Paddle's customer portal (cancel, switch plan, update card) */
billingRouter.post("/billing/portal", requireAuth, async (req, res) => {
  if (!req.user.paddleCustomerId) throw new HttpError(404, "No billing account yet", { code: "no_customer" });
  const subs = await prisma.subscription.findMany({
    where: { userId: req.user.id, status: { in: ACTIVE } },
    select: { id: true },
  });
  res.json({ url: await createPortalSession(req.user.paddleCustomerId, subs.map((s) => s.id)) });
});

/* Paddle -> us. The only place a user's plan changes.
   Needs the raw body for the signature, so it is mounted before express.json(). */
export const webhookRouter = Router();
webhookRouter.post("/billing/webhook", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!verifyWebhook(raw, req.headers["paddle-signature"])) {
    return res.status(401).json({ error: "Bad signature" });
  }

  const event = JSON.parse(raw);
  if (String(event.event_type || "").startsWith("subscription.")) {
    await syncSubscription(event.data, new Date(event.occurred_at));
  }
  res.json({ ok: true });
});

async function syncSubscription(sub, occurredAt) {
  const userId = sub.custom_data && sub.custom_data.userId;
  const user =
    (userId && (await prisma.user.findUnique({ where: { id: userId } }))) ||
    (sub.customer_id && (await prisma.user.findUnique({ where: { paddleCustomerId: sub.customer_id } })));
  if (!user) {
    console.warn("[paddle] subscription for unknown user", sub.id);
    return; // 200 anyway, retrying won't help
  }

  /* events can arrive out of order: ignore anything older than what we have */
  const existing = await prisma.subscription.findUnique({ where: { id: sub.id } });
  if (existing && existing.lastEventAt > occurredAt) return;

  const item = (sub.items || [])[0] || {};
  const price = item.price || {};
  const fields = {
    userId: user.id,
    status: sub.status,
    priceId: price.id || null,
    interval: (price.billing_cycle && price.billing_cycle.interval) || null,
    currentPeriodEnd: sub.current_billing_period ? new Date(sub.current_billing_period.ends_at) : null,
    cancelAtPeriodEnd: Boolean(sub.scheduled_change && sub.scheduled_change.action === "cancel"),
    lastEventAt: occurredAt,
  };
  await prisma.subscription.upsert({ where: { id: sub.id }, create: { id: sub.id, ...fields }, update: fields });

  /* recompute the plan from all of the user's subscriptions */
  const active = await prisma.subscription.findMany({ where: { userId: user.id, status: { in: ACTIVE } } });
  const ends = active.map((s) => (s.currentPeriodEnd ? s.currentPeriodEnd.getTime() : 0));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      paddleCustomerId: user.paddleCustomerId || sub.customer_id || null,
      plan: active.length ? "PRO" : "FREE",
      planExpiresAt: active.length ? new Date(Math.max(...ends) + GRACE_MS) : null,
    },
  });
}
