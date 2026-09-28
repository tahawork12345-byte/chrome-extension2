import { Router } from "express";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";
import { askGemini, toContents } from "../services/gemini.js";
import { claimAiMessage, getAiUsage, releaseAiMessage } from "../services/usage.js";

export const aiRouter = Router();

/* POST /ai/chat
   body  { messages: [{ role: "user" | "assistant", content }] }
   reply { reply: "...", usage: { used, limit, remaining } } */
aiRouter.post("/ai/chat", requireAuth, async (req, res) => {
  const contents = toContents(req.body && req.body.messages);
  if (!contents.length) throw new HttpError(400, "No message to answer.");

  if (!(await claimAiMessage(req.user))) {
    throw new HttpError(429, "You've used today's assistant messages. Upgrade to Pro for more.", {
      code: "quota_exceeded",
      usage: await getAiUsage(req.user),
    });
  }

  let reply;
  try {
    reply = await askGemini(contents);
  } catch (err) {
    await releaseAiMessage(req.user); // failed answers don't count
    throw err;
  }
  res.json({ reply, usage: await getAiUsage(req.user) });
});

aiRouter.get("/ai/usage", requireAuth, async (req, res) => {
  res.json(await getAiUsage(req.user));
});
