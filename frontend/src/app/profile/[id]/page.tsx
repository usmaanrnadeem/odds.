"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, MarketPnL, LeaderboardEntry } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = parseInt(id);
  const { user, loading, logout } = useUser();
  const router = useRouter();

  const [pnls,          setPnls]          = useState<MarketPnL[]>([]);
  const [profile,       setProfile]       = useState<LeaderboardEntry | null>(null);
  const [fetching,      setFetching]      = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.marketPnl(userId),
      api.leaderboard(),
    ]).then(([p, board]) => {
      setPnls(p);
      setProfile(board.find(e => e.user_id === userId) ?? null);
    }).finally(() => setFetching(false));
  }, [user, userId]);

  if (loading || !user) return null;

  const tokenKey = (profile?.token_key ?? "rocket") as TokenKey;
  const isOwnProfile = user.user_id === userId;

  return (
    <>
      <Nav />

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

        {/* Logout — own profile only */}
        {isOwnProfile && (
          <div style={{ marginBottom: 32 }}>
            {!confirmLogout ? (
              <button
                onClick={() => setConfirmLogout(true)}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", padding: "8px 14px" }}
              >
                sign out
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>sure?</span>
                <button
                  onClick={handleLogout}
                  style={{ background: "var(--no)", border: "none", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 14px" }}
                >
                  yes, sign out
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", padding: "8px 14px" }}
                >
                  cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settled markets PnL */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 16px" }}>
          SETTLED MARKETS
        </p>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : pnls.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", margin: 0 }}>
              no settled markets yet
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {pnls.map(p => {
              const heldSide = p.yes_position > 0 ? "YES" : p.no_position > 0 ? "NO" : null;
              const won = heldSide === "YES" ? p.settled_side : heldSide === "NO" ? !p.settled_side : false;
              return (
                <div
                  key={p.market_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Side badge */}
                  {heldSide && (
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                      color: heldSide === "YES" ? "var(--accent)" : "var(--no)",
                      minWidth: 24,
                    }}>
                      {heldSide}
                    </span>
                  )}

                  {/* Market title */}
                  <span style={{ flex: 1, fontSize: 13, color: won ? "var(--text)" : "var(--muted)", lineHeight: 1.35 }}>
                    {p.market_title}
                  </span>

                  {/* Net PnL */}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                    color: p.net_pnl >= 0 ? "var(--accent)" : "var(--no)",
                    minWidth: 56, textAlign: "right",
                  }}>
                    {p.net_pnl >= 0 ? "+" : ""}{p.net_pnl.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
