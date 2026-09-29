import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env, requireEnv } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, requireEnv(env.jwtSecret, "JWT_SECRET"), {
    expiresIn: env.accessTokenTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, requireEnv(env.jwtSecret, "JWT_SECRET"));
}

/* refresh tokens are random strings; only their hash is stored */
async function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + env.refreshTokenDays * 86_400_000),
    },
  });
  return token;
}

export async function issueSession(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await createRefreshToken(user.id),
    user: publicUser(user),
  };
}

/* rotate: the old token is revoked, a new pair is issued. Reusing a revoked
   token revokes every session of that user (it was probably stolen). */
export async function rotateRefreshToken(token) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(String(token || "")) },
    include: { user: true },
  });
  if (!row) throw new HttpError(401, "Invalid refresh token");
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Refresh token reused; please sign in again");
  }
  if (row.expiresAt < new Date()) throw new HttpError(401, "Refresh token expired");

  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return issueSession(row.user);
}

export async function revokeRefreshToken(token) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(String(token || "")), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/* a paid, current Pro plan */
function paidPro(user) {
  return user.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt > new Date());
}

/* what Pro features check: while everything is free (env.allFree), everyone */
export function isPro(user) {
  return env.allFree || paidPro(user);
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    plan: paidPro(user) ? "PRO" : "FREE", // the real plan, for billing; features ask isPro()
    planExpiresAt: user.planExpiresAt,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleId),
  };
}
