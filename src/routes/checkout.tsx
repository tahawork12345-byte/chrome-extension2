import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mark } from "@/components/site/layout";
import { API_URL } from "@/lib/site";

/* Paddle's "default payment link" points here. Paddle adds ?_ptxn=txn_...
   (made by the backend's POST /billing/checkout) and Paddle.js opens that
   checkout inline, in .checkout-container. */
export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Atlas Pro" }, { name: "robots", content: "noindex, nofollow" }],
    scripts: [{ src: "https://cdn.paddle.com/paddle/v2/paddle.js" }],
  }),
  component: Checkout,
});

type Totals = { subtotal?: number; tax?: number; total?: number; discount?: number };
type Summary = { name: string; interval: string | null; unit?: number; totals: Totals; currency: string; email?: string };

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (opts: unknown) => void;
    };
  }
}

function Checkout() {
  const [stage, setStage] = useState<"loading" | "ready" | "done" | "error" | "missing">("loading");
  const [message, setMessage] = useState("Loading secure checkout…");
  const [sum, setSum] = useState<Summary>({ name: "Atlas Pro", interval: null, totals: {}, currency: "USD" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!new URLSearchParams(location.search).get("_ptxn")) {
      setStage("missing");
      return;
    }

    const read = (d: any) => {
      if (!d) return;
      const item = (d.items || [])[0] || {};
      setSum((s) => ({
        name: item.price_name || (item.product && item.product.name) || s.name,
        interval: item.billing_cycle ? item.billing_cycle.interval : s.interval,
        unit: item.totals ? item.totals.subtotal : s.unit,
        totals: d.totals || s.totals,
        currency: d.currency_code || s.currency,
        email: (d.customer && d.customer.email) || s.email,
      }));
    };

    /* paddle.js arrives through <head>; wait for it */
    const waitPaddle = () =>
      new Promise<NonNullable<Window["Paddle"]>>((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => (window.Paddle ? resolve(window.Paddle) : Date.now() - t0 > 15000 ? reject(new Error("paddle")) : setTimeout(tick, 100));
        tick();
      });

    Promise.all([fetch(API_URL + "/billing/config").then((r) => r.json()), waitPaddle()])
      .then(([cfg, Paddle]) => {
        if (!cfg.clientToken) throw new Error("no client token");
        if (cfg.environment === "sandbox") Paddle.Environment.set("sandbox");
        Paddle.Initialize({
          token: cfg.clientToken,
          checkout: {
            settings: {
              displayMode: "inline",
              variant: "one-page",
              frameTarget: "checkout-container",
              frameInitialHeight: 480,
              frameStyle: "width: 100%; min-width: 280px; background-color: transparent; border: none;",
              theme: "light",
            },
          },
          eventCallback(e: { name: string; data: unknown }) {
            if (e.name === "checkout.loaded") {
              setStage("ready");
              read(e.data);
            } else if (e.name === "checkout.completed") {
              read(e.data);
              setStage("done");
            } else if (e.name === "checkout.error") {
              setStage("error");
              setMessage("Something went wrong loading checkout. Please refresh the page.");
            } else if (e.name.startsWith("checkout.")) read(e.data);
          },
        });
        setTimeout(() => setStage((s) => (s === "loading" ? "error" : s)), 20000);
      })
      .catch(() => {
        setStage("error");
        setMessage("Checkout is unavailable right now. Please try again in a moment.");
      });
  }, []);

  const fmt = (n?: number) => {
    if (n == null || !Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: sum.currency }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };

  return (
    <div className="site checkout">
      <header className="wrap co-head">
        <Link to="/" className="brand">
          <Mark />
          <span>Atlas</span>
        </Link>
        <span className="co-secure">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
          Secure checkout
        </span>
      </header>

      <main className="wrap co-grid">
        <section className="co-summary" aria-label="Order summary">
          <p className="eyebrow">Atlas Pro</p>
          <h1 className="h2">{sum.name}</h1>
          <p className="co-cycle">
            {sum.interval === "year" ? "Billed yearly" : sum.interval === "month" ? "Billed monthly" : "Subscription"} · cancel anytime
          </p>
          {(sum.unit ?? sum.totals.subtotal) != null && (
            <p className="plan-price">
              <b>{fmt(sum.unit ?? sum.totals.subtotal)}</b>
              <span>{sum.interval ? "per " + sum.interval : ""}</span>
            </p>
          )}
          {sum.totals.total != null && (
            <dl className="co-lines">
              <div>
                <dt>Subtotal</dt>
                <dd>{fmt(sum.totals.subtotal)}</dd>
              </div>
              {!!sum.totals.discount && (
                <div>
                  <dt>Discount</dt>
                  <dd>−{fmt(sum.totals.discount)}</dd>
                </div>
              )}
              <div>
                <dt>Tax</dt>
                <dd>{fmt(sum.totals.tax || 0)}</dd>
              </div>
              <div className="co-total">
                <dt>Due today</dt>
                <dd>{fmt(sum.totals.total)}</dd>
              </div>
            </dl>
          )}
          <ul className="ticks">
            <li>Every theme, cursor pack and your own cursors</li>
            <li>Unlimited 4K and live wallpapers</li>
            <li>Private space, sync and backup</li>
            <li>AI day planner, calendar and 30-day stats</li>
          </ul>
          <p className="fine">
            Cancel anytime from Atlas › Customize › Account. Payments are handled by Paddle, our merchant of record. See our{" "}
            <Link to="/refunds">refund policy</Link>.
          </p>
        </section>

        <section className="co-pay" aria-label="Payment">
          <div className="checkout-container" />
          {stage !== "ready" && stage !== "done" && (
            <div className="co-state">
              {stage === "loading" && <span className="spin" aria-hidden="true" />}
              {stage === "missing" ? (
                <div>
                  <h2>Start from Atlas</h2>
                  <p>
                    Open a new tab, then go to Customize › Account › Upgrade to Pro. Checkout opens here with your account
                    attached.
                  </p>
                </div>
              ) : (
                <p>{message}</p>
              )}
            </div>
          )}
        </section>
      </main>

      {stage === "done" && (
        <div className="co-done" role="dialog" aria-modal="true" aria-labelledby="coDone">
          <div className="co-done-card">
            <span className="co-tick">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h2 id="coDone">You're on Atlas Pro</h2>
            <p>
              Payment received. A receipt is on its way{sum.email ? " to " : ""}
              {sum.email && <b>{sum.email}</b>}.
            </p>
            <div className="co-next">
              <b>Next:</b> switch back to your Atlas tab. It confirms the payment and unlocks everything by itself, usually
              within a few seconds.
            </div>
            <CloseTab />
          </div>
        </div>
      )}
    </div>
  );
}

function CloseTab() {
  const [hint, setHint] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        autoFocus
        onClick={() => {
          window.close();
          /* a page may only close a tab it opened itself */
          setTimeout(() => setHint("You can close this tab now (Ctrl+W)."), 150);
        }}
      >
        Close this tab
      </button>
      <p className="fine">{hint}</p>
    </>
  );
}
