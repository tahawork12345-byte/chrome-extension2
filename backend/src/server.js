/* Local dev entry: npm run dev  (reads .env). On Vercel, api/index.js is used instead. */
import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`Atlas backend on http://localhost:${env.port}`);
});
