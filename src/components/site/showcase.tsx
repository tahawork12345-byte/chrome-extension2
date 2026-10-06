/* Small live mock-ups of Atlas features, drawn in HTML so they animate,
   pick up the theme colour and never repeat a screenshot. */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Reveal } from "@/components/site/layout";

/* ---------- shared bits ---------- */
export function useNow(every = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

export function useCycle(length: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % length), ms);
    return () => clearInterval(t);
  }, [length, ms]);
  return i;
}

/* types each phrase out, holds it, deletes it, moves on */
export function useTyped(phrases: string[], hold = 1600) {
  const [text, setText] = useState(phrases[0]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let i = idx;
    let n = 0;
    let dir = 1;
    let t: ReturnType<typeof setTimeout>;
    setText("");
    const step = () => {
      if (!alive) return;
      const p = phrases[i];
      n += dir;
      setText(p.slice(0, n));
      if (dir > 0 && n >= p.length) {
        dir = -1;
        t = setTimeout(step, hold);
        return;
      }
      if (dir < 0 && n <= 0) {
        i = (i + 1) % phrases.length;
        setIdx(i);
        dir = 1;
        t = setTimeout(step, 300);
        return;
      }
      t = setTimeout(step, dir > 0 ? 70 + Math.random() * 60 : 28);
    };
    t = setTimeout(step, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [text, idx] as const;
}

export function hm(d: Date | null, opts?: { seconds?: boolean }) {
  if (!d) return "--:--";
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return opts?.seconds ? `${h}:${m}:${String(d.getSeconds()).padStart(2, "0")}` : `${h}:${m}`;
}

export function AppIcon({ n, label, style }: { n: string; label?: string; style?: CSSProperties }) {
  return (
    <span className="app" style={style}>
      <span className="bub">
        <img src={`/media/apps/${n}.svg`} alt="" loading="lazy" />
      </span>
      {label && <small>{label}</small>}
    </span>
  );
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const I = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  work: "M4 8h16v11H4zM9 8V5h6v3",
  sun: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  bell: "M12 21a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zM18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  play: "M8 5l11 7-11 7z",
  pause: "M8 5v14M16 5v14",
  prev: "M18 6l-8 6 8 6zM6 6v12",
  next: "M6 6l8 6-8 6zM18 6v12",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z",
  laptop: "M5 6h14v9H5zM3 18h18",
  phone: "M8 3h8v18H8zM11 18h2",
  monitor: "M3 4h18v12H3zM9 20h6M12 16v4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  zz: "M5 7h6l-6 7h6M14 12h5l-5 6h5",
  quote: "M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6",
  cursor: "M5 3l14 7-6 2-2 6z",
};
export { Icon };

/* a card whose border and glow follow the pointer */
export function Card({ className = "", delay = 0, children }: { className?: string; delay?: number; children: ReactNode }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", e.clientX - r.left + "px");
    e.currentTarget.style.setProperty("--my", e.clientY - r.top + "px");
  };
  return (
    <Reveal className={"card " + className} delay={delay}>
      <div className="card-in" onPointerMove={onMove}>
        {children}
      </div>
    </Reveal>
  );
}

export function CardCopy({ tag, title, children }: { tag: string; title: string; children?: ReactNode }) {
  return (
    <div className="card-copy">
      <span className="tag">{tag}</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

/* ---------- the live new tab used in the hero ---------- */
const LAUNCHER = [
  ["youtube", "YouTube"],
  ["gmail", "Gmail"],
  ["spotify", "Spotify"],
  ["github", "GitHub"],
  ["discord", "Discord"],
  ["notion", "Notion"],
  ["figma", "Figma"],
  ["drive", "Drive"],
  ["calendar", "Calendar"],
  ["reddit", "Reddit"],
  ["maps", "Maps"],
  ["slack", "Slack"],
];

export function NewTabMock({ wall = "meadow" }: { wall?: string }) {
  const now = useNow(1000);
  const [q] = useTyped(["!yt lofi beats to focus", "weather in Tokyo", "!gh tanstack router", "plan my afternoon"]);
  const tab = useCycle(3, 3200);
  const ref = useRef<HTMLDivElement>(null);
  const vref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vref.current;
    if (v && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.play().catch(() => {});
  }, [wall]);

  /* tilt toward the pointer */
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", (-y * 6).toFixed(2) + "deg");
    el.style.setProperty("--ry", (x * 8).toFixed(2) + "deg");
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--rx", "2deg");
    ref.current?.style.setProperty("--ry", "-7deg");
  };

  return (
    <div className="nt-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="nt" ref={ref}>
        <div className="nt-bar">
          <i />
          <i />
          <i />
          <span className="nt-url">
            <img src="/media/icon.png" alt="" /> New Tab
          </span>
        </div>
        <div className="nt-body">
          <video ref={vref} className="nt-bg" src={`/media/wp/${wall}.mp4`} poster={`/media/wp/${wall}.jpg`} muted loop playsInline autoPlay preload="metadata" />
          <div className="nt-top">
            <div className="nt-clock">
              <b>{hm(now)}</b>
              <small>{now ? now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) : " "}</small>
            </div>
            <div className="nt-weather">
              <Icon d={I.cloud} size={15} />
              <span>
                <b>21°</b> Partly cloudy
              </span>
            </div>
            <span className="nt-peek">Quick peek</span>
          </div>
          <div className="nt-rail">
            {[I.home, I.work, I.sun, I.palette, I.lock].map((d, i) => (
              <span key={i} className={i === 0 ? "on" : ""}>
                <Icon d={d} size={13} />
              </span>
            ))}
          </div>
          <div className="nt-launch glass">
            <div className="nt-tabs">
              {["All", "Apps", "Work"].map((t, i) => (
                <span key={t} className={tab === i ? "on" : ""}>
                  {t}
                </span>
              ))}
            </div>
            <div className="nt-grid" key={tab}>
              {LAUNCHER.slice(tab * 2, tab * 2 + 8).map(([n, l], i) => (
                <AppIcon key={n} n={n} label={l} style={{ animationDelay: i * 45 + "ms" }} />
              ))}
            </div>
          </div>
          <div className="nt-search glass">
            <Icon d={I.search} size={14} />
            <span className="nt-q">
              {q}
              <i className="caret" />
            </span>
            <span className="nt-mic">
              <Icon d={I.mic} size={13} />
            </span>
          </div>
          <span className="nt-ai">
            <Icon d={I.spark} size={14} />
          </span>
        </div>
      </div>

      {/* floating widgets around the frame */}
      <div className="float f-play glass-solid">
        <span className="art" />
        <span className="f-col">
          <b>Midnight City</b>
          <small>M83 · Spotify</small>
          <span className="f-prog">
            <i />
          </span>
        </span>
        <Icon d={I.pause} size={14} />
      </div>
      <div className="float f-focus glass-solid">
        <span className="ring-mini" />
        <span className="f-col">
          <b>Focus · 24:12</b>
          <small>Reddit, X and YouTube blocked</small>
        </span>
      </div>
      <div className="float f-remind glass-solid">
        <span className="f-ico">
          <Icon d={I.bell} size={14} />
        </span>
        <span className="f-col">
          <b>Call with Sara</b>
          <small>in 10 minutes</small>
        </span>
      </div>
    </div>
  );
}

/* ---------- feature mock-ups ---------- */
export function CommandMock() {
  const [q, idx] = useTyped(["focus", "wallpaper", "remind", "zen"], 1300);
  const sets = [
    [
      ["Start Focus", "25 minutes · blocks your list", I.play],
      ["Focus settings", "Lengths, sounds, auto-start", I.sun],
      ["Stats", "Time focused this week", I.grid],
    ],
    [
      ["Next wallpaper", "Live · 4K", I.sun],
      ["Online library", "Live and 4K wallpapers", I.globe],
      ["Wallpaper schedule", "Mornings & evenings", I.moon],
    ],
    [
      ["New Reminder", "Once, daily, weekdays, yearly", I.bell],
      ["Reminder sounds", "Chime, Bell, Digital…", I.bell],
      ["Plan my day", "AI planner", I.spark],
    ],
    [
      ["Zen Clock", "Press Z", I.moon],
      ["Minimal Mode", "Press M", I.grid],
      ["Zen settings", "World clocks", I.globe],
    ],
  ];
  return (
    <div className="cmd glass-solid">
      <div className="cmd-in">
        <Icon d={I.search} />
        <span>
          {q}
          <i className="caret" />
        </span>
        <span className="cmd-k">
          <kbd>Ctrl</kbd>
          <kbd>Space</kbd>
        </span>
      </div>
      <ul key={idx}>
        {sets[idx].map(([t, s, d], i) => (
          <li key={t} className={i === 0 ? "on" : ""} style={{ animationDelay: i * 60 + "ms" }}>
            <span className="cmd-ico">
              <Icon d={d} size={15} />
            </span>
            <span className="f-col">
              <b>{t}</b>
              <small>{s}</small>
            </span>
            {i === 0 && <kbd>↵</kbd>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ENGINES = [
  ["google", "Google", "!g", "best ramen near me"],
  ["youtube", "YouTube", "!yt", "lofi hip hop radio"],
  ["github", "GitHub", "!gh", "react compiler"],
  ["wikipedia", "Wikipedia", "!w", "Tokyo"],
];
export function SearchMock() {
  const i = useCycle(ENGINES.length, 2400);
  const [n, label, bang, q] = ENGINES[i];
  return (
    <div className="srch">
      <div className="srch-bar glass-solid">
        <span className="srch-eng" key={n}>
          <img src={`/media/apps/${n}.svg`} alt="" />
        </span>
        <span className="srch-q" key={q}>
          <em>{bang}</em> {q}
        </span>
        <span className="nt-mic">
          <Icon d={I.mic} size={13} />
        </span>
      </div>
      <div className="srch-chips">
        {ENGINES.map(([e, l], k) => (
          <span key={e} className={k === i ? "on" : ""}>
            <img src={`/media/apps/${e}.svg`} alt="" />
            {l}
          </span>
        ))}
        <span>+ ChatGPT, Amazon, Bing, DuckDuckGo, Brave, your own</span>
      </div>
      <p className="srch-hint">Searching {label}</p>
    </div>
  );
}

export function FocusMock() {
  const [left, setLeft] = useState(25 * 60 - 48);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s <= 0 ? 25 * 60 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const pct = left / (25 * 60);
  return (
    <div className="focus">
      <svg viewBox="0 0 120 120" className="focus-ring" aria-hidden="true">
        <circle cx="60" cy="60" r="52" className="track" />
        <circle cx="60" cy="60" r="52" className="bar" style={{ strokeDashoffset: 326.7 * (1 - pct) }} />
      </svg>
      <div className="focus-mid">
        <b>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </b>
        <small>Focus · 2 of 4</small>
      </div>
      <div className="focus-chips">
        <span>
          <Icon d={I.pause} size={12} /> Pause
        </span>
        <span>Break in {Math.ceil(left / 60)} min</span>
      </div>
    </div>
  );
}

export function RemindMock() {
  return (
    <div className="toasts">
      {[
        ["Mum's birthday", "Every year · 9:00", "Chime"],
        ["Stand up and stretch", "Weekdays · 11:30", "Soft pulse"],
        ["Pay the rent", "Monthly · 1st", "Bell"],
      ].map(([t, s, snd], i) => (
        <div className="toast glass-solid" key={t} style={{ animationDelay: i * 1.4 + "s" }}>
          <span className="f-ico">
            <Icon d={I.bell} size={14} />
          </span>
          <span className="f-col">
            <b>{t}</b>
            <small>
              {s} · {snd}
            </small>
          </span>
          <span className="toast-btns">
            <i>Snooze</i>
            <i className="on">Dismiss</i>
          </span>
        </div>
      ))}
    </div>
  );
}

/* deterministic "random" so the server and the browser agree */
function rnd(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
export function HabitMock() {
  const cells = Array.from({ length: 15 * 7 }, (_, k) => {
    const r = rnd(k + 3);
    return k > 98 ? 0 : r > 0.82 ? 0 : r > 0.45 ? 3 : r > 0.2 ? 2 : 1;
  });
  return (
    <div className="habit">
      <div className="habit-head">
        <span className="habit-check">
          <Icon d={I.check} size={14} />
        </span>
        <span className="f-col">
          <b>Read 20 pages</b>
          <small>Mon – Fri</small>
        </span>
        <span className="habit-streak">
          <b>12</b> day streak
        </span>
      </div>
      <div className="heat">
        {cells.map((v, k) => (
          <i key={k} className={"l" + v} style={{ animationDelay: (k % 15) * 30 + Math.floor(k / 15) * 12 + "ms" }} />
        ))}
      </div>
    </div>
  );
}

export function GoalsMock() {
  return (
    <div className="goals">
      {[
        ["Launch the portfolio", 72, "3 of 4 tasks"],
        ["Learn Spanish", 40, "Duolingo · 6 tasks"],
        ["Run a 10K", 100, "Done"],
      ].map(([t, p, s], i) => (
        <div className="goal" key={t as string}>
          <div className="goal-row">
            <b>{t}</b>
            <small>{p}%</small>
          </div>
          <span className={"meter" + (p === 100 ? " full" : "")}>
            <i style={{ "--w": p + "%", transitionDelay: 200 + i * 150 + "ms" } as CSSProperties} />
          </span>
          <small className="goal-sub">{s}</small>
        </div>
      ))}
    </div>
  );
}

export function StatsMock() {
  const days = [3.2, 4.8, 2.6, 5.4, 4.1, 1.8, 2.9];
  return (
    <div className="stats">
      <div className="stats-nums">
        <span>
          <b>18h 40m</b>
          <small>focused this week</small>
        </span>
        <span>
          <b>23</b>
          <small>tasks done</small>
        </span>
        <span>
          <b>41</b>
          <small>visits blocked</small>
        </span>
      </div>
      <div className="bars">
        {days.map((h, i) => (
          <span key={i}>
            <i style={{ "--h": (h / 5.4) * 100 + "%", transitionDelay: i * 70 + "ms" } as CSSProperties} />
            <small>{"MTWTFSS"[i]}</small>
          </span>
        ))}
      </div>
      <ul className="tops">
        {[
          ["github", "github.com", "6h 12m"],
          ["notion", "notion.so", "3h 05m"],
          ["youtube", "youtube.com", "1h 48m"],
        ].map(([n, d, t]) => (
          <li key={d}>
            <img src={`/media/apps/${n}.svg`} alt="" />
            {d}
            <small>{t}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlannerMock() {
  return (
    <div className="plan-tl">
      {[
        ["1:00", "Deep work · finish the report", "focus", "meet"],
        ["2:30", "Prep notes for the call", "task", ""],
        ["3:00", "Design review", "event", "meet"],
        ["4:00", "Habit · 20 pages", "habit", ""],
        ["4:30", "Inbox and wrap-up", "task", ""],
      ].map(([t, l, k, ic], i) => (
        <div className={"tl tl-" + k + (i === 0 ? " now" : "")} key={t} style={{ transitionDelay: i * 120 + "ms" }}>
          <small>{t}</small>
          <span>
            {l}
            {ic && <img src={`/media/apps/${ic}.svg`} alt="" />}
          </span>
          {i === 0 && <i className="tl-btn">Start focus</i>}
        </div>
      ))}
    </div>
  );
}

export function BlockMock() {
  return (
    <div className="block">
      <div className="block-url glass-solid">
        <img src="/media/apps/reddit.svg" alt="" />
        <span>reddit.com/r/all</span>
      </div>
      <div className="block-page">
        <span className="block-shield">
          <Icon d={I.shield} size={22} />
        </span>
        <b>This site is blocked</b>
        <small>Back to the report. You've got this.</small>
        <span className="block-groups">
          <i>Social</i>
          <i>Video</i>
          <i>News</i>
          <i>Shopping</i>
        </span>
      </div>
    </div>
  );
}

export function TabsMock() {
  const tabs = [
    ["github", "Pull request #482", ""],
    ["youtube", "Lofi radio", "playing"],
    ["docs", "Q4 plan", "zz"],
    ["github", "Pull request #482", "dup"],
    ["figma", "Landing v3", "zz"],
    ["wikipedia", "Kyoto", "zz"],
  ];
  return (
    <div className="tabs">
      {tabs.map(([n, t, s], i) => (
        <div className={"tabrow " + s} key={i} style={{ "--d": i * 90 + "ms" } as CSSProperties}>
          <img src={`/media/apps/${n}.svg`} alt="" />
          <span>{t}</span>
          {s === "zz" && <em>Asleep</em>}
          {s === "playing" && <em className="live">Playing</em>}
          {s === "dup" && <em className="dup">Duplicate</em>}
        </div>
      ))}
      <div className="tabs-foot">
        <b>1.4 GB</b> freed · sessions saved for later
      </div>
    </div>
  );
}

export function VaultMock() {
  return (
    <div className="vault">
      <span className="vault-lock">
        <Icon d={I.lock} size={22} />
      </span>
      <div className="pin">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <i key={k} style={{ animationDelay: k * 0.25 + "s" }} />
        ))}
      </div>
      <small>Encrypted with AES-GCM · only your password opens it</small>
    </div>
  );
}

const HELLO = [
  ["English", "Your new tab, finally worth opening."],
  ["Español", "Tu nueva pestaña, por fin vale la pena."],
  ["Français", "Votre nouvel onglet, enfin digne d'être ouvert."],
  ["日本語", "新しいタブを、開きたくなる場所に。"],
  ["Deutsch", "Dein neuer Tab, endlich sehenswert."],
  ["العربية", "علامة تبويب جديدة تستحق الفتح أخيرًا."],
];
export function TranslateMock() {
  const i = useCycle(HELLO.length, 2200);
  return (
    <div className="tr">
      <div className="tr-badge glass-solid">
        <img src="/media/apps/translate.svg" alt="" />
        <span key={i}>{HELLO[i][0]}</span>
        <i>Show original</i>
      </div>
      <p className="tr-text" key={"t" + i} dir={HELLO[i][0] === "العربية" ? "rtl" : "ltr"}>
        {HELLO[i][1]}
      </p>
    </div>
  );
}

export function VoiceMock() {
  return (
    <div className="voice">
      <span className="voice-mic">
        <Icon d={I.mic} size={20} />
      </span>
      <span className="wave">
        {Array.from({ length: 22 }, (_, k) => (
          <i key={k} style={{ animationDelay: -rnd(k) * 1.2 + "s", animationDuration: 0.7 + rnd(k + 9) * 0.6 + "s" }} />
        ))}
      </span>
      <small>Listening… “remind me to call mum at six”</small>
    </div>
  );
}

export function ChatMock() {
  const step = useCycle(4, 1700);
  return (
    <div className="chat">
      <p className="me">What's on my calendar after lunch?</p>
      {step === 0 ? (
        <p className="bot typing">
          <i />
          <i />
          <i />
        </p>
      ) : (
        <p className="bot">A design review at 3:00 (Meet link ready) and the gym at 6. Want me to block 1:00–2:30 for the report?</p>
      )}
    </div>
  );
}

export function CalendarMock() {
  return (
    <div className="agenda">
      {[
        ["Today", "10:00", "Stand-up", true],
        ["", "15:00", "Design review", true],
        ["Tomorrow", "09:30", "Dentist", false],
        ["Thu", "19:00", "Dinner at Nami", false],
      ].map(([d, t, l, meet], i) => (
        <div className="ag" key={i}>
          <small className="ag-day">{d}</small>
          <span className="ag-bar" />
          <span className="f-col">
            <b>{l}</b>
            <small>{t}</small>
          </span>
          {meet && (
            <i className="ag-join">
              <img src="/media/apps/meet.svg" alt="" /> Join
            </i>
          )}
        </div>
      ))}
    </div>
  );
}

export function PlayingMock() {
  return (
    <div className="np glass-solid">
      <span className="np-art" />
      <div className="np-body">
        <b>Weightless</b>
        <small>Marconi Union · YouTube Music</small>
        <span className="np-prog">
          <i />
        </span>
        <span className="np-ctl">
          <Icon d={I.prev} size={14} />
          <span className="np-pp">
            <Icon d={I.pause} size={14} />
          </span>
          <Icon d={I.next} size={14} />
        </span>
      </div>
    </div>
  );
}

export function SyncMock() {
  return (
    <div className="sync">
      <span className="dev">
        <Icon d={I.laptop} size={26} />
        <small>Laptop</small>
      </span>
      <span className="wire">
        <i />
        <i />
      </span>
      <span className="dev hub">
        <img src="/media/icon.png" alt="" />
      </span>
      <span className="wire">
        <i />
        <i />
      </span>
      <span className="dev">
        <Icon d={I.monitor} size={26} />
        <small>Desktop</small>
      </span>
    </div>
  );
}

export function QuoteMock() {
  const qs = [
    ["The secret of getting ahead is getting started.", "Mark Twain"],
    ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
    ["Well begun is half done.", "Aristotle"],
  ];
  const i = useCycle(qs.length, 3600);
  return (
    <figure className="quote" key={i}>
      <blockquote>“{qs[i][0]}”</blockquote>
      <figcaption>— {qs[i][1]}</figcaption>
    </figure>
  );
}

export function CursorMock() {
  return (
    <div className="cursors">
      {["#ffffff", "var(--a)", "#7cc4ff", "#f4a6c1", "#c8f169"].map((c, k) => (
        <span key={k} style={{ animationDelay: k * 0.3 + "s" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M5 3l14 7-6 2-2 6z" fill={c} stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export function ZenMock() {
  const now = useNow(1000);
  const cities: [string, number][] = [
    ["London", 0],
    ["Tokyo", 9],
    ["New York", -5],
  ];
  return (
    <div className="zen">
      <video className="zen-bg" src="/media/wp/monolith.mp4" poster="/media/wp/monolith.jpg" muted loop playsInline autoPlay preload="metadata" />
      <b className="zen-t">{hm(now, { seconds: true })}</b>
      <small className="zen-d">{now ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : " "}</small>
      <span className="zen-w">
        {cities.map(([c, off]) => {
          const d = now ? new Date(now.getTime() + (now.getTimezoneOffset() + off * 60) * 60000) : null;
          return (
            <span key={c}>
              <b>{hm(d)}</b>
              {c}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export function LightMock() {
  return (
    <div className="light">
      <div className="light-card">
        <span>Border light</span>
        {[
          ["Glass", 64],
          ["Blur", 82],
          ["Roundness", 48],
        ].map(([l, v], k) => (
          <label key={l as string}>
            {l}
            <span className="slider">
              <i style={{ "--v": v + "%", animationDelay: k * 0.6 + "s" } as CSSProperties} />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
