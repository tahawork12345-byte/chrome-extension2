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
wallpaper menu (◑ → Customize…), the Command Center (Ctrl+Space → "Customize"),
or by right-clicking the bare wallpaper. Every change applies live and is saved.
- **Theme** — presets, accent / text / glass colours, glass opacity, blur,
  borders, roundness, font
- **Background** — a live wallpaper, your own image or video, a solid colour or a
  gradient; brightness, saturation, blur, dim, drift, playback speed
- **Lighting** — the border light (colour, speed, length, brightness), orbs,
  3D tilt, animations
- **Widgets** — show / hide, position (9 anchors + nudge), and size for the clock,
  search bar, now playing, wallpaper button, Quick Peek and assistant; dock side,
  width and icon size; 24-hour clock, date, °C / °F, search engine
- **Backup** — export / import settings as JSON, or reset everything

The code is in `customize.js`; uploaded background files are kept in IndexedDB.

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
The card above the wallpaper toggle (bottom left) shows whatever is playing in
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

Everything works offline except Google search and the optional assistant.
