import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyGoogle } from "../services/google.js";
import { issueSession, publicUser, revokeRefreshToken, rotateRefreshToken } from "../services/tokens.js";
import { getAiUsage } from "../services/usage.js";

export const authRouter = Router();

/* per-instance memory store: good enough to slow down password guessing */
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/* compared against when the email doesn't exist, so timing doesn't reveal it */
let dummyHash;
const getDummyHash = async () => (dummyHash ||= await bcrypt.hash("not-a-real-password", 12));

function readCredentials(body) {
  const email = String((body && body.email) || "").trim().toLowerCase();
  const password = String((body && body.password) || "");
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (Buffer.byteLength(password) > 72) throw new HttpError(400, "Password is too long");
  return { email, password };
}

authRouter.post("/auth/register", limiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const name = String(req.body.name || "").trim().slice(0, 100) || null;

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "An account with this email already exists. Sign in instead.");
  }
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
  });
  res.status(201).json(await issueSession(user));
});

authRouter.post("/auth/login", limiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, (user && user.passwordHash) || (await getDummyHash()));
  if (!user || !user.passwordHash || !ok) {
    throw new HttpError(401, user && !user.passwordHash
      ? "This account uses Google sign-in"
      : "Wrong email or password");
  }
  res.json(await issueSession(user));
});

authRouter.post("/auth/google", limiter, async (req, res) => {
  const profile = await verifyGoogle(req.body || {});

  let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    if (existing) {
      /* Link Google to the email account. Password emails aren't verified,
         so someone could have pre-registered this address: drop the password
         so only the verified Google owner can get in. */
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: profile.googleId,
          passwordHash: null,
          name: existing.name || profile.name,
          avatarUrl: existing.avatarUrl || profile.avatarUrl,
        },
      });
      await prisma.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      user = await prisma.user.create({ data: profile });
    }
  }
  res.json(await issueSession(user));
});

authRouter.post("/auth/refresh", limiter, async (req, res) => {
  res.json(await rotateRefreshToken(req.body && req.body.refreshToken));
});

authRouter.post("/auth/logout", async (req, res) => {
  await revokeRefreshToken(req.body && req.body.refreshToken);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user), usage: { ai: await getAiUsage(req.user) } });
});

/* account deletion (Chrome Web Store / privacy policy). Active Paddle
   subscriptions must be cancelled first so the user isn't billed for nothing. */
authRouter.delete("/me", requireAuth, async (req, res) => {
  const active = await prisma.subscription.count({
    where: { userId: req.user.id, status: { in: ["active", "trialing", "past_due"] } },
  });
  if (active) throw new HttpError(409, "Cancel your subscription before deleting the account", { code: "has_subscription" });
  await prisma.user.delete({ where: { id: req.user.id } });
  res.status(204).end();
});
