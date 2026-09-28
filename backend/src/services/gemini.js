/* The Gemini call, moved from the old server/lib/gemini.js. */
import { env, requireEnv } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const MAX_MESSAGES = 20; // older turns are dropped, keeps requests small
const MAX_CHARS = 4000; // per message

const SYSTEM =
  "You are Atlas, a compact assistant inside a browser new-tab page. " +
  "Answer briefly and clearly — a few sentences or a short list. " +
  "Use plain text; avoid long markdown, headings and tables.";

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

export async function askGemini(contents) {
  const key = requireEnv(env.geminiKey, "GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;
  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    if (err.name === "TimeoutError") throw new HttpError(504, "Gemini took too long to answer.");
    throw err;
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data.error && data.error.message) || `Gemini returned ${r.status}`;
    throw new HttpError(r.status === 429 ? 429 : 502, msg);
  }
  const cand = (data.candidates || [])[0];
  const text =
    cand &&
    cand.content &&
    (cand.content.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();
  if (!text) {
    const why = (cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || "empty";
    throw new HttpError(502, `Gemini gave no answer (${why}).`);
  }
  return text;
}
