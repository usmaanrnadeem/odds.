"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Market, League, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";
import OnboardingModal, { hasSeenOnboarding } from "@/components/OnboardingModal";

function LandingPage() {
  const FEATURES = [
    { icon: "⚡", title: "Live odds", body: "Every bet moves the market in real time. Watch prices shift as your crew trades." },
    { icon: "🏆", title: "Leagues & seasons", body: "Run weekly or biweekly seasons with your own markets. Crown a champion at the end." },
    { icon: "💡", title: "Crowd-sourced markets", body: "Anyone can pitch a market idea. Admin picks the best ones and posts them." },
    { icon: "📊", title: "Track your PnL", body: "See exactly how you did on every market — what you paid in, what you got back." },
  ];

  return (
    <main style={{ background: "var(--canvas)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 48, color: "var(--accent)", letterSpacing: "-0.02em" }}>
            odds.
          </span>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, color: "var(--text)", margin: "16px 0 8px", lineHeight: 1.4 }}>
            Prediction markets for your friend group.
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", margin: "0 0 32px", lineHeight: 1.6 }}>
            Bet on anything. Watch live odds. Run leagues. No real money — just bragging rights.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/register" style={{
              display: "block", padding: "16px",
              background: "var(--accent)", color: "#000",
              fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.06em", textTransform: "uppercase",
              textDecoration: "none", textAlign: "center",
            }}>
              create account
            </a>
            <a href="/login" style={{
              display: "block", padding: "14px",
              background: "transparent", border: "1px solid var(--border)", color: "var(--muted)",
              fontFamily: "var(--font-mono)", fontSize: 13,
              textDecoration: "none", textAlign: "center",
            }}>
              sign in
            </a>
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 20 }}>
            HOW IT WORKS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              "Create an account and start a group (or join one via invite link).",
              "Your admin creates markets — or the crew pitches ideas.",
              "Everyone trades YES / NO with their starting points.",
              "Admin settles each market. Winners earn trophies.",
              "Run it as a one-off or set up a season with weekly drops.",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", minWidth: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 20 }}>
            FEATURES
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                padding: "16px 14px",
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", margin: "0 0 6px", fontWeight: 600 }}>
                  {f.title}
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA repeat */}
        <div style={{ textAlign: "center", paddingBottom: 40 }}>
          <a href="/register" style={{
            display: "inline-block", padding: "14px 32px",
            background: "var(--accent)", color: "#000",
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none",
          }}>
            start for free
          </a>
        </div>
      </div>
    </main>
  );
}

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
    <div style={{ height: 3, background: "var(--no)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${yesPct}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
    </div>
  );
}

// Render title with subject's name highlighted + token inline
function MarketTitle({ title, username, tokenKey }: { title: string; username: string | null; tokenKey: string | null }) {
  if (!username || !tokenKey) {
    return <span>{title}</span>;
  }
  const idx = title.toLowerCase().indexOf(username.toLowerCase());
  if (idx === -1) {
    return <span>{title}</span>;
  }
  return (
    <span>
      {title.slice(0, idx)}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle" }}>
        <Token tokenKey={tokenKey as TokenKey} size={16} />
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{title.slice(idx, idx + username.length)}</span>
      </span>
      {title.slice(idx + username.length)}
    </span>
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
          marginBottom: 8,
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
        {market.subject_username && market.subject_token_key && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Token tokenKey={market.subject_token_key as TokenKey} size={18} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
              {market.subject_username.toUpperCase()}
            </span>
          </div>
        )}
        <p style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text)", lineHeight: 1.4 }}>
          <MarketTitle title={market.title} username={market.subject_username} tokenKey={market.subject_token_key} />
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)" }}>
            YES {Math.round(market.yes_prob * 100)}%
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no)" }}>
            NO {Math.round(market.no_prob * 100)}%
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
  const [activeLeague, setActiveLeague] = useState<League | null>(null);

  useEffect(() => {
    if (!loading && user && !user.group_id && !user.is_admin) router.replace("/join");
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

    if (user.group_id) {
      api.currentLeague().then(setActiveLeague).catch(() => {});
    }

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
        setMarkets(prev =>
          prev.map(m =>
            m.market_id === event.market_id
              ? { ...m, status: "settled", settled_side: event.settled_side, settled_at: new Date().toISOString() }
              : m
          )
        );
      }
      if (event.type === "market_created") {
        api.market(event.market_id).then(m => {
          setMarkets(prev => [m, ...prev.filter(x => x.market_id !== m.market_id)]);
        }).catch(() => {});
      }
    });
    return disconnect;
  }, [user]);

  // Show landing page to logged-out visitors
  if (!loading && !user) return <LandingPage />;
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

        {/* Active league banner */}
        {activeLeague && (
          <Link href="/league" style={{ textDecoration: "none", display: "block", marginBottom: 20 }}>
            <div style={{
              padding: "10px 14px",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em" }}>● LEAGUE</span>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", margin: "2px 0 0" }}>
                  {activeLeague.name}
                </p>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>standings →</span>
            </div>
          </Link>
        )}

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
            {settled.length > 0 && (
              <>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: "24px 0 12px" }}>
                  SETTLED
                </p>
                {settled.map(m => <MarketCard key={m.market_id} market={m} position={positions.get(m.market_id)} />)}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
