/* Everything the marketing site needs to know, in one place. */

/* the backend in backend/ (Vercel). Override with VITE_API_URL. */
export const API_URL = String(
  import.meta.env.VITE_API_URL || "https://atlas-assistant-backend.vercel.app",
).replace(/\/+$/, "");

/* the Chrome Web Store page; empty until it's published, then the
   "Add to Chrome" buttons use it instead of the zip download */
export const STORE_URL = String(import.meta.env.VITE_STORE_URL || "");
export const DOWNLOAD_URL = "/atlas-new-tab.zip";
export const CONTACT_EMAIL = "muhammadaqibawan07@gmail.com";

/* shown until /billing/plans answers; keep in step with Paddle */
export type Price = { amount: number; currency: string };
export const FALLBACK_PRICES: { monthly: Price; yearly: Price } = {
  monthly: { amount: 5, currency: "USD" },
  yearly: { amount: 39.99, currency: "USD" },
};

export async function fetchPlans(): Promise<{ monthly: Price; yearly: Price }> {
  try {
    const r = await fetch(API_URL + "/billing/plans");
    if (!r.ok) throw new Error(String(r.status));
    const p = await r.json();
    if (p && p.monthly && p.yearly) return p;
  } catch {
    /* the fallback below */
  }
  return FALLBACK_PRICES;
}

export function money(p: Price, opts?: { perMonth?: boolean }) {
  const amount = opts?.perMonth ? Math.floor((p.amount / 12) * 100) / 100 : p.amount;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: p.currency || "USD",
      minimumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return "$" + amount;
  }
}

/* the same eight presets as Customize > Theme in the extension;
   wall is the clip in public/media/wp/ the preview plays for it */
export const THEMES = [
  { id: "sand", label: "Sand", accent: "#d8c3a5", ink: "#f7f6f3", glass: "#121216", wall: "meadow" },
  { id: "ocean", label: "Ocean", accent: "#7cc4ff", ink: "#eef6ff", glass: "#0b1624", wall: "halo" },
  { id: "rose", label: "Rose", accent: "#f4a6c1", ink: "#fff4f7", glass: "#1a0f14", wall: "roses" },
  { id: "mint", label: "Mint", accent: "#8fe3c0", ink: "#f0fff8", glass: "#0d1a16", wall: "monolith" },
  { id: "violet", label: "Violet", accent: "#b9a3ff", ink: "#f5f2ff", glass: "#120f1f", wall: "anime" },
  { id: "ember", label: "Ember", accent: "#ff9b5e", ink: "#fff5ee", glass: "#1a100a", wall: "crown" },
  { id: "lime", label: "Lime", accent: "#c8f169", ink: "#f8ffe9", glass: "#10140a", wall: "blade" },
  { id: "mono", label: "Mono", accent: "#e6e6e6", ink: "#ffffff", glass: "#0e0e0e", wall: "cloak" },
] as const;
export type Theme = (typeof THEMES)[number];
