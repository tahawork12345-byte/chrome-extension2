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

## Customize
Everything editable lives in **`config.js`**:
- `WALLPAPERS` — wallpaper list and filenames
- `DEFAULT_WORKSPACES` — workspaces (the icons on the left rail) and their sections
  (the launcher's tabs) + shortcuts (name, url, icon). A workspace can set
  `icon: "home" | "work" | "globe" | "game" | "folder" | "book" | "code" | "music"`.
- `WEATHER_CONFIG` — °C / °F and an optional fixed city for the weather card
- `SEARCH_URL` — search engine
- `AI_CONFIG.endpoint` — your assistant endpoint

## AI assistant
Disabled until you set `AI_CONFIG.endpoint`. Never put an API key in this extension —
point the endpoint at a small server of yours that holds the key. It receives
`POST { messages: [{role, content}] }` and should return `{ "reply": "..." }`.

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
