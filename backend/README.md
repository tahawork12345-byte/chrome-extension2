# Atlas Backend

Express (JavaScript) API for the Atlas New Tab extension. It handles:

- **Accounts**: Google sign-in and email/password, with JWT access tokens and refresh tokens that rotate on each use
- **AI assistant**: the Gemini proxy, with a daily message limit per plan
- **Billing**: Paddle subscriptions (monthly and yearly)
- **Settings sync**: stores the extension's settings in the cloud

Stack: Express 5, Prisma 6, Supabase Postgres, deployed on Vercel.

## Folder layout

```
api/index.js            Vercel entry (all requests rewrite here)
src/app.js              Express app: middleware + routes
src/server.js           local dev entry
src/config/env.js       all env vars
src/middleware/         cors, auth (requireAuth / requirePro), errors
src/routes/             auth, ai, billing, settings
src/services/           tokens, google, gemini, paddle, usage
prisma/schema.prisma    database schema (+ migrations/)
public/                 privacy.html, checkout.html (Paddle payment page)
```

## Local setup

```bash
cd backend
cp .env.example .env      # fill it in (see below)
npm install               # also runs `prisma generate`
npm run db:deploy         # creates the tables in Supabase
npm run dev               # http://localhost:3001
```

After changing `schema.prisma`, run `npm run db:migrate -- --name what_changed`. This creates a new migration file; commit it.

## Services to set up

**Supabase.** Go to Project Settings → Database → Connection string.

- `DATABASE_URL` is the pooled connection (port 6543). Add `?pgbouncer=true&connection_limit=1` to the end.
- `DIRECT_URL` is the direct or session connection (port 5432). Prisma migrations use it.

**Google.** In Google Cloud Console, go to APIs & Services → Credentials and create an OAuth client ID.

- For `chrome.identity.getAuthToken`, choose the "Chrome Extension" type and enter your extension ID.
- For `launchWebAuthFlow`, choose the "Web application" type.
- Put the client ID(s) in `GOOGLE_CLIENT_IDS`.

**Paddle.** Start in the sandbox at sandbox-vendors.paddle.com.

1. Create a product "Atlas Pro" with two prices: monthly and yearly. Copy their `pri_...` IDs into the `.env`.
2. Under Developer tools → Authentication, create an API key and a client-side token.
3. Under Checkout → Checkout settings, set the **default payment link** to `https://YOUR-BACKEND/checkout.html` and approve that domain.
4. Under Developer tools → Notifications, add the destination `https://YOUR-BACKEND/billing/webhook` with the events `subscription.*`. Copy the secret key into `PADDLE_WEBHOOK_SECRET`.
5. When you go live, set `PADDLE_ENV=production` and use the live keys and price IDs.

**Resend (the weekly stats email).** Create an API key at resend.com and verify a sending domain.

- Put the key in `RESEND_API_KEY`, and a sender on that domain in `EMAIL_FROM`.
- Set `CRON_SECRET` to a long random string. Vercel Cron sends it to `/cron/weekly-email` every Monday at 08:00 UTC (see `vercel.json`).

**Premium wallpapers.** Put the videos and thumbnails in a public CDN folder (for example Cloudflare R2, Bunny or S3) and set `WALLPAPER_CDN` to that folder's URL.

- The list is `src/data/wallpapers.js`. To add a wallpaper, upload its files, add one entry, and deploy.
- Extensions pick up the new list within a day.

## Deploy to Vercel

1. Create a new Vercel project with **Root Directory = `backend`**.
2. Add every variable from `.env.example` to the project settings, and set `APP_URL` to the Vercel URL.
3. Deploy. `postinstall` runs `prisma generate` during the build.
4. Run migrations from your machine (`npm run db:deploy`). They don't run during the Vercel build.
5. Set `ALLOWED_EXTENSION_IDS` to your published extension ID so other extensions can't call the API.

## API

Send `Authorization: Bearer <accessToken>` on every route marked 🔒.

| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/register` | `{ email, password, name? }` → session |
| POST | `/auth/login` | `{ email, password }` → session |
| POST | `/auth/google` | `{ idToken }` or `{ accessToken }` → session |
| POST | `/auth/refresh` | `{ refreshToken }` → new session (the old refresh token stops working) |
| POST | `/auth/logout` | `{ refreshToken }` → 204 |
| GET 🔒 | `/me` | → `{ user, usage: { ai } }` |
| DELETE 🔒 | `/me` | → 204 (only after the subscription is cancelled) |
| POST 🔒 | `/ai/chat` | `{ messages: [{ role, content }] }` → `{ reply, usage }` |
| GET 🔒 | `/ai/usage` | → `{ used, limit, remaining }` |
| GET 🔒 | `/settings` | → `{ data, updatedAt }` |
| PUT 🔒 | `/settings` | `{ data: {...} }` → `{ data, updatedAt }` |
| PUT 🔒 Pro | `/sync` | `{ keys: { name: { value, at } } }` → `{ keys, rev }`: everything stored. The newest `at` wins for each key. |
| DELETE 🔒 | `/sync` | → 204 (deletes the synced copy) |
| GET 🔒 | `/stats/prefs` | → `{ weeklyEmail }` |
| PUT 🔒 | `/stats/prefs` | `{ weeklyEmail }` → `{ weeklyEmail }`. Turning it on needs Pro. |
| PUT 🔒 Pro | `/stats/week` | `{ weeks: [{ week: "YYYY-MM-DD" (a Monday), data }] }` → `{ ok }` |
| GET | `/cron/weekly-email` | Vercel Cron only (`Bearer $CRON_SECRET`). Emails last week's summary. |
| GET | `/wallpapers` | → `{ items: [{ id, label, category, tags, thumb, added, video }], pro }`. `video` is only filled in for Pro. |
| GET | `/billing/config` | → `{ environment, clientToken, prices }` |
| POST 🔒 | `/billing/checkout` | `{ interval: "month" \| "year" }` → `{ url }` (open it in a new tab) |
| POST 🔒 | `/billing/portal` | → `{ url }` (the page for cancelling or updating the card) |
| POST | `/billing/webhook` | called by Paddle; the signature is checked |
| GET | `/health` | → `{ ok }` |

A session is `{ accessToken, refreshToken, user }`. `user.plan` is `"FREE"` or `"PRO"`.

Errors come back as `{ error, code? }`. The extension should handle these codes:

- `token_expired` (401): call `/auth/refresh` and retry the request
- `quota_exceeded` (429): show the upgrade screen
- `pro_required` (402): the feature needs Pro
- `already_subscribed` (409): open the billing portal instead

## How a user becomes Pro

1. The extension calls `/billing/checkout` and opens the returned URL.
2. The user pays on `checkout.html`.
3. Paddle calls `/billing/webhook`.
4. The webhook updates the user's `plan` and `planExpiresAt`.
5. The extension calls `/me` again to see the new plan.

The webhook is the **only** place the plan changes.

To lock a route to Pro users, add `requirePro` after `requireAuth` (see `src/middleware/auth.js`).

## What Pro includes

| Feature | Free | Pro |
|---|---|---|
| Premium 4K wallpaper library | Thumbnails only | Every wallpaper, plus new ones as they're added |
| Wallpaper changes by time of day or weather | – | ✓ |
| Stats dashboard | Today | 7 and 30 days, plus the Monday email |
| Automatic sync | Manual save and restore only | Everything, automatically (`/sync`) |
| Habits | 3 | 30 |
| Focus timer | ✓ | ✓ |
| Assistant messages a day | `AI_DAILY_LIMIT_FREE` | `AI_DAILY_LIMIT_PRO` |

Change the free limits on the extension side in `PRO_CONFIG` (`extension/config.js`).
