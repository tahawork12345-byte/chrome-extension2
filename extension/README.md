# Atlas New Tab — Chrome Extension (Manifest V3)

A calm, editorial New Tab page with cinematic live video wallpapers.

## Install (Load unpacked)
1. Unzip the download.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Open a new tab.

## Replace the wallpapers
Drop your own videos into `wallpapers/`, keeping the filenames:

```
wallpapers/wallpaper-1.mp4
wallpapers/wallpaper-2.mp4
wallpapers/wallpaper-3.mp4
```

Nothing else to change. To add a 4th wallpaper, add one line to `WALLPAPERS` in `config.js`.
(The bundled videos are lightweight placeholders — replace them with your own 1080p/4K clips.)

## Customize (in the page)
Open the **Customize** panel from the palette icon on the left rail, the
the Command Center (Ctrl+Space → "Customize"),
or by right-clicking the bare wallpaper. Every change applies live and is saved.
- **Theme** — presets, accent / text / glass colours, glass opacity, blur,
  borders, roundness, font
- **Background** — a live wallpaper, your own image or video, a solid colour or a
  gradient; brightness, saturation, blur, dim, drift, playback speed. A
  **Schedule** switches the live wallpaper by itself: once on a date, daily,
  on chosen weekdays, monthly or yearly, at a time. The latest change whose
  time has come decides; picking a wallpaper by hand holds until the next one
- **Lighting** — the border light (colour, speed, length, brightness), orbs,
  3D tilt, animations, and the panel's own transition (Glide, Unfold,
  Curtain, Zoom or Fade, with a duration and a Preview button)
- **Widgets** — show / hide, position (9 anchors + nudge), and size for the clock,
  search bar, now playing, wallpaper button, Quick Peek and assistant; dock side,
  width and icon size; 24-hour clock, date, °C / °F, search engine
- **Search bar** — pick the engine from the icon on the bar's left (Google,
  YouTube, GitHub, Wikipedia, ChatGPT, Amazon, Bing, DuckDuckGo, Brave, or
  your own custom engines, added under Widgets → Search bar). Send a single
  search elsewhere with a keyword: `!yt cats`, `!gh react`, `!w Tokyo`.
  Past searches are in their own panel (the clock button) — filter, re-run,
  edit, delete or clear them; "Remember searches" turns history off
- **Notes** — everyday notes (the same list as Quick tools → Notes): add,
  edit, copy, delete
- **Privacy** — a password-locked private folder, like a phone's hidden
  folder: the lock on the dock opens a password screen, then the private
  shortcuts as an app grid (by section) and private notes. It's also a
  workspace of its own on the dock (sections, shortcuts, a Notes tab and
  "Save open tabs") while unlocked; right-click the lock to lock it. Its content is encrypted (PBKDF2 + AES-GCM, `vault.js`);
  the password can't be recovered. Options: lock button on the dock, stay
  unlocked until Chrome closes, lock when idle, change password, delete
- **Backup** — export / import settings as JSON, or reset everything

The code is in `customize.js`; uploaded background files are kept in IndexedDB.

## Reminders
The bell on the dock (or Command Center → "New Reminder") opens Reminders:
alarms once, daily, on weekdays, monthly or every year — a birthday, say.
They ring anywhere in Chrome, with or without a new tab open: the background
worker (`background.js`) keeps a `chrome.alarms` alarm per reminder and rings
with a system notification (Snooze / Dismiss) plus a looping alarm sound,
played from an offscreen page (`alarm.html`). Open new tabs also show a card.
A reminder missed while Chrome was closed rings late (up to 12 hours).
Sounds: Chime, Bell, Digital, Soft pulse, or your own audio file (kept in
IndexedDB); each reminder can use the default, another sound, or be silent.
Dates and repeats are computed by `schedule.js`, shared with the wallpaper
schedule.

## Language & voice
Customize → **Language** (or Command Center → "Language & Translation").
- **Translate** — pick a language and every website you open is translated
  into it, plus the new tab itself (`translate.js`, a content script; the
  words go through Google Translate from `background.js`). Content that
  loads later is translated as it arrives. A small badge on each page offers
  **Show original** and **Never here**; pages already in that language are
  left alone. Chrome's *own* menus can't be changed by an extension — the
  "Chrome's own language…" button opens `chrome://settings/languages`.
- **Voice typing** — a mic on the search bar (searches when you stop
  talking) and in the assistant. "Listen for" sets the spoken language.
  Uses Chrome's speech recognition, which sends the audio to Google. If the
  microphone is blocked, "Allow microphone…" opens `mic.html` to ask again.
- **Assistant voice** — the answer language, "Read answers out loud", five
  suggested voices (Atlas, Sage, Spark, Narrator, Soft) and your own custom
  voices (any system voice + speed, pitch, volume). In the chat, the
  waveform button is **talk mode** (speak → answer is read out → it listens
  again), the speaker button has the quick voice settings, and every answer
  has its own play button. Voices come from the computer (`voice.js`), so
  the list differs between Windows, macOS and ChromeOS.

## Quick tools (bottom right)
Two buttons in the corner: **Quick tools** (⊞) and the ✦ chat
(`quicktools.js`). Quick tools opens a grid — Notes & Goals, Optimize,
Site blocker, Daily quote — and each tool opens in
the same panel (← back to the grid, Esc steps back).
- **Notes & Goals** — *Goals*: each goal has a progress bar (green at 100%)
  and its tasks; every task has its own **Complete** button (the task turns
  green; click again to undo) and an optional date, time and day. With
  "Remind me" on, the task becomes a one-time reminder in the Reminders list
  and rings anywhere in Chrome; completing or deleting the task removes it.
  The bubble shows how many tasks are due. *Notes*: quick notes (Ctrl+Enter
  adds one), editable in place. Stored under `qt:tasks`, on this computer.
- **Optimize** — the open tabs (switch, sleep or close each), **Close
  duplicates**, **Sleep tabs** (frees memory; they reload when opened),
  **Undo sleep**, **Undo close** (reopens the last closed batch), and
  **Auto optimize**: sleep tabs unused for 15 min–4 h, and close a tab that
  opens a page already open (switching to the existing one). Pinned, playing
  and active tabs are never touched. `background.js` runs the automatic part.
- **Tab manager** — this window's tabs; name them and **Save** to keep them
  as a session, then **Open** it in a new window or **Add here** later
  (list or grid view). Free accounts keep 3 sessions (`PRO_CONFIG.freeSessions`),
  Pro up to 50. Stored under `qt:sessions` and synced with the account.
- **Extensions** — your other extensions with search, All / Active / Off,
  and a switch for each. Chrome's `management` permission is *optional*: the
  view asks for it the first time, so installing Atlas never needs it.
- **Site blocker**, **Daily quote** — their settings, below.
- Under the grid: **Feedback** (email, `ABOUT_CONFIG.feedbackEmail`), **Rate
  us** and **Share** (the Chrome Web Store page, `ABOUT_CONFIG.storeUrl`), and
  FAQs · Changelog · Privacy Policy · Export Backup, with the version.

Zen clock and minimal mode are the two round buttons at the bottom left,
styled like these two; hovering one shows its name.

## Focus timer
Quick tools → **Focus**, Command Center → "Start Focus", or the timer pill
(`focus.js`). You focus for 25 minutes, then take a 5-minute break, and
every 4th break is 15 minutes. All of these can be changed. While you
focus:
- the Site blocker's list is blocked, even if the blocker is off, and the
  blocked page offers no 5-minute break
- the wallpaper dims
- a pill at the top of the page shows the time left, with pause and stop

When time's up, you hear a sound (any reminder sound, your own, or none)
and get a notification. The next phase can start by itself. The clock runs
in `background.js` (`focus:state`, a `chrome.alarms` alarm), so a session
ends on time with no new tab open. Finished and stopped sessions are kept
in `focus:history`, and the view shows today's sessions, the streak and
the history.

## Habits
Quick tools → Notes & Goals → **Habits**. Each habit has:
- a check for today
- the days it's due
- a streak (due days in a row), the best streak and the total
- a heatmap of the last 15 weeks (click a square to fill in a day you forgot)

They're stored in `qt:habits`. Free accounts track up to
`PRO_CONFIG.freeHabits` (3). Pro tracks up to 30.

## Stats
Quick tools → **Stats**, or Command Center → "Stats" (`stats.js`). It shows:
- time focused and focus sessions
- tasks done and habits ticked off
- time on the web and blocked visits
- focus by day and web time by day, as bar charts
- where your time went (the top sites)
- the most blocked sites

`background.js` counts the seconds on the site in front of you. It only
counts while Chrome is focused and you're at the computer, or while the tab
is playing sound. It keeps 62 days in `stats:days`, on this computer only.
Free accounts see today. Pro sees 7 and 30 days and can turn on a **weekly
summary email** (sent on Mondays). For the email, the page sends this
week's and last week's totals to the backend, at most every 3 hours.

## Automatic sync (Pro)
Customize → Account → **Sync automatically** (`sync.js`). These stay the
same on every computer signed in to the account:
- settings and shortcuts
- notes & goals, habits
- reminders and the alarm sound
- focus history
- the private space, sent as the encrypted blob it already is

`background.js` stamps each value when it changes (`sync:meta`). Open new
tabs send what changed a few seconds later, and check for changes when
they open and every 5 minutes. Only one tab syncs at a time (a Web Lock).
For each value, the newest change wins. When settings, shortcuts or the
private space arrive from another computer, a fresh tab reloads itself and
an older one offers **Reload**. The manual **Save / Restore** buttons are
still there for free accounts.

## Calendar agenda (Pro)
Quick tools → **Calendar** (`calendar.js`) shows today and the next 7 days
from every calendar that is ticked in Google Calendar. Declined events are
left out. An event opens in Google Calendar when you click it, and a Meet
event shows a Join button. Signing in with Google also asks for read-only
calendar access (`calendar.readonly`), so it's one Google screen, and
`account.js` hands the token to `calendar.js` (`adopt`). If the user
unticks the calendar box, or signed in before this existed, the view first
tries to connect silently. If that fails, it shows **Connect Google
Calendar** (`AtlasAccount.googleToken`). Signing out forgets the calendar
on this computer.

The extension fetches events straight from Google, so they never pass
through the Atlas server. They are cached in `cal:events` and fetched again
when the cache is more than 10 minutes old. Google's token lasts an hour and
is renewed without opening a window. If Google wants the user to confirm
again, the view shows **Reconnect**.

## Day planner (Pro)
Quick tools → **Day planner** (`planner.js`, or "Plan my day" in the
Command Center) sends today's inputs to the backend's `/ai/plan`. The inputs
are:
- open tasks from Notes & Goals (overdue, due today, or undated)
- Calendar events
- reminders
- habits still to do today
- the focus-timer lengths and an optional note

Gemini returns a timeline for the chosen window: fixed events, focus blocks
for tasks, breaks, habits, and the tasks that didn't fit. Each plan uses one
assistant message, and the planner needs an Atlas account.

On the timeline:
- The current block is highlighted.
- **Start focus** starts the focus timer, and **Complete** ticks the task
  off in Notes & Goals.
- **Remind me when each block starts** writes a reminder for each block
  still to come. These are tagged `fromPlan`, and the next plan replaces
  them.

The plan is kept in `planner:day` until the day ends.

## Online wallpapers
Customize → Background → **Online library** (`library.js`). Filter by
All, 4K, Live, Anime or Nature, or search.

- **Stills** come from the Wallhaven API (SFW only). The extension calls it
  directly and needs no key.
- **Live videos** come from Pixabay Videos, searched through the backend
  (`GET /wallpapers/live`) so the API key stays on the server. Everyone sees
  the thumbnails, but only Pro gets the video links.

The ☆ on a card saves it to **Favourites** (`wp:favs`, synced with the
account). Favourites get their own chip at the front of the row and come
first in **All**.

Files are shown straight from Wallhaven and Pixabay, never copied or
re-hosted. The pick is saved in `settings.background.online` (mode
`online`).
The bundled wallpapers in `config.js` stay free.

## Daily quote
A quote above the search bar (`quote.js`) from a built-in list (Motivation,
Focus, Wisdom, Calm), your own quotes, or both. It stays the same all day,
or changes on every new tab. Hover it for ↻ (another quote, which then holds
for the day, in every tab), copy, and settings. Quick tools → Daily quote:
show / hide, how often, which quotes, the category, and your own quotes
(add, edit, delete — they're part of your settings, so Backup and account
sync include them). Move or resize it under Customize → Widgets.

## Minimal mode
A quiet page where only the widgets you keep stay on screen (clock and search
bar by default) and the rest fade away (`minimal.js`). Switch it with the
**M** key, the round ▢ Minimal button (bottom left), Command Center → "Minimal Mode", or
the small "Minimal · Exit" button at the top.

Right-click the ▢ button (or Command Center → "Minimal Mode Settings") for
its settings: Off / On / **At set times**. Add as many times as
you need (days + from / to), or use a ready-made one: Work hours, Evenings,
Night, Weekends. Overnight times such as 22:00–07:00 work. Switching by hand
during a set time lasts until that time starts or ends, then the schedule
takes over again. Also: which widgets to keep, an extra background dim, and
whether to show the Exit button.

## Zen clock
The round ◷ Zen clock button (bottom left), the **Z** key or Command Center → "Zen Clock"
opens a full-screen clock (`zen.js`). The sliders button next to ✕ has its
options: show the day / date / year (and seconds), show the page's widgets,
show the wallpaper, a background colour instead, and other places' time —
type a city, a country or a time zone ("Karachi", "Japan", "Europe/Paris").
Esc closes it.

## Site blocker
Quick tools → **Site blocker**: a list of sites (or one-click groups: Social,
Video, News, Shopping) that open a "This site is blocked" page
(`blocked.html`) instead — always, or only on chosen days between two times.
The blocked page can offer a 5-minute break, and shows your own message.
`background.js` turns the list into `declarativeNetRequest` rules and
re-checks the schedule every minute; tabs already open on a blocked site
switch to the blocked page too.

## Account (Google sign-in)
Customize → **Account** signs in with Google through the backend in
`backend/` (`account.js`). Signed in, it shows your profile and plan, and can:
save / restore your Customize settings and shortcuts to the account, open
your Google account settings, switch account, sign out, upgrade or manage
Atlas Pro, and delete the account.

Setup:
1. Google Cloud Console → Credentials → **OAuth client ID → Web application**.
   Under "Authorized redirect URIs" add `https://<extension-id>.chromiumapp.org/`
   (the Account tab shows the exact one while sign-in isn't set up).
2. Put that client ID in `ACCOUNT_CONFIG.googleClientId` (`config.js`) and
   in the backend's `GOOGLE_CLIENT_IDS`.
3. Set `ACCOUNT_CONFIG.api` to the backend URL (your Vercel URL, or
   `http://localhost:3001` with `npm run backend`).

An unpacked extension gets a different ID on each computer, so each one
needs its redirect URI added (or pin the ID with a `key` in manifest.json).

## Customize (defaults in config.js)
The starting content lives in **`config.js`**:
- `WALLPAPERS` — wallpaper list and filenames
- `DEFAULT_WORKSPACES` — workspaces (the icons on the left rail) and their sections
  (the launcher's tabs) + shortcuts (name, url, icon). A workspace can set
  `icon: "home" | "work" | "globe" | "game" | "folder" | "book" | "code" | "music"`.
- `WEATHER_CONFIG` — °C / °F and an optional fixed city for the weather card
- `SEARCH_URL` — search engine
- `AI_CONFIG.endpoint` — your assistant endpoint

## AI assistant
The ✦ chat (bottom right) is answered by Google Gemini through a small server
in `server/`, which keeps the API key out of the extension.

### Hosted on Vercel (works for everyone who installs the extension)
1. On https://vercel.com click **Add New → Project** and import this GitHub repo.
2. Set **Root Directory** to `server`. Framework preset: **Other**. No build command.
3. Under **Environment Variables** add `GEMINI_API_KEY` (free key:
   https://aistudio.google.com/apikey). Optional: `GEMINI_MODEL`.
4. Deploy, then open `https://<your-project>.vercel.app/api/health`. It should
   show `"ok": true, "keySet": true`.
5. Set `AI_CONFIG.endpoint` in `config.js` to `https://<your-project>.vercel.app/api/chat`,
   then reload the extension and share it.

To stop other extensions from using your server, add `ALLOWED_EXTENSION_IDS`
(comma-separated IDs from `chrome://extensions`) in Vercel. An unpacked extension
gets a different ID on each computer, so collect your friends' IDs first.

### Local (for development)
1. Copy `server/.env.example` to `server/.env` and put your key in it.
   `.env` is git-ignored.
2. From the project root run `npm run assistant`. It listens on
   `http://localhost:3001/api/chat`. Point `AI_CONFIG.endpoint` there while testing.

Change the model with `GEMINI_MODEL`. Never put an API key in the
extension itself. Any server works if it takes `POST { messages: [{role, content}] }`
and returns `{ "reply": "..." }`.

## Now playing
The card above the Zen clock / Minimal buttons (bottom left) shows whatever is playing in
another browser tab (Spotify, YouTube Music, YouTube, SoundCloud, Deezer, Apple
Music, or any site that uses the browser's media controls), with artwork,
previous / play-pause / next, and a seekable progress bar. Click the title to
jump to that tab. It hides itself when nothing has played.

- `media-bridge.js` / `media-relay.js` run on web pages and report the track.
- `background.js` picks which tab to show and forwards the button presses.

Tabs that were already open when the extension was installed or reloaded need
one refresh before they are picked up. Desktop apps (the Spotify app, VLC, ...)
are outside the browser and are not shown.

## Permissions
- `storage` — remembers wallpaper, workspace and most-used shortcuts.
- Content scripts on `http(s)://*/*` — needed to read the now-playing info
  from music sites. Chrome shows this as "read and change data on all
  websites"; the scripts only read media metadata and never send anything
  outside the browser.

- `identity` — the Google sign-in popup (Customize → Account).
- `declarativeNetRequestWithHostAccess` — the site blocker; it uses the
  host access the extension already has, so Chrome shows no new warning.
- `idle` — Stats counts time on a site only while you're at the computer.
  Chrome shows no warning for it.
- The translator content script (`languages.js`, `translate.js`) does
  nothing until a language is picked; then it sends page text to Google
  Translate.

Everything works offline except Google search, translation, voice typing
and the optional assistant.
