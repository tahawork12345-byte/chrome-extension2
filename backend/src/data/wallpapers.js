/* The premium wallpaper library (Atlas Pro).

   To add a wallpaper: upload the video (4K H.264/HEVC .mp4, 10-30 s,
   seamless loop, ideally under 40 MB) and a thumbnail (~480x270 .jpg) to
   your CDN under WALLPAPER_CDN, add one entry here, and deploy. New entries
   show up in every extension within a day (it re-reads the list daily,
   and when Customize > Background opens). `added` puts the newest first
   and marks the last 30 days as "New".

   tags pick wallpapers for "Change by itself" in the extension:
     time of day: morning, day, evening, night
     weather:     clear, cloudy, rain, snow, fog, storm
   A wallpaper with no tags of a kind fits any time / any weather.

   file / thumb are paths under WALLPAPER_CDN (or full https:// URLs). */
export const WALLPAPERS = [
  { id: "alpine-dawn", label: "Alpine Dawn", category: "Mountains", tags: ["morning", "clear"], file: "alpine-dawn.mp4", thumb: "alpine-dawn.jpg", added: "2026-09-01" },
  { id: "misty-pines", label: "Misty Pines", category: "Forest", tags: ["morning", "fog", "cloudy"], file: "misty-pines.mp4", thumb: "misty-pines.jpg", added: "2026-09-01" },
  { id: "tide-pools", label: "Tide Pools", category: "Ocean", tags: ["day", "clear"], file: "tide-pools.mp4", thumb: "tide-pools.jpg", added: "2026-09-01" },
  { id: "desert-noon", label: "Desert Noon", category: "Desert", tags: ["day", "clear"], file: "desert-noon.mp4", thumb: "desert-noon.jpg", added: "2026-09-01" },
  { id: "rain-window", label: "Rain on Glass", category: "Cozy", tags: ["rain", "storm", "evening", "night"], file: "rain-window.mp4", thumb: "rain-window.jpg", added: "2026-09-08" },
  { id: "golden-hour", label: "Golden Hour Fields", category: "Countryside", tags: ["evening", "clear"], file: "golden-hour.mp4", thumb: "golden-hour.jpg", added: "2026-09-08" },
  { id: "city-dusk", label: "City at Dusk", category: "City", tags: ["evening", "cloudy"], file: "city-dusk.mp4", thumb: "city-dusk.jpg", added: "2026-09-15" },
  { id: "snowfall-cabin", label: "Snowfall Cabin", category: "Winter", tags: ["snow", "night", "evening"], file: "snowfall-cabin.mp4", thumb: "snowfall-cabin.jpg", added: "2026-09-15" },
  { id: "aurora", label: "Aurora", category: "Night sky", tags: ["night", "clear"], file: "aurora.mp4", thumb: "aurora.jpg", added: "2026-09-22" },
  { id: "neon-rain", label: "Neon Rain", category: "City", tags: ["night", "rain"], file: "neon-rain.mp4", thumb: "neon-rain.jpg", added: "2026-09-22" },
];
