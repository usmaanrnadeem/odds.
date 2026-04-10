"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Market, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import OnboardingModal, { hasSeenOnboarding } from "@/components/OnboardingModal";

function fmtCloseTime(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `closes in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `closes in ${hrs}h ${mins % 60}m`;
  return `closes ${new Date(closesAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

function OddsBar({ yesProb }: { yesProb: number }) {
  const yesPct = Math.round(yesProb * 100);
  return (
    <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${yesPct}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
    </div>
  );
}

function MarketCard({ market, position }: { market: Market; position?: { yes: number; no: number } }) {
  const settled = market.status === "settled";
  const isClosed = !settled && market.closes_at != null && new Date(market.closes_at) < new Date();
  const hasYes = (position?.yes ?? 0) > 0;
  const hasNo  = (position?.no  ?? 0) > 0;
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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: settled ? "var(--muted)" : isClosed ? "var(--muted)" : "var(--accent)", letterSpacing: "0.1em" }}>
            {settled ? "SETTLED" : isClosed ? "CLOSED" : "● LIVE"}
          </span>
          {settled && market.settled_side !== null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {market.settled_side ? "YES" : "NO"} won
            </span>
          )}
          {isClosed && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              awaiting result
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
        {/* Close time — shown when live and a deadline exists */}
        {!settled && !isClosed && market.closes_at && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "8px 0 0", letterSpacing: "0.04em" }}>
            {fmtCloseTime(market.closes_at)}
          </p>
        )}
        {/* Position row — only show when user holds a position */}
        {(hasYes || hasNo) && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {hasYes && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)", padding: "2px 6px" }}>
                YES {position!.yes.toFixed(0)}×
              </span>
            )}
            {hasNo && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--no)", background: "color-mix(in srgb, var(--no) 12%, transparent)", padding: "2px 6px" }}>
                NO {position!.no.toFixed(0)}×
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [markets,    setMarkets]   = useState<Market[]>([]);
  const [positions,  setPositions] = useState<Map<number, { yes: number; no: number }>>(new Map());
  const [fetching,   setFetching]  = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id && !user.is_admin) router.replace("/join");
    // Show onboarding once — first time a user with a group hits the home page
    if (!loading && user?.group_id && !hasSeenOnboarding()) setShowOnboarding(true);
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.markets(),
      api.allPositions(),
    ]).then(([mkts, pos]) => {
      setMarkets(mkts);
      setPositions(new Map(pos.map(p => [p.market_id, p])));
    }).finally(() => setFetching(false));

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
      {showOnboarding && (
        <OnboardingModal
          startingPts={user.points}
          onDone={() => setShowOnboarding(false)}
        />
      )}
      <main className="page-content">
        <div style={{ marginBottom: 24, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>
            {user.points.toFixed(0)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>pts</span>
          <button
            onClick={() => setShowOnboarding(true)}
            title="How to play"
            style={{
              marginLeft: "auto", background: "none", border: "none",
              color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 14,
              cursor: "pointer", padding: "4px 6px", lineHeight: 1,
              opacity: 0.6,
            }}
          >
            ⓘ
          </button>
        </div>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : (
          <>
            {open.length === 0 && (
              <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>
                no open markets yet
              </p>
            )}
            {open.map(m => <MarketCard key={m.market_id} market={m} position={positions.get(m.market_id)} />)}
          </>
        )}
      </main>
    </>
  );
}
