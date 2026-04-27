"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, League, LeagueLeaderboardEntry } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LeagueBadge({ league }: { league: League }) {
  const now    = Date.now();
  const starts = new Date(league.starts_at).getTime();
  const ends   = new Date(league.ends_at).getTime();
  const live   = now >= starts && now <= ends;
  const pct    = live ? Math.min(100, Math.round(((now - starts) / (ends - starts)) * 100)) : 0;

  return (
    <div style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
            {league.name}
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
            {fmtDate(league.starts_at)} → {fmtDate(league.ends_at)}
          </p>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: live ? "var(--accent)" : "var(--muted)" }}>
          {live ? "● LIVE" : league.status === "ended" ? "ENDED" : "UPCOMING"}
        </span>
      </div>

      {live && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "4px 0 0" }}>
            {pct}% through season
          </p>
        </div>
      )}

      {league.schedule_frequency && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
          markets drop {league.schedule_frequency}
          {league.schedule_day != null ? ` · ${DAY_NAMES[league.schedule_day]}` : ""}
          {league.schedule_time ? ` at ${league.schedule_time}` : ""}
        </p>
      )}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>
        {league.starting_points.toFixed(0)} pts starting balance
      </p>
    </div>
  );
}

function LeagueLeaderboard({ leagueId }: { leagueId: number }) {
  const [entries, setEntries] = useState<LeagueLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leagueLeaderboard(leagueId)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (loading) return <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>loading…</p>;
  if (entries.length === 0) return <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>no trades yet</p>;

  return (
    <div>
      {entries.map((e, i) => {
        const isFirst = i === 0;
        return (
          <div
            key={e.user_id}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
              color: isFirst ? "var(--accent)" : "var(--muted)",
              minWidth: 20, textAlign: "center",
            }}>
              {e.rank}
            </span>
            <Token tokenKey={e.token_key as TokenKey} size={24} />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", margin: 0 }}>
                {e.username}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "2px 0 0" }}>
                {e.markets_participated}M · {e.markets_won}W
              </p>
            </div>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
              color: e.league_pnl >= 0 ? "var(--accent)" : "var(--no)",
            }}>
              {e.league_pnl >= 0 ? "+" : ""}{e.league_pnl.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function LeaguePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [leagues,  setLeagues]  = useState<League[]>([]);
  const [selected, setSelected] = useState<League | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id) router.replace("/join");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.group_id) return;
    api.leagues()
      .then(ls => {
        setLeagues(ls);
        // Auto-select the active league, or the most recent
        const live = ls.find(l => {
          const now = Date.now();
          return l.status === "active" && new Date(l.starts_at).getTime() <= now && new Date(l.ends_at).getTime() >= now;
        });
        setSelected(live ?? ls[0] ?? null);
      })
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <main className="page-content">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 24 }}>
          LEAGUE
        </p>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>loading…</p>
        ) : leagues.length === 0 ? (
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
              no leagues yet
            </p>
            {user.group_role === "admin" && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                set up a league from the{" "}
                <a href="/manage" style={{ color: "var(--accent)", textDecoration: "none" }}>manage</a>
                {" "}page.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* League picker */}
            {leagues.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {leagues.map(l => (
                  <button
                    key={l.league_id}
                    onClick={() => setSelected(l)}
                    style={{
                      padding: "6px 12px",
                      background: selected?.league_id === l.league_id ? "var(--surface)" : "transparent",
                      border: `1px solid ${selected?.league_id === l.league_id ? "var(--accent)" : "var(--border)"}`,
                      color: selected?.league_id === l.league_id ? "var(--text)" : "var(--muted)",
                      fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <>
                <LeagueBadge league={selected} />
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                  STANDINGS
                </p>
                <LeagueLeaderboard leagueId={selected.league_id} />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
