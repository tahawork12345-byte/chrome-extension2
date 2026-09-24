/* ATLAS NEW TAB — assistant server
   A tiny bridge between the extension's chat panel and Google Gemini.
   The API key stays here, in server/.env, and never ships inside the
   extension.

   Run:   node --env-file=server/.env server/chat.js
   The extension (config.js -> AI_CONFIG.endpoint) talks to:
          POST http://localhost:3001/api/chat
          body  { messages: [{ role: "user" | "assistant", content }] }
          reply { reply: "..." }   or   { error: "..." } with a 4xx / 5xx

   No dependencies: Node 18+ has fetch built in, Node 20.6+ reads --env-file. */

import { createServer } from "node:http";

const KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const PORT = Number(process.env.PORT) || 3001;

const MAX_MESSAGES = 20;    // older turns are dropped, keeps requests small
const MAX_CHARS = 4000;     // per message
const MAX_BODY = 200_000;   // bytes

const SYSTEM =
  "You are Atlas, a compact assistant inside a browser new-tab page. " +
  "Answer briefly and clearly — a few sentences or a short list. " +
  "Use plain text; avoid long markdown, headings and tables.";

if (!KEY) {
  console.error("GEMINI_API_KEY is missing. Put it in server/.env (see server/.env.example).");
  process.exit(1);
}

/* only the extension (and local pages, for testing) may call this */
function allowedOrigin(origin) {
  if (!origin) return "";
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "";
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

/* the extension's chat history -> Gemini's "contents". Gemini calls the
   assistant "model", and the conversation must start with a user turn. */
function toContents(messages) {
  const list = messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, MAX_CHARS) }],
    }));
  while (list.length && list[0].role !== "user") list.shift();
  return list;
}

async function askGemini(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data.error && data.error.message) || `Gemini returned ${r.status}`;
    const err = new Error(msg);
    err.status = r.status === 429 ? 429 : 502;
    throw err;
  }
  const cand = (data.candidates || [])[0];
  const text = cand && cand.content && (cand.content.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) {
    const why = (cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || "empty";
    const err = new Error(`Gemini gave no answer (${why}).`);
    err.status = 502;
    throw err;
  }
  return text;
}

createServer(async (req, res) => {
  const origin = allowedOrigin(req.headers.origin);
  const path = (req.url || "").split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204, origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    } : {});
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
  const contents = toContents(Array.isArray(body && body.messages) ? body.messages : []);
  if (!contents.length) return send(res, 400, { error: "No message to answer." }, origin);

  try {
    const reply = await askGemini(contents);
    send(res, 200, { reply }, origin);
  } catch (err) {
    console.error("[chat]", err.message);
    const timeout = err.name === "TimeoutError";
    send(res, timeout ? 504 : err.status || 500,
      { error: timeout ? "Gemini took too long to answer." : err.message }, origin);
  }
}).listen(PORT, () => {
  console.log(`Atlas assistant on http://localhost:${PORT}/api/chat  (model: ${MODEL})`);
});
