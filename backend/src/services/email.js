import { env, requireEnv } from "../config/env.js";

/* Sends one email through Resend (https://resend.com): RESEND_API_KEY and a
   sender on a domain verified there (EMAIL_FROM). */
export async function sendEmail({ to, subject, html, text }) {
  const key = requireEnv(env.email.resendKey, "RESEND_API_KEY");
  const from = requireEnv(env.email.from, "EMAIL_FROM");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}
