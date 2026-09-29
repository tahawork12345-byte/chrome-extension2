import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { isPro } from "./tokens.js";

/* days are counted in UTC */
const today = () => new Date(new Date().toISOString().slice(0, 10));

export function dailyLimit(user) {
  return env.aiDailyLimit[isPro(user) ? "PRO" : "FREE"];
}

export async function getAiUsage(user) {
  const row = await prisma.usage.findUnique({
    where: { userId_day: { userId: user.id, day: today() } },
  });
  const used = row ? row.aiMessages : 0;
  const limit = dailyLimit(user);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/* Atomically claims one message. Returns false when the limit is reached.
   The conditional update prevents two parallel requests from both passing. */
export async function claimAiMessage(user) {
  const limit = dailyLimit(user);
  const key = { userId: user.id, day: today() };
  await prisma.usage.upsert({ where: { userId_day: key }, create: key, update: {} });
  const { count } = await prisma.usage.updateMany({
    where: { ...key, aiMessages: { lt: limit } },
    data: { aiMessages: { increment: 1 } },
  });
  return count === 1;
}

/* gives the message back when the AI call failed */
export async function releaseAiMessage(user) {
  await prisma.usage.updateMany({
    where: { userId: user.id, day: today(), aiMessages: { gt: 0 } },
    data: { aiMessages: { decrement: 1 } },
  });
}
