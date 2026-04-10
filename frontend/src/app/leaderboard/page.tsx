"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, LeaderboardEntry, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

export default function LeaderboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.leaderboard().then(setEntries).finally(() => setFetching(false));

    const disconnect = connectWS((event: WSEvent) => {
      if (event.type === "balance_update") {
        setEntries(prev => {
          const updated = prev.map(e =>
            e.user_id === event.user_id ? { ...e, points: event.new_balance } : e
          );
          // Re-sort and re-rank
          return updated
            .sort((a, b) => b.points - a.points)
            .map((e, i) => ({ ...e, rank: i + 1 }));
        });
      }
      if (event.type === "settlement") {
        // Settlement changes wins/accuracy — re-fetch to get accurate stats
        api.leaderboard().then(setEntries);
      }
    });
    return disconnect;
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <main className="page-content">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 20 }}>
          LEADERBOARD
        </p>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : (
          <div>
            {entries.map(e => (
              <Link key={e.user_id} href={`/profile/${e.user_id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  {/* Rank */}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 700,
                      width: 24,
                      color: e.rank === 1 ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {e.rank}
                  </span>

                  <Token tokenKey={e.token_key as TokenKey} size={32} />

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--text)", fontWeight: e.rank === 1 ? 600 : 400 }}>
                      {e.username}
                    </p>
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                      {e.markets_won}W / {e.markets_participated}P
                      {e.markets_participated > 0 && ` · ${Math.round(e.accuracy * 100)}%`}
                    </p>
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      fontWeight: 700,
                      color: e.rank === 1 ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {e.points.toFixed(0)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
