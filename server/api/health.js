/* Vercel: GET /api/health — quick check that the deployment is up */
import { MODEL } from "../lib/gemini.js";

export default function handler(req, res) {
  res.status(200).json({ ok: true, model: MODEL, keySet: Boolean(process.env.GEMINI_API_KEY) });
}
