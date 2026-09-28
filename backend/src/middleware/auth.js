import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { isPro, verifyAccessToken } from "../services/tokens.js";

/* Authorization: Bearer <access token>  ->  req.user */
export async function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) throw new HttpError(401, "Sign in required");

  let payload;
  try {
    payload = verifyAccessToken(m[1]);
  } catch (err) {
    if (err instanceof HttpError) throw err; // misconfiguration, not a bad token
    throw new HttpError(401, err.name === "TokenExpiredError" ? "Token expired" : "Invalid token", {
      code: err.name === "TokenExpiredError" ? "token_expired" : "invalid_token",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new HttpError(401, "Account not found");
  req.user = user;
  next();
}

export function requirePro(req, res, next) {
  if (!isPro(req.user)) throw new HttpError(402, "This feature needs Atlas Pro", { code: "pro_required" });
  next();
}
