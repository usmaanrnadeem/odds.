"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, Trophy, LeaderboardEntry } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

// ── Rarity config ─────────────────────────────────────────────────────────

const RARITY = {
  legendary: { color: "#D4FF00", label: "LEGENDARY", glow: "0 0 24px #D4FF0055" },
  rare:      { color: "#A855F7", label: "RARE",      glow: "0 0 16px #A855F755" },
  common:    { color: "#555555", label: "COMMON",    glow: "none" },
} as const;

const RANK_LABEL: Record<number, string> = { 1: "1ST", 2: "2ND", 3: "3RD" };

// ── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data, width = 280, height = 48, color = "var(--accent)" }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Trophy popup (the full NFT card) ──────────────────────────────────────

function TrophyModal({ trophy, tokenKey, onClose }: {
  trophy: Trophy;
  tokenKey: TokenKey;
  onClose: () => void;
}) {
  const r = RARITY[trophy.rarity as keyof typeof RARITY] ?? RARITY.common;
  const isLegendary = trophy.rarity === "legendary";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 320,
          background: "#0d0d0d",
          border: `1px solid ${r.color}`,
          boxShadow: r.glow,
          padding: 0,
          overflow: "hidden",
          animation: "trophy-in 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          position: "relative",
        }}
      >
        <style>{`
          @keyframes trophy-in {
            from { transform: scale(0.85) translateY(12px); opacity: 0; }
            to   { transform: scale(1)    translateY(0);    opacity: 1; }
          }
          @keyframes shimmer {
            0%   { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
        `}</style>

        {/* Shimmer overlay for legendary */}
        {isLegendary && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
            backgroundImage: "linear-gradient(105deg, transparent 30%, rgba(212,255,0,0.06) 50%, transparent 70%)",
            backgroundSize: "400px 100%",
            animation: "shimmer 2.4s linear infinite",
          }} />
        )}

        {/* Top band — rarity + rank */}
        <div style={{
          background: `${r.color}18`,
          borderBottom: `1px solid ${r.color}44`,
          padding: "10px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: r.color, letterSpacing: "0.15em" }}>
            {r.label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: r.color, letterSpacing: "0.1em" }}>
            {RANK_LABEL[trophy.rank] ?? `#${trophy.rank}`} PLACE
          </span>
        </div>

        {/* Token hero */}
        <div style={{
          padding: "28px 0 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
          background: isLegendary ? `radial-gradient(ellipse at 50% 60%, ${r.color}12, transparent 70%)` : "transparent",
        }}>
          <div style={{
            padding: 10,
            border: `2px solid ${r.color}`,
            boxShadow: r.glow,
            display: "inline-block",
          }}>
            <Token tokenKey={tokenKey} size={88} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "0 20px 4px" }}>
          {/* Profit */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, margin: 0,
              color: trophy.profit >= 0 ? r.color : "var(--no)",
            }}>
              {trophy.profit >= 0 ? "+" : ""}{trophy.profit.toFixed(1)}
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "2px 0 0", letterSpacing: "0.1em" }}>
              PTS PROFIT
            </p>
          </div>

          {/* Title */}
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 12, color: r.color,
            textAlign: "center", margin: "0 0 14px", letterSpacing: "0.08em",
          }}>
            {trophy.title}
          </p>

          {/* Market name */}
          <p style={{
            fontSize: 13, color: "var(--text)", textAlign: "center",
            margin: "0 0 20px", lineHeight: 1.4,
          }}>
            {trophy.market_title}
          </p>

          {/* Sparkline */}
          {trophy.price_arc.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <Sparkline data={trophy.price_arc} width={280} height={52} color={r.color} />
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", textAlign: "right", marginTop: 4, letterSpacing: "0.08em" }}>
                PRICE HISTORY
              </p>
            </div>
          )}

          {/* Date */}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textAlign: "center", marginBottom: 20 }}>
            {new Date(trophy.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Bottom — dismiss */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px",
            background: "transparent",
            border: "none",
            borderTop: `1px solid ${r.color}33`,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)", fontSize: 11,
            cursor: "pointer", letterSpacing: "0.08em",
          }}
        >
          close
        </button>
      </div>
    </div>
  );
}

// ── Trophy card (grid tile) ───────────────────────────────────────────────

function TrophyCard({ trophy, tokenKey, onClick }: {
  trophy: Trophy;
  tokenKey: TokenKey;
  onClick: () => void;
}) {
  const r = RARITY[trophy.rarity as keyof typeof RARITY] ?? RARITY.common;

  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        background: "var(--surface)",
        border: `1px solid ${r.color}`,
        boxShadow: trophy.rarity === "legendary" ? `0 0 12px ${r.color}33` : "none",
        padding: "14px 12px",
        gap: 8,
        textAlign: "center",
        alignItems: "center",
        transition: "transform 0.15s, box-shadow 0.15s",
        width: "100%",
        minHeight: 152,
        justifyContent: "space-between",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${r.color}44`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = trophy.rarity === "legendary" ? `0 0 12px ${r.color}33` : "none";
      }}
    >
      {/* Rarity + rank */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: r.color, letterSpacing: "0.12em" }}>
        {r.label} · {RANK_LABEL[trophy.rank] ?? `#${trophy.rank}`}
      </span>

      {/* Token */}
      <Token tokenKey={tokenKey} size={44} />

      {/* Profit */}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
        color: trophy.profit >= 0 ? r.color : "var(--no)",
      }}>
        {trophy.profit >= 0 ? "+" : ""}{trophy.profit.toFixed(0)}
      </span>

      {/* Market name — truncated */}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        width: "100%", textAlign: "center",
      }}>
        {trophy.market_title}
      </span>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = parseInt(id);
  const { user, loading } = useUser();
  const router = useRouter();

  const [trophies,  setTrophies]  = useState<Trophy[]>([]);
  const [profile,   setProfile]   = useState<LeaderboardEntry | null>(null);
  const [fetching,  setFetching]  = useState(true);
  const [selected,  setSelected]  = useState<Trophy | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.trophies(userId),
      api.leaderboard(),
    ]).then(([t, board]) => {
      setTrophies(t);
      setProfile(board.find(e => e.user_id === userId) ?? null);
    }).finally(() => setFetching(false));
  }, [user, userId]);

  if (loading || !user) return null;

  const tokenKey = (profile?.token_key ?? "rocket") as TokenKey;
  const isOwnProfile = user.user_id === userId;

  return (
    <>
      <Nav />

      {/* Trophy popup */}
      {selected && (
        <TrophyModal
          trophy={selected}
          tokenKey={tokenKey}
          onClose={() => setSelected(null)}
        />
      )}

      <main className="page-content">
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0 }}
        >
          ←
        </button>

        {/* Profile header */}
        {profile && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
            <Token tokenKey={tokenKey} size={60} />
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                {profile.username}
                {isOwnProfile && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginLeft: 8, fontWeight: 400 }}>you</span>
                )}
              </h1>
              <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>
                  {profile.points.toFixed(0)} <span style={{ color: "var(--muted)" }}>pts</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                  rank #{profile.rank}
                </span>
                {profile.markets_participated > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                    {Math.round(profile.accuracy * 100)}% win rate
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trophies section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: 0 }}>
            TROPHY CABINET
          </p>
          {!fetching && trophies.length > 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
              {trophies.length} earned · tap to inspect
            </p>
          )}
        </div>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : trophies.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", margin: 0 }}>
              {isOwnProfile ? "no trophies yet — finish in the top 3 of a market" : "no trophies yet"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {trophies.map(t => (
              <TrophyCard
                key={t.trophy_id}
                trophy={t}
                tokenKey={tokenKey}
                onClick={() => setSelected(t)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
