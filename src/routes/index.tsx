import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimeLovers } from "@/components/site/anime";
import { Developers } from "@/components/site/developers";
import { Footer, InstallButton, Nav, Reveal, useTheme } from "@/components/site/layout";
import {
  AppIcon,
  Card,
  CardCopy,
  CalendarMock,
  ChatMock,
  CommandMock,
  CursorMock,
  FocusMock,
  GoalsMock,
  HabitMock,
  I,
  Icon,
  LightMock,
  NewTabMock,
  PlannerMock,
  PlayingMock,
  QuoteMock,
  RemindMock,
  SearchMock,
  StatsMock,
  SyncMock,
  TabsMock,
  TranslateMock,
  BlockMock,
  VaultMock,
  VoiceMock,
  ZenMock,
  hm,
  useCycle,
  useNow,
  useTyped,
} from "@/components/site/showcase";
import { seo } from "@/lib/seo";
import { CONTACT_EMAIL, FALLBACK_PRICES, SITE_URL, THEMES, fetchPlans, money } from "@/lib/site";

/* search engines read these first: the title and description carry the
   phrases people search for (wallpaper extension, new tab, productivity) */
const TITLE = "Atlas — Free Live Wallpaper & Productivity New Tab for Chrome";
const DESCRIPTION =
  "Atlas is a free Chrome new tab extension with live 4K & HD wallpapers, a custom productivity dashboard, focus timer, shortcuts and a minimal mode.";
const KEYWORDS = [
  "new tab extension",
  "chrome new tab extension",
  "best new tab extension",
  "wallpaper chrome extension",
  "chrome wallpaper extension",
  "new tab wallpaper",
  "live wallpaper new tab",
  "4K wallpaper new tab",
  "HD wallpaper new tab",
  "chrome new tab background",
  "custom new tab",
  "customizable new tab",
  "productivity new tab extension",
  "new tab dashboard chrome",
  "minimal new tab extension",
  "focus new tab extension",
  "free new tab wallpaper extension",
  "wallpaper browser extension",
].join(", ");

/* tells Google what Atlas is, so results can show it as an app */
const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Atlas",
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Atlas New Tab",
    url: SITE_URL,
    image: SITE_URL + "/media/shot-2.jpg",
    description: DESCRIPTION,
    keywords: KEYWORDS,
    applicationCategory: "BrowserApplication",
    operatingSystem: "Chrome",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro monthly", price: String(FALLBACK_PRICES.monthly.amount), priceCurrency: FALLBACK_PRICES.monthly.currency },
      { "@type": "Offer", name: "Pro yearly", price: String(FALLBACK_PRICES.yearly.amount), priceCurrency: FALLBACK_PRICES.yearly.currency },
    ],
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    ...(({ meta, links }) => ({ meta: [...meta, { name: "keywords", content: KEYWORDS }], links }))(
      seo({ path: "/", title: TITLE, description: DESCRIPTION }),
    ),
    scripts: [{ type: "application/ld+json", children: JSON.stringify([...STRUCTURED_DATA, FAQ_DATA]) }],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="site">
      <Nav />
      <Hero />
      <WallStrip />
      <Shortcuts />
      <Numbers />
      <Look />
      <AnimeLovers />
      <GetAround />
      <GetDone />
      <Control />
      <Themes />
      <Pricing />
      <Developers />
      <Faq />
      <Closing />
      <Footer />
    </div>
  );
}

/* a muted looping video that only plays while on screen */
function Loop({ src, poster, className = "" }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata" />;
}

/* ---------- hero ---------- */
function Hero() {
  const words = ["finally", "actually", "really"];
  const w = useCycle(words.length, 2600);
  return (
    <section className="hero">
      <Loop src="/media/hero.mp4" poster="/media/hero.jpg" className="hero-video" />
      <div className="hero-shade" />
      <div className="hero-glow" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="badge rise" style={{ animationDelay: "60ms" }}>
            <span className="badge-dot" />
            New · AI day planner, habits and focus stats
          </p>
          <h1 className="display rise" style={{ animationDelay: "120ms" }}>
            Your new tab,
            <br />
            <span className="swap">
              <em key={w}>{words[w]}</em>
            </span>{" "}
            worth
            <br />
            opening.
          </h1>
          <p className="lede rise" style={{ animationDelay: "200ms" }}>
            A free new tab extension for Chrome: live 4K wallpapers, your sites in glass cards, a command center, focus
            timer, reminders, habits, a site blocker, translation and a quiet assistant. One new tab, twenty small tools.
          </p>
          <div className="hero-ctas rise" style={{ animationDelay: "280ms" }}>
            <InstallButton />
            <a href="#look" className="btn btn-ghost">
              See everything inside
              <Icon d="M12 5v14M5 12l7 7 7-7" />
            </a>
          </div>
          <ul className="hero-facts rise" style={{ animationDelay: "360ms" }}>
            <li>Chrome, Edge &amp; Brave</li>
            <li>No ads, no tracking</li>
            <li>7 days of Pro free</li>
          </ul>
        </div>
        <figure className="hero-shot rise" style={{ animationDelay: "240ms" }}>
          <NewTabMock wall="meadow" />
        </figure>
      </div>
    </section>
  );
}

/* ---------- a moving strip of the live wallpapers ---------- */
const WALLS = [
  ["halo", "Halo"],
  ["meadow", "Knight's rest"],
  ["monolith", "Monolith"],
  ["storm", "Storm rail"],
  ["anime", "Glance"],
  ["blade", "Quiet blade"],
  ["roses", "Roses"],
  ["spark", "Clash"],
  ["crown", "Crown"],
  ["wire", "Wire"],
  ["cloak", "Cloak"],
];

function WallTile({ id, name }: { id: string; name: string }) {
  const [hover, setHover] = useState(false);
  return (
    <figure className="wall" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <img src={`/media/wp/${id}.jpg`} alt={`${name} — live 4K wallpaper for the Chrome new tab`} loading="lazy" />
      {hover && <video src={`/media/wp/${id}.mp4`} muted loop playsInline autoPlay />}
      <figcaption>
        <span className="live-dot" />
        {name}
        <i>4K · Live</i>
      </figcaption>
    </figure>
  );
}

function WallStrip() {
  return (
    <section className="walls" aria-label="Some of the live wallpapers">
      <div className="walls-track">
        {[...WALLS, ...WALLS].map(([id, name], k) => (
          <WallTile key={k} id={id} name={name} />
        ))}
      </div>
    </section>
  );
}

/* ---------- keyboard strip ---------- */
function Shortcuts() {
  const keys = [
    { k: ["Ctrl", "Space"], t: "Command Center: every setting and tool, by name" },
    { k: ["Z"], t: "Zen clock: just the time over your wallpaper" },
    { k: ["M"], t: "Minimal: hide everything but search" },
    { k: ["!yt", "!gh", "!w"], t: "Search YouTube, GitHub or Wikipedia from the bar" },
  ];
  return (
    <section className="keys" aria-label="Keyboard shortcuts">
      <div className="wrap keys-row">
        {keys.map((x, i) => (
          <Reveal className="key-item" key={x.t} delay={i * 80}>
            <span className="kbds">
              {x.k.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span>{x.t}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- numbers ---------- */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1200);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [el, to]);
  return (
    <span ref={setEl}>
      {n}
      {suffix}
    </span>
  );
}

function Numbers() {
  return (
    <section className="nums">
      <div className="wrap nums-row">
        {[
          [20, "+", "built-in tools"],
          [8, "", "theme presets"],
          [10, "", "search engines, plus your own"],
          [0, "", "ads or trackers"],
        ].map(([n, s, l], i) => (
          <Reveal className="num" key={l as string} delay={i * 80}>
            <b>
              <CountUp to={n as number} suffix={s as string} />
            </b>
            <small>{l}</small>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- chapter heading ---------- */
function Chapter({ id, n, kicker, title, em, children }: { id: string; n: string; kicker: string; title: string; em: string; children?: React.ReactNode }) {
  return (
    <Reveal className="section-head chapter">
      <span className="chap-n">{n}</span>
      <div>
        <p className="eyebrow" id={id}>
          {kicker}
        </p>
        <h2 className="h2">
          {title} <em>{em}</em>
        </h2>
        {children && <p className="lede">{children}</p>}
      </div>
    </Reveal>
  );
}

/* the online library card: the wallpaper changes by itself */
function LibraryCard() {
  const picks = ["halo", "storm", "meadow", "anime"];
  const i = useCycle(picks.length, 4200);
  const chips = ["All", "4K", "Live", "Anime", "Nature", "Favourites"];
  return (
    <Card className="c-wall span-4 tall">
      <div className="lib-media">
        {picks.map((p, k) => (
          <Loop key={p} src={`/media/wp/${p}.mp4`} poster={`/media/wp/${p}.jpg`} className={"lib-v" + (k === i ? " on" : "")} />
        ))}
      </div>
      <div className="lib-chips">
        {chips.map((c, k) => (
          <span key={c} className={k === i % 3 ? "on" : ""}>
            {c}
          </span>
        ))}
      </div>
      <div className="card-copy on-media">
        <span className="tag">Wallpapers</span>
        <h3>Live 4K wallpapers that change with your day</h3>
        <p>
          A built-in set, an online library of stills and slow video, or your own image or .mp4. Schedule one for
          mornings and another for evenings; tune brightness, blur, dim, drift and speed.
        </p>
      </div>
      <div className="lib-dots">
        {picks.map((p, k) => (
          <i key={p} className={k === i ? "on" : ""} />
        ))}
      </div>
    </Card>
  );
}

/* ---------- 01 look ---------- */
function Look() {
  return (
    <section className="section" id="look">
      <div className="wrap">
        <Chapter id="features" n="01" kicker="Make it yours" title="A page you'll want" em="to look at.">
          Every pixel is a setting, and every setting saves itself.
        </Chapter>
        <div className="bento">
          <LibraryCard />
          <Card className="span-2" delay={80}>
            <CardCopy tag="Lighting" title="A light that runs around the edges">
              Border light, orbs, 3D tilt and five panel transitions.
            </CardCopy>
            <LightMock />
          </Card>
          <Card className="span-2">
            <ZenMock />
            <CardCopy tag="Zen & Minimal" title="Press Z for quiet, M for less">
              A full-screen clock with world times, or only the clock and search.
            </CardCopy>
          </Card>
          <Card className="span-2" delay={80}>
            <CardCopy tag="Daily quote" title="Something good above the search bar">
              Motivation, Focus, Wisdom, Calm, or your own.
            </CardCopy>
            <QuoteMock />
          </Card>
          <Card className="span-2" delay={160}>
            <CardCopy tag="Cursors" title="Cursor packs that follow you">
              Pick a pointer and it works on every site, not just the new tab.
            </CardCopy>
            <CursorMock />
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ---------- 02 get around ---------- */
function ShortcutsCard() {
  const ws = useCycle(2, 3600);
  const sets = [
    [["youtube", "YouTube"], ["gmail", "Gmail"], ["spotify", "Spotify"], ["discord", "Discord"], ["reddit", "Reddit"], ["x", "X"], ["photos", "Photos"], ["maps", "Maps"]],
    [["github", "GitHub"], ["linear", "Linear"], ["figma", "Figma"], ["notion", "Notion"], ["slack", "Slack"], ["vercel", "Vercel"], ["docs", "Docs"], ["sheets", "Sheets"]],
  ];
  return (
    <Card className="span-3 tall">
      <CardCopy tag="Shortcuts & workspaces" title="Your sites, in glass cards">
        Group them into sections, drag to reorder, right-click to edit. Keep Personal and Work apart, each with its own
        shortcuts.
      </CardCopy>
      <div className="sc">
        <div className="sc-rail">
          <span className={ws === 0 ? "on" : ""}>
            <Icon d={I.home} size={14} />
          </span>
          <span className={ws === 1 ? "on" : ""}>
            <Icon d={I.work} size={14} />
          </span>
          <span>
            <Icon d={I.lock} size={14} />
          </span>
        </div>
        <div className="sc-card glass" key={ws}>
          <div className="nt-tabs">
            <span className="on">{ws ? "Work" : "Personal"}</span>
            <span>{ws ? "Design" : "Watch"}</span>
            <span>{ws ? "Docs" : "Social"}</span>
          </div>
          <div className="nt-grid">
            {sets[ws].map(([n, l], i) => (
              <AppIcon key={n} n={n} label={l} style={{ animationDelay: i * 50 + "ms" }} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function GetAround() {
  return (
    <section className="section tint" id="around">
      <div className="wrap">
        <Chapter id="around-h" n="02" kicker="Get around" title="Everything is" em="one keystroke away." />
        <div className="bento">
          <ShortcutsCard />
          <Card className="span-3 tall" delay={80}>
            <CardCopy tag="Command Center" title="Ctrl + Space, then just type">
              Every tool and setting by name: start a focus session, switch wallpaper, add a reminder, plan your day.
            </CardCopy>
            <CommandMock />
          </Card>
          <Card className="span-2">
            <CardCopy tag="Search" title="Ten engines and bangs">
              Pick the engine from the bar, or send one search elsewhere with !yt, !gh or !w.
            </CardCopy>
            <SearchMock />
          </Card>
          <Card className="span-2" delay={80}>
            <CardCopy tag="Now playing" title="Pause the music without hunting for the tab">
              Spotify, YouTube, SoundCloud and more, with artwork and a seek bar.
            </CardCopy>
            <PlayingMock />
          </Card>
          <Card className="span-2" delay={160}>
            <CardCopy tag="Translate" title="Read any site in your language">
              Pages translate as they load. One click shows the original.
            </CardCopy>
            <TranslateMock />
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ---------- 03 get things done ---------- */
function GetDone() {
  return (
    <section className="section" id="done">
      <div className="wrap">
        <Chapter id="done-h" n="03" kicker="Get things done" title="A quiet desk," em="not another app." />
        <div className="bento">
          <Card className="span-2 tall">
            <CardCopy tag="Focus timer" title="25 on, 5 off, distractions blocked">
              While you focus, the blocker's list is shut and the wallpaper dims. It ends on time even with no tab open.
            </CardCopy>
            <FocusMock />
          </Card>
          <Card className="span-2 tall" delay={80}>
            <CardCopy tag="Reminders" title="Alarms that ring anywhere in Chrome">
              Once, daily, weekdays, monthly or yearly, with Snooze and your own sound.
            </CardCopy>
            <RemindMock />
          </Card>
          <Card className="span-2 tall" delay={160}>
            <CardCopy tag="Assistant" title="Ask without leaving the tab">
              Type or talk. It knows your calendar and can read answers aloud.
            </CardCopy>
            <ChatMock />
          </Card>
          <Card className="span-3">
            <CardCopy tag="Habits" title="Streaks you can see">
              Tick today, pick the days it's due, and fill in a day you forgot on the heatmap.
            </CardCopy>
            <HabitMock />
          </Card>
          <Card className="span-3" delay={80}>
            <CardCopy tag="Notes & Goals" title="Goals with tasks, tasks with reminders">
              Every task can have a date and ring as a reminder. Ctrl+Enter adds a quick note.
            </CardCopy>
            <GoalsMock />
          </Card>
          <Card className="span-2">
            <CardCopy tag="Day planner · Pro" title="Plan my day, in one click">
              Tasks, events, reminders and habits, laid out on a timeline.
            </CardCopy>
            <PlannerMock />
          </Card>
          <Card className="span-2" delay={80}>
            <CardCopy tag="Calendar · Pro" title="Today and the next seven days">
              From Google Calendar, with a Join button for Meet.
            </CardCopy>
            <CalendarMock />
          </Card>
          <Card className="span-2" delay={160}>
            <CardCopy tag="Stats" title="Where the time actually went">
              Focus, tasks, habits and your top sites. Pro adds 30 days and a weekly email.
            </CardCopy>
            <StatsMock />
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ---------- 04 control ---------- */
function Control() {
  return (
    <section className="section tint" id="control">
      <div className="wrap">
        <Chapter id="control-h" n="04" kicker="Stay in control" title="Calmer browsing," em="on your terms." />
        <div className="bento">
          <Card className="span-3">
            <CardCopy tag="Site blocker" title="Block the rabbit holes">
              Single sites or one-click groups, always or only at set times, with your own message.
            </CardCopy>
            <BlockMock />
          </Card>
          <Card className="span-3" delay={80}>
            <CardCopy tag="Optimize & tab manager" title="Fewer tabs, less memory">
              Close duplicates, put idle tabs to sleep, save a window as a session and open it later.
            </CardCopy>
            <TabsMock />
          </Card>
          <Card className="span-2">
            <CardCopy tag="Private space · Pro" title="A locked folder for private links">
              Password-protected shortcuts and notes, encrypted on your computer.
            </CardCopy>
            <VaultMock />
          </Card>
          <Card className="span-2" delay={80}>
            <CardCopy tag="Voice" title="Talk to search, talk to the assistant">
              Voice typing in the bar and a talk mode that listens, answers and listens again.
            </CardCopy>
            <VoiceMock />
          </Card>
          <Card className="span-2" delay={160}>
            <CardCopy tag="Sync · Pro" title="The same Atlas on every computer">
              Settings, shortcuts, notes, habits, reminders and the private space.
            </CardCopy>
            <SyncMock />
          </Card>
        </div>
        <Reveal className="extras">
          {[
            ["Extensions manager", "Turn your other extensions on and off"],
            ["Weather", "Your city, in °C or °F"],
            ["Quick Peek", "Glance at your tabs from the corner"],
            ["Backup", "Export and import as a file"],
            ["Own search engines", "Add any site with a %s link"],
            ["Widgets", "Move and resize everything"],
          ].map(([t, s]) => (
            <span key={t}>
              <Icon d={I.check} size={14} />
              <b>{t}</b>
              <small>{s}</small>
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- themes: the whole page recolours ---------- */
function Themes() {
  const [theme, pick] = useTheme();
  const now = useNow(15_000);
  return (
    <section id="themes" className="section themes">
      <div className="wrap themes-grid">
        <Reveal className="themes-copy">
          <p className="eyebrow">Eight presets, endless tweaks</p>
          <h2 className="h2">
            Pick a mood.
            <br />
            <em>Go on, click one.</em>
          </h2>
          <p className="lede">
            These are the same presets you'll find in Atlas. Choosing one recolours this whole page, which is roughly
            what it feels like in the extension.
          </p>
          <div className="swatches" role="radiogroup" aria-label="Theme preset">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme.id === t.id}
                className={"swatch" + (theme.id === t.id ? " is-on" : "")}
                onClick={() => pick(t)}
                style={{ "--sa": t.accent, "--sg": t.glass } as CSSProperties}
              >
                <span className="sw-img" style={{ backgroundImage: `url(/media/wp/${t.wall}.jpg)` }}>
                  <span className="sw-glass">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <span className="sw-label">
                  <span className="sw-dot" />
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal className="mini" delay={100}>
          <Loop key={theme.wall} src={`/media/wp/${theme.wall}.mp4`} poster={`/media/wp/${theme.wall}.jpg`} className="mini-bg" />
          <div className="mini-shade" />
          <div className="mini-top">
            <div className="mini-clock">
              {hm(now)}
              <small>{now ? now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) : " "}</small>
            </div>
            <span className="mini-chip">Quick peek</span>
          </div>
          <div className="mini-card glass">
            <div className="nt-tabs">
              <span className="on">All</span>
              <span>Apps</span>
              <span>Work</span>
            </div>
            <div className="nt-grid">
              {[
                ["gmail", "Mail"],
                ["docs", "Docs"],
                ["spotify", "Music"],
                ["maps", "Maps"],
                ["github", "Code"],
                ["hackernews", "News"],
                ["slack", "Chat"],
                ["calendar", "Cal"],
              ].map(([n, l], i) => (
                <AppIcon key={n + theme.id} n={n} label={l} style={{ animationDelay: i * 40 + "ms" }} />
              ))}
            </div>
          </div>
          <div className="mini-search glass">
            <Icon d={I.search} size={14} />
            Search Google…
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- pricing ---------- */
const FREE = [
  "Live and still wallpapers (5 from the online library)",
  "Shortcut cards and workspaces",
  "Command Center, search bangs, voice typing",
  "Focus timer, reminders, site blocker",
  "Notes & goals, 3 habits, 3 tab sessions",
  "Translate, now playing, weather, daily quote",
  "Assistant, 20 messages a day",
];
const PRO = [
  "Every theme preset and cursor pack",
  "Unlimited 4K and live wallpapers",
  "Private space",
  "Automatic sync and backup",
  "AI day planner and Google Calendar",
  "30-day stats and a weekly email",
  "30 habits and 50 saved tab sessions",
  "Assistant, 500 messages a day",
];

function Pricing() {
  const [yearly, setYearly] = useState(true);
  const [prices, setPrices] = useState(FALLBACK_PRICES);
  useEffect(() => {
    fetchPlans().then(setPrices);
  }, []);
  const save = Math.round((1 - prices.yearly.amount / (prices.monthly.amount * 12)) * 100);
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <Reveal className="section-head center">
          <p className="eyebrow">Pricing</p>
          <h2 className="h2">
            Free for good. <em>Pro if you want the lot.</em>
          </h2>
          <div className="toggle" role="radiogroup" aria-label="Billing period">
            <button type="button" role="radio" aria-checked={!yearly} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" role="radio" aria-checked={yearly} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>
              Yearly {save > 0 && <span className="save">−{save}%</span>}
            </button>
          </div>
        </Reveal>

        <div className="plans">
          <Card className="plan">
            <h3>Free</h3>
            <p className="plan-price">
              <b>$0</b>
              <span>forever</span>
            </p>
            <p className="plan-note">Everything you need for a better new tab.</p>
            <InstallButton className="btn-block btn-quiet">Get Atlas</InstallButton>
            <ul className="ticks">
              {FREE.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
          <Card className="plan plan-pro" delay={80}>
            <div className="plan-head">
              <h3>Pro</h3>
              <span className="pill">7 days free</span>
            </div>
            <p className="plan-price">
              <b key={String(yearly)}>{money(yearly ? prices.yearly : prices.monthly)}</b>
              <span>{yearly ? "per year" : "per month"}</span>
            </p>
            <p className="plan-note">
              {yearly ? `That's ${money(prices.yearly, { perMonth: true })} a month, billed once a year.` : "Billed monthly. Cancel whenever you like."}
            </p>
            <InstallButton className="btn-block">Start your free trial</InstallButton>
            <ul className="ticks">
              <li className="ticks-lead">Everything in Free, plus</li>
              {PRO.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
        </div>
        <p className="fine center">
          The trial starts when you sign in inside Atlas. No card needed for the trial; upgrade from Customize › Account.
        </p>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const FAQ = [
  ["What is Atlas New Tab?", "Atlas is a free new tab extension for Chrome. It replaces the blank new tab page with live 4K and HD wallpapers, a customizable dashboard of your favourite sites, and productivity tools: a focus timer, reminders, habits, notes and goals, and a site blocker. It also works in Edge, Brave and other Chromium browsers."],
  ["How do I change the Chrome new tab background?", "Install Atlas and open a new tab. In Customize › Background, pick one of the built-in live wallpapers, browse the online library of 4K stills and live videos, or upload your own image or .mp4."],
  ["Can I make the new tab minimal?", "Yes. Press Z for the Zen clock, just the time over your wallpaper, or M for minimal mode, which hides everything but the search bar."],
  ["Is Atlas really free?", "Yes. The free version has no time limit and no ads. Pro adds extra themes, unlimited wallpapers, sync, the private space and a few power tools, and it pays for the servers."],
  ["What does Atlas know about my browsing?", "Your shortcuts, settings and screen-time stats stay in your browser. Stats only note which site is in front and for how long (the domain, never the page), and they're only uploaded if you turn on the weekly email. The privacy policy lists everything that leaves your computer."],
  ["Do reminders and the focus timer work with no new tab open?", "Yes. They run in the extension's background worker, so a reminder rings and a focus session ends on time wherever you are in Chrome. A reminder missed while Chrome was closed rings when it opens again (up to 12 hours late)."],
  ["Which browsers does it work in?", "Any Chromium browser that installs Chrome Web Store extensions: Chrome, Edge, Brave, Arc, Opera and Vivaldi."],
  ["Is the private space really private?", "Its contents are encrypted on your computer with your password (PBKDF2 and AES-GCM). With sync on, only the encrypted copy is uploaded. That also means the password can't be recovered, so keep it somewhere safe."],
  ["How do I cancel Pro?", "Open Customize › Account › Manage subscription. You keep Pro until the end of the period you've paid for, and your settings stay as they are."],
  ["Do I need an account?", "Only for Pro, sync and backup. Everything else works signed out. Signing in uses your Google account; there's no password to remember."],
  ["Can I use my own wallpaper?", "Yes. Upload any image or .mp4 from Customize › Background. It stays on your computer."],
];

/* the same questions for search engines */
const FAQ_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

function Faq() {
  return (
    <section id="faq" className="section">
      <div className="wrap faq-grid">
        <Reveal>
          <p className="eyebrow">Questions</p>
          <h2 className="h2">
            Good to <em>know.</em>
          </h2>
          <p className="lede">
            Something else? <a href={"mailto:" + CONTACT_EMAIL}>Write to us</a> and a real person answers.
          </p>
        </Reveal>
        <div className="faq">
          {FAQ.map(([q, a], i) => (
            <Reveal key={q} delay={i * 40}>
              <details>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* apps that circle the closing card; each one opens the real site */
const ORBIT = ["youtube", "spotify", "drive", "gmail", "github", "notion", "figma", "calendar"];

function Closing() {
  const now = useNow(1000);
  const [q] = useTyped(["lofi beats to focus", "weather this weekend", "plan my afternoon", "!gh tanstack start"]);
  return (
    <section className="closing">
      {/* a slow aurora over a fading grid, in place of a video */}
      <div className="closing-bg" aria-hidden="true">
        <i />
        <i />
        <i />
        <span className="closing-grid" />
      </div>
      <div className="wrap closing-inner">
        <Reveal className="closing-copy">
          <img src="/media/icon.png" alt="" className="closing-logo" width={84} height={84} />
          <h2 className="display small">
            Open a new tab.
            <br />
            <em>Stay a second longer.</em>
          </h2>
          <InstallButton />
        </Reveal>

        <Reveal className="cu" delay={120}>
          <div className="cu-ring" aria-hidden="true" />
          <div className="cu-orbit">
            {ORBIT.map((n, k) => (
              <span key={n} className="cu-slot" style={{ "--k": k, "--n": ORBIT.length } as CSSProperties}>
                <AppIcon n={n} />
              </span>
            ))}
          </div>
          <div className="cu-card glass">
            <div className="cu-clock">
              {hm(now)}
              <small>{now ? now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }) : " "}</small>
            </div>
            <div className="cu-search">
              <Icon d={I.search} size={14} />
              <span>
                {q}
                <i className="caret" />
              </span>
            </div>
            <div className="cu-row">
              <span className="f-ico">
                <Icon d={I.spark} size={14} />
              </span>
              <span className="cu-line">
                <b>Deep work</b>
                <span className="cu-bar">
                  <i />
                </span>
              </span>
            </div>
            <div className="cu-toast">
              <Icon d={I.bell} size={13} /> Stand up and stretch
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
