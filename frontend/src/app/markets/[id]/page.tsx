"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, Market, FeedEntry, WSEvent, connectWS, ApiError } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 448, h = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function OddsBar({ yesProb }: { yesProb: number }) {
  return (
    <div style={{ height: 4, background: "var(--border)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round(yesProb * 100)}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
    </div>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = parseInt(id);
  const { user, loading, refresh } = useUser();
  const router = useRouter();

  const [market,   setMarket]   = useState<Market | null>(null);
  const [feed,     setFeed]     = useState<FeedEntry[]>([]);
  const [arc,      setArc]      = useState<number[]>([]);
  const [position, setPosition] = useState<{ yes: number; no: number } | null>(null);
  const [qty,      setQty]      = useState(1);
  const [side,    setSide]    = useState<boolean>(true); // true=YES
  const [busy,    setBusy]    = useState(false);
  const [tab,     setTab]     = useState<"buy" | "sell">("buy");
  const [flash,   setFlash]   = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.market(marketId).then(setMarket);
    api.activity(marketId).then(setFeed);
    api.priceArc(marketId).then(setArc);
    api.position(marketId).then(setPosition).catch(() => {});

    const disconnect = connectWS((event: WSEvent) => {
      if (event.type === "trade" && event.market_id === marketId) {
        setMarket(prev => prev ? {
          ...prev,
          yes_prob: event.yes_prob,
          no_prob: event.no_prob,
          yes_odds: event.yes_odds,
          no_odds: event.no_odds,
        } : prev);
        setArc(prev => [...prev, event.yes_prob]);
        // Deduplicate by trade_id — guards against the activity re-fetch
        // race that happens when refresh() updates the user object reference.
        setFeed(prev => {
          if (prev.some(e => e.trade_id === event.feed_entry.trade_id)) return prev;
          return [event.feed_entry, ...prev].slice(0, 50);
        });
      }
    });
    return disconnect;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, marketId]); // user.user_id not user — avoids re-running when points change after refresh()

  async function trade() {
    if (!market || !user) return;
    setBusy(true);
    setError(null);
    try {
      const fn = tab === "buy" ? api.buy : api.sell;
      const result = await fn(marketId, side, qty);
      setFlash(tab === "buy"
        ? `Bought ${qty} ${side ? "YES" : "NO"} for ${result.cost.toFixed(1)} pts`
        : `Sold ${qty} ${side ? "YES" : "NO"} for ${result.cost.toFixed(1)} pts`
      );
      await refresh(); // update balance
      api.position(marketId).then(setPosition).catch(() => {});
      setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !market) return null;

  const isOpen = market.status === "open";

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", marginBottom: 16, padding: 0 }}
        >
          ← markets
        </button>

        {/* Market header */}
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, lineHeight: 1.4, color: "var(--text)" }}>
          {market.title}
        </h1>

        {/* Odds */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
            {market.yes_odds}×
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", alignSelf: "center" }}>
            {Math.round(market.yes_prob * 100)}% YES
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--no)" }}>
            {market.no_odds}×
          </span>
        </div>
        <OddsBar yesProb={market.yes_prob} />

        {/* Price chart */}
        {arc.length >= 2 && (
          <div style={{ marginTop: 16, padding: "12px 0 4px" }}>
            <Sparkline data={arc} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.08em" }}>
                PRICE HISTORY
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)" }}>
                {Math.round(arc[0] * 100)}% → {Math.round(arc[arc.length - 1] * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Trade panel */}
        {isOpen && (
          <div style={{ marginTop: 24, background: "var(--surface)", border: "1px solid var(--border)", padding: 16 }}>
            {/* Buy / Sell tabs */}
            <div style={{ display: "flex", marginBottom: 16, gap: 1 }}>
              {(["buy", "sell"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: tab === t ? "var(--border)" : "transparent",
                    border: "1px solid var(--border)",
                    color: tab === t ? "var(--text)" : "var(--muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: tab === t ? 700 : 400,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* YES / NO */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setSide(true)}
                style={{
                  flex: 1, padding: "12px",
                  background: side ? "var(--accent)" : "transparent",
                  border: `1px solid ${side ? "var(--accent)" : "var(--border)"}`,
                  color: side ? "#000" : "var(--accent)",
                  fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                YES {market.yes_odds}×
              </button>
              <button
                onClick={() => setSide(false)}
                style={{
                  flex: 1, padding: "12px",
                  background: !side ? "var(--no)" : "transparent",
                  border: `1px solid ${!side ? "var(--no)" : "var(--border)"}`,
                  color: !side ? "#fff" : "var(--no)",
                  fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                NO {market.no_odds}×
              </button>
            </div>

            {/* Quantity */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={qBtnStyle}>−</button>
              <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                {qty}
              </span>
              <button onClick={() => setQty(q => Math.min(10000, q + 10))} style={qBtnStyle}>+10</button>
              <button onClick={() => setQty(q => Math.min(10000, q + 1))} style={qBtnStyle}>+</button>
            </div>

            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", marginBottom: 8 }}>{error}</p>}
            {flash && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 8 }}>{flash}</p>}

            <button
              onClick={trade}
              disabled={busy}
              style={{
                width: "100%", padding: "13px",
                background: side ? "var(--accent)" : "var(--no)",
                border: "none",
                color: side ? "#000" : "#fff",
                fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "…" : `${tab} ${qty} ${side ? "YES" : "NO"}`}
            </button>

            {/* Position summary */}
            {position && (position.yes > 0 || position.no > 0) && (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                {position.yes > 0 && (
                  <div style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--accent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>YES</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{position.yes.toFixed(1)}</span>
                  </div>
                )}
                {position.no > 0 && (
                  <div style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--no)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--no)", letterSpacing: "0.08em" }}>NO</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--no)" }}>{position.no.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settled banner */}
        {!isOpen && (
          <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            {market.status === "settled"
              ? `settled — ${market.settled_side ? "YES" : "NO"} won`
              : "market closed"}
          </div>
        )}

        {/* Activity feed */}
        <div style={{ marginTop: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>ACTIVITY</p>
          {feed.length === 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>no trades yet</p>
          )}
          {feed.map(entry => (
            <div key={entry.trade_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <Token tokenKey={entry.token_key as TokenKey} size={24} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flex: 1 }}>
                {entry.username}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: entry.side ? "var(--accent)" : "var(--no)" }}>
                {entry.side ? "YES" : "NO"} ×{entry.quantity}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                {entry.cost.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

const qBtnStyle: React.CSSProperties = {
  width: 40, height: 40,
  background: "var(--canvas)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 16,
  cursor: "pointer",
};
