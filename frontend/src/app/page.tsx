"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Market, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

function OddsBar({ yesProb }: { yesProb: number }) {
  const yesPct = Math.round(yesProb * 100);
  return (
    <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${yesPct}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  const settled = market.status === "settled";
  return (
    <Link href={`/markets/${market.market_id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          marginBottom: 1,
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--text)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: settled ? "var(--muted)" : "var(--accent)", letterSpacing: "0.1em" }}>
            {settled ? "SETTLED" : "● LIVE"}
          </span>
          {settled && market.settled_side !== null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {market.settled_side ? "YES" : "NO"} won
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text)", lineHeight: 1.4 }}>
          {market.title}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)" }}>
            YES {market.yes_odds}×
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no)" }}>
            NO {market.no_odds}×
          </span>
        </div>
        <OddsBar yesProb={market.yes_prob} />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.markets().then(setMarkets).finally(() => setFetching(false));
    const disconnect = connectWS((event: WSEvent) => {
      if (event.type === "trade") {
        setMarkets(prev =>
          prev.map(m =>
            m.market_id === event.market_id
              ? { ...m, yes_prob: event.yes_prob, no_prob: event.no_prob, yes_odds: event.yes_odds, no_odds: event.no_odds }
              : m
          )
        );
      }
      if (event.type === "settlement") {
        setMarkets(prev => prev.filter(m => m.market_id !== event.market_id));
      }
    });
    return disconnect;
  }, [user]);

  if (loading || !user) return null;

  const open    = markets.filter(m => m.status === "open");
  const settled = markets.filter(m => m.status === "settled");

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>
            {user.points.toFixed(0)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>pts</span>
        </div>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : (
          <>
            {open.length === 0 && (
              <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>
                no open markets — ask an admin to create one
              </p>
            )}
            {open.map(m => <MarketCard key={m.market_id} market={m} />)}
          </>
        )}
      </main>
    </>
  );
}
