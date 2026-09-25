/* Vercel serverless function: POST /api/chat
   Same contract as the local server (see ../chat.js). The key comes from the
   GEMINI_API_KEY environment variable set in the Vercel project settings. */

import { allowedOrigin, corsHeaders, handleChat } from "../lib/gemini.js";

export default async function handler(req, res) {
  const origin = allowedOrigin(req.headers.origin);
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.setHeader(k, v);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (req.headers.origin && !origin) return res.status(403).json({ error: "Origin not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Send JSON: { messages: [...] }" });
  }

  const [status, data] = await handleChat(body);
  res.status(status).json(data);
}
