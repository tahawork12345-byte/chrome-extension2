/* ============================================================
   ATLAS NEW TAB — CONFIGURATION
   Everything you may want to change lives in this one file.
   ============================================================ */

/* ---------- 1. WALLPAPERS -------------------------------------
   Drop your own .mp4 files into  extension/wallpapers/
   Keep the same filenames and nothing else needs to change.
   To add more wallpapers, just append an entry to this list. */
const WALLPAPERS = [
  { id: "w1", label: "Wallpaper 01", file: "wallpapers/wallpaper-1.mp4" },
  { id: "w2", label: "Wallpaper 02", file: "wallpapers/wallpaper-2.mp4" },
  { id: "w3", label: "Wallpaper 03", file: "wallpapers/wallpaper-3.mp4" },
  { id: "w4", label: "Wallpaper 04", file: "wallpapers/wallpaper-4.mp4" },
  { id: "w5", label: "Wallpaper 05", file: "wallpapers/wallpaper-5.mp4" },
  { id: "w6", label: "Wallpaper 06", file: "wallpapers/wallpaper-6.mp4" },
];

/* ---------- 2. ICONS ------------------------------------------
   Every icon file lives in  extension/assets/icons/
   To change an icon, just replace the file with the same name
   (SVG or PNG — if you swap to PNG, change the extension below).
   Nothing else in the code needs to be touched.                 */
const ICON_DIR = "assets/icons/";
const ICONS = {
  youtube: "youtube.svg",
  gmail: "gmail.svg",
  spotify: "spotify.svg",
  drive: "drive.svg",
  maps: "maps.svg",
  photos: "photos.svg",
  github: "github.svg",
  reddit: "reddit.svg",
  discord: "discord.svg",
  notion: "notion.svg",
  x: "x.svg",
  figma: "figma.svg",
  calendar: "calendar.svg",
  translate: "translate.svg",
  weather: "weather.svg",
  wikipedia: "wikipedia.svg",
  medium: "medium.svg",
  hackernews: "hackernews.svg",
  google: "google.svg",
  linear: "linear.svg",
  slack: "slack.svg",
  docs: "docs.svg",
  sheets: "sheets.svg",
  meet: "meet.svg",
  vercel: "vercel.svg",
  mdn: "mdn.svg",
  npm: "npm.svg",
  stackoverflow: "stackoverflow.svg",
  cloud: "cloud.svg",
  keep: "keep.svg",
  inbox: "inbox.svg",
  googlechat: "googlechat.svg",
  animesuge: "animesuge.svg",
  manga: "manga.svg",
  chatgpt: "",
  wallpaper: "wallpaper.svg",
  lovable: "lovable.svg",
};

/* ---------- 3. WORKSPACES + CARD CONTENT ----------------------
   These are the DEFAULTS, used the first time Atlas runs.

   Once a user adds, renames, reorders or deletes a section or shortcut,
   their own layout is saved to chrome.storage.local and used instead —
   editing this list afterwards will not overwrite what they have saved.
   (Clearing the saved layout via "Reset to defaults" brings these back.)

   Each workspace holds a set of compact cards ("sections").
   A shortcut is simply:  { name, url, icon }
   "icon" is a key from the ICONS list above (or a direct path). */
const DEFAULT_WORKSPACES = [
  {
    id: "personal",
    name: "Personal",
    cards: [
      {
        title: "Apps",
        hint: "Everyday",
        items: [
          { name: "YouTube", url: "https://youtube.com", icon: "youtube" },
          { name: "Gmail", url: "https://mail.google.com", icon: "gmail" },
          { name: "Googlechat", url: "https://chat.google.com/app/home", icon: "googlechat" },
          { name: "Spotify", url: "https://open.spotify.com", icon: "spotify" },
          { name: "Wallpaper", url: "https://wallpaperwaves.com/", icon: "wallpaper" },
          { name: "AnimeSuge", url: "https://animesuge.com/", icon: "animesuge" },
          { name: "Manga", url: "https://mangahub.io/search?q=&order=ALPHABET&genre=all", icon: "manga" },
          { name: "Chatgpt", url: "https://chatgpt.com/", icon: "G", },
        ],
      },
      {
        title: "Favorites",
        hint: "Pinned",
        items: [
          { name: "GitHub", url: "https://github.com", icon: "github" },
          { name: "Discord", url: "https://discord.com", icon: "discord" },
          { name: "Reddit", url: "https://reddit.com", icon: "reddit" },
        ],
      },
      {
        title: "Quick Links",
        hint: "Jump to",
        items: [
          { name: "Drive", url: "https://drive.google.com", icon: "drive" },
          { name: "Calendar", url: "https://calendar.google.com", icon: "calendar" },
          { name: "Maps", url: "https://maps.google.com", icon: "maps" },
        ],
      },
      {
        title: "Reading",
        hint: "Later",
        items: [
          { name: "Wikipedia", url: "https://wikipedia.org", icon: "wikipedia" },
          { name: "Medium", url: "https://medium.com", icon: "medium" },
          { name: "Hacker News", url: "https://news.ycombinator.com", icon: "hackernews" },
        ],
      },
    ],
  },
  {
    id: "work",
    name: "Work",
    cards: [
      {
        title: "Workspace",
        hint: "Daily",
        items: [
          { name: "GitHub", url: "https://github.com", icon: "github" },
          { name: "Linear", url: "https://linear.app", icon: "linear" },
          { name: "Slack", url: "https://slack.com", icon: "slack" },
          { name: "lovable", url: "https://lovable.dev/dashboard", icon: "lovable" },
        ],
      },
      {
        title: "Build",
        hint: "Tools",
        items: [
          { name: "Figma", url: "https://figma.com", icon: "figma" },
          { name: "Vercel", url: "https://vercel.com", icon: "vercel" },
          { name: "npm", url: "https://npmjs.com", icon: "npm" },
        ],
      },
      {
        title: "Quick Links",
        hint: "Jump to",
        items: [
          { name: "Inbox", url: "https://mail.google.com", icon: "inbox" },
          { name: "Calendar", url: "https://calendar.google.com", icon: "calendar" },
          { name: "Meet", url: "https://meet.google.com", icon: "meet" },
        ],
      },
      {
        title: "Docs",
        hint: "Reference",
        items: [
          { name: "Docs", url: "https://docs.google.com", icon: "docs" },
          { name: "MDN", url: "https://developer.mozilla.org", icon: "mdn" },
          { name: "Stack Overflow", url: "https://stackoverflow.com", icon: "stackoverflow" },
        ],
      },
    ],
  },
];

/* ---------- 4. SEARCH ------------------------------------------ */
const SEARCH_URL = "https://www.google.com/search?q=";

/* ---------- 5. AI ASSISTANT ------------------------------------
   By default the assistant is NOT configured and will politely say so.
   To connect a provider, host a small endpoint that holds your API key
   server-side (never put a key in this file) and set:

     AI_CONFIG.endpoint = "https://your-endpoint.example.com/chat";

   Your endpoint receives:  POST { messages: [{role, content}, ...] }
   and should reply with JSON: { reply: "..." }                    */
const AI_CONFIG = {
  endpoint: "http://localhost:3000/api/chat",// <-- leave empty to keep the assistant disabled
  greeting: "Hi. Ask me anything once an assistant endpoint is connected.",
  notConfigured:
    "The assistant isn't connected yet. Add your endpoint URL in config.js (AI_CONFIG.endpoint) to enable replies.",
};
