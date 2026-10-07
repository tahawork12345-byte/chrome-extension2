import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { CONTACT_EMAIL, DOWNLOAD_URL, STORE_URL, THEMES, type Theme } from "@/lib/site";

/* ---------- theme: the site wears whichever preset you pick ---------- */
const THEME_KEY = "atlas-site-theme";

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  s.setProperty("--a", t.accent);
  s.setProperty("--a-rgb", hexRgb(t.accent));
  s.setProperty("--ink", t.ink);
  s.setProperty("--ink-rgb", hexRgb(t.ink));
  s.setProperty("--glass-rgb", hexRgb(t.glass));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* private mode */
    }
    const t = THEMES.find((x) => x.id === saved);
    if (t) {
      setTheme(t);
      applyTheme(t);
    }
  }, []);
  const pick = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t.id);
    } catch {
      /* private mode */
    }
  };
  return [theme, pick] as const;
}

/* ---------- pieces ---------- */
export function Mark({ size = 28 }: { size?: number }) {
  /* the store icon's ring, drawn so it takes the theme colour */
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="rgb(var(--ink-rgb) / 0.94)" />
      <circle cx="15.5" cy="17" r="7.6" fill="none" stroke="var(--a)" strokeWidth="2.6" />
      <circle cx="24" cy="8.5" r="2" fill="#1a1712" />
    </svg>
  );
}

export function InstallButton({ className = "", children }: { className?: string; children?: ReactNode }) {
  const label = children ?? (STORE_URL ? "Add to Chrome — it's free" : "Download for Chrome");
  return (
    <a
      href={STORE_URL || DOWNLOAD_URL}
      {...(STORE_URL ? { target: "_blank", rel: "noreferrer" } : { download: "atlas-new-tab.zip" })}
      className={"btn btn-primary " + className}
    >
      <ChromeGlyph />
      {label}
    </a>
  );
}

function ChromeGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 8.4h8.4M8.9 13.8 4.7 6.5M15.1 13.8 10.9 21" strokeLinecap="round" />
    </svg>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={"nav" + (scrolled ? " is-solid" : "")}>
      <div className="wrap nav-row">
        <Link to="/" className="brand" aria-label="Atlas home">
          <Mark />
          <span>Atlas</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <a href="/#features">Features</a>
          <a href="/#themes">Themes</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#faq">FAQ</a>
          <a href="/#team">Team</a>
        </nav>
        <InstallButton className="btn-sm">{STORE_URL ? "Add to Chrome" : "Download"}</InstallButton>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <Mark size={24} />
            <span>Atlas</span>
          </Link>
          <p>A new tab for people who open a lot of them.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Product</h4>
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/refunds">Refunds</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <a href={"mailto:" + CONTACT_EMAIL}>Email us</a>
          </div>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} Atlas New Tab</span>
        <span>Payments by Paddle, our merchant of record.</span>
      </div>
    </footer>
  );
}

/* fades a block in each time it scrolls into view, and back out when it leaves */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  /* which side it left from, so it comes back in from that side */
  const [above, setAbove] = useState(false);
  useEffect(() => {
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setSeen(true);
    /* plays every time it scrolls into view, and runs in reverse when it leaves */
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setSeen(true);
        else {
          setSeen(false);
          setAbove(e.boundingClientRect.top < (e.rootBounds?.top ?? 0));
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return (
    <div ref={setEl} className={"reveal " + (seen ? "is-in " : above ? "from-top " : "") + className} style={{ transitionDelay: seen ? delay + "ms" : "0ms" }}>
      {children}
    </div>
  );
}

/* the simple page shell for legal pages */
export function DocPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="site">
      <Nav />
      <main className="wrap doc">
        <p className="eyebrow">Legal</p>
        <h1 className="doc-title">{title}</h1>
        <p className="doc-date">Last updated {updated}</p>
        <div className="prose">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
