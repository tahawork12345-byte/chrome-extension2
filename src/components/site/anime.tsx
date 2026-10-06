/* For the anime lovers: live 4K anime wallpapers and 4K stills, pulled
   live from the same libraries Atlas uses. */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Reveal } from "@/components/site/layout";
import { getAnime, getAnimeTags, type AnimeItem, type AnimeMode } from "@/lib/anime";

const MODES: { id: AnimeMode; label: string }[] = [
  { id: "live", label: "Live 4K" },
  { id: "stills", label: "4K stills" },
  { id: "summon", label: "Surprise me" },
];

const arrow = (d: string) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function AnimeLovers() {
  const [mode, setMode] = useState<AnimeMode>("live");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [tags, setTags] = useState<{ live: string[]; stills: string[] } | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [deal, setDeal] = useState(0);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(false);
  const [reshuffle, setReshuffle] = useState(0);
  const rootRef = useRef<HTMLElement>(null);

  /* nothing is fetched until the section is close to the screen */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    getAnimeTags().then(setTags, () => setTags({ live: [], stills: [] }));
  }, [seen]);

  const load = useCallback(async (m: AnimeMode, query: string, pg: number) => {
    setState("loading");
    try {
      const r = await getAnime({ data: { mode: m, q: query, page: pg } });
      setItems(r.items);
      setLastPage(r.lastPage);
      setSel(0);
      setDeal((d) => d + 1);
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (seen) load(mode, q, page);
  }, [seen, mode, q, page, reshuffle, load]);

  /* only the series that have something in the current tab */
  const listFor = (m: AnimeMode) => (!tags ? [] : m === "live" ? tags.live : m === "stills" ? tags.stills : [...new Set([...tags.live, ...tags.stills])]);
  const shown = listFor(mode);

  const pickMode = (m: AnimeMode) => {
    if (m === mode) return m === "summon" ? setReshuffle((n) => n + 1) : undefined;
    setMode(m);
    setPage(1);
    if (q && !listFor(m).includes(q)) setQ("");
  };
  const pickTag = (t: string) => {
    setQ(q === t ? "" : t);
    setPage(1);
  };

  const cur = items[sel];
  const next = items.length > 1 ? items[(sel + 1) % items.length] : undefined;
  const loading = state === "loading";

  /* the spotlight moves on by itself, but its clock only starts once the
     wallpaper is showing (or has given up), so slow clips aren't cut off */
  const [spotState, setSpotState] = useState<{ id: string; status: SpotStatus }>({ id: "", status: "loading" });
  const curStatus = cur && spotState.id === cur.id ? spotState.status : "loading";
  const onStatus = useCallback((id: string, status: SpotStatus) => setSpotState({ id, status }), []);
  const ticking = !paused && items.length > 1 && curStatus !== "loading";
  useEffect(() => {
    if (!ticking) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setSel((s) => (s + 1) % items.length), 8000);
    return () => clearTimeout(t);
  }, [sel, ticking, items.length]);

  /* fetch the next 4K still ahead of time, so the spotlight is sharp when it gets there */
  useEffect(() => {
    if (next && next.kind === "still") {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = next.media;
    }
  }, [next]);

  return (
    <section className="section tint anime" id="anime" ref={rootRef}>
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">For the anime lovers</p>
          <h2 className="h2">
            Anime lover? <em>Your new tab just levelled up.</em>
          </h2>
          <p className="lede">
            Live 4K anime wallpapers and thousands of 4K stills, from the same library inside Atlas. Pick a series, watch it
            move, then make it your new tab.
          </p>
        </Reveal>

        <Reveal className="anime-ctl" delay={80}>
          <div className="toggle" role="tablist" aria-label="Kind of wallpaper">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? "on" : ""} onClick={() => pickMode(m.id)}>
                {m.id === "live" && <span className="live-dot" />}
                {m.label}
              </button>
            ))}
          </div>
          <div className="anime-tags" aria-label="Series">
            {!tags
              ? Array.from({ length: 7 }, (_, k) => <span key={k} className="anime-tag skel" />)
              : shown.map((t, k) => (
                  <button key={mode + t} type="button" className={"anime-tag" + (q === t ? " on" : "")} style={{ animationDelay: k * 30 + "ms" }} onClick={() => pickTag(t)}>
                    {t}
                  </button>
                ))}
          </div>
        </Reveal>

        {state === "error" ? (
          <div className="anime-err">
            <b>Couldn't reach the wallpaper library.</b>
            <span>It's usually back in a moment.</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => load(mode, q, page)}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className={"spot" + (loading ? " is-loading" : "")} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              {cur ? (
                <>
                  <SpotMedia key={cur.id} item={cur} onStatus={onStatus} />
                  {/* the next live clip starts downloading while this one shows */}
                  {next?.kind === "live" && <video key={"pre" + next.id} className="spot-pre" src={clipSrc(next.media)} muted preload="auto" aria-hidden="true" />}
                  <div className="spot-top">
                    <span className="spot-badge">
                      {cur.kind === "live" ? (
                        <>
                          <span className="live-dot" /> Live · 4K
                        </>
                      ) : (
                        "4K still"
                      )}
                    </span>
                    <span className="spot-count">
                      <b>{String(sel + 1).padStart(2, "0")}</b> / {String(items.length).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="spot-info" key={"i" + cur.id}>
                    {cur.title && <h3>{cur.title}</h3>}
                    <div className="spot-meta">
                      <span>{cur.resolution}</span>
                      {q && <span>{q}</span>}
                      {cur.colors.length > 0 && (
                        <span className="spot-pal" aria-label="Colour palette">
                          {cur.colors.map((c) => (
                            <i key={c} style={{ background: c }} title={c} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" className="spot-nav prev" aria-label="Previous wallpaper" onClick={() => setSel((s) => (s - 1 + items.length) % items.length)}>
                    {arrow("M15 5l-7 7 7 7")}
                  </button>
                  <button type="button" className="spot-nav next" aria-label="Next wallpaper" onClick={() => setSel((s) => (s + 1) % items.length)}>
                    {arrow("M9 5l7 7-7 7")}
                  </button>
                  <span className="spot-bar" key={"b" + sel + String(ticking)}>
                    <i className={ticking ? "run" : ""} />
                  </span>
                </>
              ) : (
                <span className="spot-empty">{loading ? "Loading wallpapers…" : "Nothing here yet. Try another series."}</span>
              )}
            </div>

            <div className="deck">
              {loading && !items.length
                ? Array.from({ length: 12 }, (_, k) => <span key={k} className="holo skel" />)
                : items.map((it, k) => <WallCard key={deal + it.id} it={it} k={k} on={k === sel} dim={loading} onPick={() => setSel(k)} />)}
            </div>

            <div className="deck-foot">
              {mode !== "summon" ? (
                <>
                  <button type="button" className="btn btn-quiet btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                    ← Previous
                  </button>
                  <span>
                    Page {page} of {Math.max(lastPage, 1).toLocaleString()}
                  </span>
                  <button type="button" className="btn btn-quiet btn-sm" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-quiet btn-sm" disabled={loading} onClick={() => setReshuffle((n) => n + 1)}>
                  Shuffle again
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

type SpotStatus = "loading" | "ready" | "failed";

/* how long a wallpaper gets to appear before the poster is shown instead */
const SPOT_WAIT = 15000;

/* once a clip has failed straight from wallpaperwaves.com, the rest go through /api/video */
let directBroken = false;
const viaSite = (u: string) => "/api/video?u=" + encodeURIComponent(u);
const clipSrc = (u: string) => (directBroken ? viaSite(u) : u);

/* the big picture: the live clip, or the 4K still once it has arrived.
   A live clip that errors or stalls is retried once through our own
   server (/api/video), then falls back to its poster. */
function SpotMedia({ item, onStatus }: { item: AnimeItem; onStatus: (id: string, s: SpotStatus) => void }) {
  const [status, setStatus] = useState<SpotStatus>("loading");
  const [viaProxy, setViaProxy] = useState(() => directBroken);
  const [attempt, setAttempt] = useState(0);
  const live = item.kind === "live";
  const src = live && viaProxy ? viaSite(item.media) : item.media;

  useEffect(() => onStatus(item.id, status), [item.id, status, onStatus]);

  const fail = useCallback(() => {
    if (live && !viaProxy) {
      directBroken = true;
      setViaProxy(true);
      setAttempt((n) => n + 1);
    } else setStatus("failed");
  }, [live, viaProxy]);

  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(fail, SPOT_WAIT);
    return () => clearTimeout(t);
  }, [status, attempt, fail]);

  const retry = () => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  return (
    <div className="spot-media">
      <img className="spot-poster" src={item.poster} alt="" referrerPolicy="no-referrer" />
      {status !== "failed" &&
        (live ? (
          <video
            key={attempt}
            className={"spot-full" + (status === "ready" ? " on" : "")}
            src={src}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            onPlaying={() => setStatus("ready")}
            onError={fail}
          />
        ) : (
          <img
            key={attempt}
            className={"spot-full" + (status === "ready" ? " on" : "")}
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            decoding="async"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("failed")}
          />
        ))}
      {status === "loading" && <span className="spot-loading">{live ? "Loading live preview…" : "Loading 4K…"}</span>}
      {status === "failed" && (
        <button type="button" className="spot-loading spot-retry" onClick={retry}>
          {live ? "Live preview didn't load · Retry" : "4K didn't load · Retry"}
        </button>
      )}
    </div>
  );
}

function WallCard({ it, k, on, dim, onPick }: { it: AnimeItem; k: number; on: boolean; dim: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(false);
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    const s = e.currentTarget.style;
    s.setProperty("--px", x * 100 + "%");
    s.setProperty("--py", y * 100 + "%");
    s.setProperty("--rx", ((0.5 - y) * 12).toFixed(1) + "deg");
    s.setProperty("--ry", ((x - 0.5) * 16).toFixed(1) + "deg");
  };
  const onLeave = (e: PointerEvent<HTMLButtonElement>) => {
    setHover(false);
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };
  return (
    <button
      type="button"
      className={"holo" + (on ? " on" : "") + (dim ? " dim" : "")}
      style={{ "--d": k * 60 + "ms" } as CSSProperties}
      onPointerMove={onMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={onLeave}
      onClick={onPick}
      aria-label={(it.title || "Anime wallpaper") + ", " + (it.kind === "live" ? "live 4K" : it.resolution)}
      aria-pressed={on}
    >
      <span className="holo-in">
        <img src={it.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" />
        {hover && it.kind === "live" && <video src={clipSrc(it.media)} muted loop playsInline autoPlay />}
        <span className="holo-foil" />
        <span className="holo-badge">
          {it.kind === "live" ? (
            <>
              <span className="live-dot" /> Live
            </>
          ) : (
            "4K"
          )}
        </span>
        {it.title && <span className="holo-title">{it.title}</span>}
      </span>
    </button>
  );
}
