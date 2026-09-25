/* ATLAS NEW TAB — assistant server (local)
   A tiny bridge between the extension's chat panel and Google Gemini.
   The API key stays here, in server/.env, and never ships inside the
   extension. The same logic runs on Vercel as api/chat.js.

   Run:   node --env-file=server/.env server/chat.js
   The extension (config.js -> AI_CONFIG.endpoint) talks to:
          POST http://localhost:3001/api/chat
          body  { messages: [{ role: "user" | "assistant", content }] }
          reply { reply: "..." }   or   { error: "..." } with a 4xx / 5xx

   No dependencies: Node 18+ has fetch built in, Node 20.6+ reads --env-file. */

import { createServer } from "node:http";
import { MODEL, allowedOrigin, corsHeaders, handleChat } from "./lib/gemini.js";

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY = 200_000;   // bytes

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing. Put it in server/.env (see server/.env.example).");
  process.exit(1);
}

function send(res, status, data, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const origin = allowedOrigin(req.headers.origin);
  const path = (req.url || "").split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }
  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true, model: MODEL }, origin);
  if (req.method !== "POST" || path !== "/api/chat") return send(res, 404, { error: "Not found" }, origin);
  if (req.headers.origin && !origin) return send(res, 403, { error: "Origin not allowed" }, "");

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { error: "Send JSON: { messages: [...] }" }, origin);
  }
  const [status, data] = await handleChat(body);
  send(res, status, data, origin);
}).listen(PORT, () => {
  console.log(`Atlas assistant on http://localhost:${PORT}/api/chat  (model: ${MODEL})`);
});
