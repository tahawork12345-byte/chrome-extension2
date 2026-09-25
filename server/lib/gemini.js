/* Shared by the local server (chat.js) and the Vercel function (api/chat.js):
   origin check, request shaping and the Gemini call. */

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const MAX_MESSAGES = 20;    // older turns are dropped, keeps requests small
const MAX_CHARS = 4000;     // per message

const SYSTEM =
  "You are Atlas, a compact assistant inside a browser new-tab page. " +
  "Answer briefly and clearly — a few sentences or a short list. " +
  "Use plain text; avoid long markdown, headings and tables.";

/* optional ALLOWED_EXTENSION_IDS="id1,id2" locks the server to your own
   extension(s); left empty, any chrome extension may call it */
const EXTENSION_IDS = (process.env.ALLOWED_EXTENSION_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

/* only the extension (and local pages, for testing) may call this */
export function allowedOrigin(origin) {
  if (!origin) return "";
  const ext = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  if (ext) return !EXTENSION_IDS.length || EXTENSION_IDS.includes(ext[1]) ? origin : "";
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "";
}

export function corsHeaders(origin) {
  return origin ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  } : {};
}

/* the extension's chat history -> Gemini's "contents". Gemini calls the
   assistant "model", and the conversation must start with a user turn. */
export function toContents(messages) {
  const list = (Array.isArray(messages) ? messages : [])
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
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    const err = new Error("The server has no GEMINI_API_KEY set.");
    err.status = 500;
    throw err;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
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

/* one chat request, independent of the HTTP layer: body in, [status, json] out */
export async function handleChat(body) {
  const contents = toContents(body && body.messages);
  if (!contents.length) return [400, { error: "No message to answer." }];
  try {
    return [200, { reply: await askGemini(contents) }];
  } catch (err) {
    console.error("[chat]", err.message);
    const timeout = err.name === "TimeoutError";
    return [timeout ? 504 : err.status || 500,
      { error: timeout ? "Gemini took too long to answer." : err.message }];
  }
}
