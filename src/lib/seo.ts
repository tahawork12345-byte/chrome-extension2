/* Per-page SEO tags: canonical URL, Open Graph and Twitter card.
   Every URL is absolute on SITE_URL, as search engines and link
   previews expect. */
import { SITE_URL } from "./site";

export const SITE_NAME = "Atlas";
export const DEFAULT_IMAGE = SITE_URL + "/media/shot-2.jpg";

export function seo({ path, title, description }: { path: string; title: string; description: string }) {
  const url = SITE_URL + path;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: DEFAULT_IMAGE },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "800" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: DEFAULT_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
