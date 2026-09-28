import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const client = new OAuth2Client();

/* Accepts either
   - idToken:     from chrome.identity.launchWebAuthFlow (response_type=id_token)
   - accessToken: from chrome.identity.getAuthToken
   and returns the verified Google profile. Both are checked against our
   own OAuth client IDs so tokens minted for other apps are rejected. */
export async function verifyGoogle({ idToken, accessToken }) {
  const audiences = env.googleClientIds;
  if (!audiences.length) throw new HttpError(500, "Server misconfigured: GOOGLE_CLIENT_IDS is not set.");

  if (idToken) {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: audiences });
      return toProfile(ticket.getPayload());
    } catch {
      throw new HttpError(401, "Invalid Google token");
    }
  }

  if (accessToken) {
    let info;
    try {
      info = await client.getTokenInfo(accessToken);
    } catch {
      throw new HttpError(401, "Invalid Google token");
    }
    if (!audiences.includes(info.aud)) throw new HttpError(401, "Google token was issued for another app");
    if (!info.email || !info.email_verified) throw new HttpError(401, "Google account has no verified email");

    /* tokeninfo has no name/picture; fetch them (best effort) */
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    const extra = r && r.ok ? await r.json().catch(() => ({})) : {};
    return toProfile({ ...extra, sub: info.sub, email: info.email, email_verified: true });
  }

  throw new HttpError(400, "Send { idToken } or { accessToken }");
}

function toProfile(p) {
  if (!p || !p.sub || !p.email) throw new HttpError(401, "Invalid Google token");
  if (p.email_verified === false) throw new HttpError(401, "Google account has no verified email");
  return {
    googleId: p.sub,
    email: p.email.toLowerCase(),
    name: p.name || null,
    avatarUrl: p.picture || null,
  };
}
