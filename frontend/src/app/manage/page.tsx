"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Market, ApiError, GroupMember, League } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default function ManagePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [title,     setTitle]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [b,         setB]         = useState(30);
  const [closesAt,  setClosesAt]  = useState("");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [leagueId,  setLeagueId]  = useState<number | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState("");

  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [settleId,   setSettleId]   = useState<number | null>(null);
  const [settleSide, setSettleSide] = useState<boolean>(true);

  const [members,    setMembers]    = useState<GroupMember[]>([]);
  const [topupId,    setTopupId]    = useState<number | null>(null);
  const [topupAmt,   setTopupAmt]   = useState(100);

  const [joinToken,  setJoinToken]  = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);

  // League creation
  const [leagues,          setLeagues]          = useState<League[]>([]);
  const [leagueName,       setLeagueName]       = useState("");
  const [leagueStarts,     setLeagueStarts]     = useState("");
  const [leagueEnds,       setLeagueEnds]       = useState("");
  const [leagueStartPts,   setLeagueStartPts]   = useState(1000);
  const [leagueFreq,       setLeagueFreq]       = useState<"weekly" | "biweekly" | "custom" | "">("");
  const [leagueDay,        setLeagueDay]        = useState<number | null>(null);
  const [leagueTime,       setLeagueTime]       = useState("");
  const [leagueBusy,       setLeagueBusy]       = useState(false);
  const [leagueMsg,        setLeagueMsg]        = useState("");
  const [pendingIdeasCount, setPendingIdeasCount] = useState(0);

  useEffect(() => {
    if (!loading && (!user || user.group_role !== "admin")) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.group_role !== "admin") return;
    api.markets().then(mkts => setMarkets(mkts.filter(m => m.status === "open")));
    api.groupMembers().then(setMembers);
    api.leagues().then(setLeagues);
    api.pendingIdeas().then(ideas => setPendingIdeasCount(ideas.length)).catch(() => {});
    api.myGroup()
      .then(g => setJoinToken(g.join_token ?? null))
      .catch(err => setMsg(`invite link error: ${err instanceof ApiError ? err.message : String(err)}`));
  }, [user]);

  async function createMarket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const closesAtUtc = closesAt ? new Date(closesAt).toISOString() : null;
      const m = await api.createMarket(title, desc || null, b, closesAtUtc, subjectId, leagueId);
      setMsg(`Created: "${m.title}"`);
      setTitle(""); setDesc(""); setClosesAt(""); setSubjectId(null); setLeagueId(null);
      setMarkets(prev => [m, ...prev]);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    setLeagueBusy(true); setLeagueMsg("");
    try {
      const lg = await api.createLeague({
        name: leagueName,
        starts_at: new Date(leagueStarts).toISOString(),
        ends_at: new Date(leagueEnds).toISOString(),
        starting_points: leagueStartPts,
        schedule_frequency: leagueFreq || null,
        schedule_day: leagueDay,
        schedule_time: leagueTime || null,
      });
      setLeagueMsg(`League "${lg.name}" created ✓`);
      setLeagueName(""); setLeagueStarts(""); setLeagueEnds(""); setLeagueFreq(""); setLeagueDay(null); setLeagueTime("");
      setLeagues(prev => [lg, ...prev]);
    } catch (err) {
      setLeagueMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setLeagueBusy(false); }
  }

  async function endLeague(lgId: number) {
    if (!confirm("End this league? This cannot be undone.")) return;
    try {
      await api.endLeague(lgId);
      setLeagues(prev => prev.map(l => l.league_id === lgId ? { ...l, status: "ended" as const } : l));
    } catch (err) {
      setLeagueMsg(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function settle() {
    if (settleId === null) return;
    setBusy(true);
    setMsg("");
    try {
      const result = await api.settleMarket(settleId, settleSide);
      setMsg(`Settled! Winner: ${result.podium[0]?.username ?? "none"}`);
      setMarkets(prev => prev.filter(m => m.market_id !== settleId));
      setSettleId(null);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function topup() {
    if (topupId === null) return;
    setBusy(true);
    setMsg("");
    try {
      const result = await api.topupUser(topupId, topupAmt);
      setMsg(`Added ${topupAmt} pts to ${result.username} (now ${result.new_balance.toFixed(0)} pts)`);
      api.groupMembers().then(setMembers);
      setTopupId(null);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }


  if (loading || user?.group_role !== "admin") return null;

  return (
    <>
      <Nav />
      <main className="page-content">
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: 0 }}>
            MANAGE
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", margin: "4px 0 0" }}>
            {user.group_name}
          </p>
        </div>

        {msg && (
          <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 20 }}>
            {msg}
          </div>
        )}

        {/* Invite link */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>INVITE LINK</p>
          {joinToken && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{
                padding: "10px 12px",
                background: "var(--surface)", border: "1px solid var(--border)",
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)",
                wordBreak: "break-all", lineHeight: 1.6,
              }}>
                {typeof window !== "undefined" ? `${window.location.origin}/join?token=${joinToken}` : `…/join?token=${joinToken}`}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/join?token=${joinToken}`;
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ ...primaryBtnStyle, flex: 1 }}
                >
                  {copied ? "copied ✓" : "copy link"}
                </button>
                <button
                  onClick={async () => {
                    const r = await api.regenerateJoinToken();
                    setJoinToken(r.join_token);
                  }}
                  style={{ padding: "10px 14px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer" }}
                >
                  regenerate
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Create market */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>CREATE MARKET</p>
          <form onSubmit={createMarket} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="Market question"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={inputStyle}
            />
            <textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>liquidity b:</label>
              <input
                type="number"
                value={b}
                onChange={e => setB(Number(e.target.value))}
                min={10} max={10000}
                style={{ ...inputStyle, width: 80 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>close time (optional):</label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={e => setClosesAt(e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>about a player (optional):</label>
              <select
                value={subjectId ?? ""}
                onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                <option value="">no specific player</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.username}</option>
                ))}
              </select>
            </div>
            {leagues.filter(l => l.status === "active").length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>add to league (optional):</label>
                <select
                  value={leagueId ?? ""}
                  onChange={e => setLeagueId(e.target.value ? parseInt(e.target.value) : null)}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">no league</option>
                  {leagues.filter(l => l.status === "active").map(l => (
                    <option key={l.league_id} value={l.league_id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" disabled={busy} style={{ ...primaryBtnStyle, opacity: busy ? 0.4 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "…" : "create market"}
            </button>
          </form>
        </section>

        {/* Settle market */}
        <section>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>SETTLE MARKET</p>
          {markets.length === 0 ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>no open markets</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={settleId ?? ""}
                onChange={e => setSettleId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                <option value="">select market…</option>
                {markets.map(m => (
                  <option key={m.market_id} value={m.market_id}>{m.title}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setSettleSide(true)}
                  style={{ ...sideBtn, background: settleSide ? "var(--accent)" : "transparent", color: settleSide ? "#000" : "var(--accent)", border: `1px solid ${settleSide ? "var(--accent)" : "var(--border)"}` }}
                >
                  YES wins
                </button>
                <button
                  onClick={() => setSettleSide(false)}
                  style={{ ...sideBtn, background: !settleSide ? "var(--no)" : "transparent", color: !settleSide ? "#fff" : "var(--no)", border: `1px solid ${!settleSide ? "var(--no)" : "var(--border)"}` }}
                >
                  NO wins
                </button>
              </div>
              <button onClick={settle} disabled={busy || settleId === null} style={{ ...primaryBtnStyle, opacity: (busy || settleId === null) ? 0.4 : 1, cursor: (busy || settleId === null) ? "not-allowed" : "pointer" }}>
                {busy ? "…" : "settle"}
              </button>
            </div>
          )}
        </section>

        {/* Top up points */}
        <section style={{ marginTop: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>TOP UP POINTS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              value={topupId ?? ""}
              onChange={e => setTopupId(e.target.value ? parseInt(e.target.value) : null)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="">select player…</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username} ({m.points.toFixed(0)} pts)
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              {[50, 100, 250, 500].map(amt => (
                <button
                  key={amt}
                  onClick={() => setTopupAmt(amt)}
                  style={{
                    flex: 1, padding: "10px 4px",
                    background: topupAmt === amt ? "var(--surface)" : "transparent",
                    border: `1px solid ${topupAmt === amt ? "var(--text)" : "var(--border)"}`,
                    color: topupAmt === amt ? "var(--text)" : "var(--muted)",
                    fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer",
                  }}
                >
                  +{amt}
                </button>
              ))}
            </div>
            <button onClick={topup} disabled={busy || topupId === null} style={{ ...primaryBtnStyle, opacity: (busy || topupId === null) ? 0.4 : 1, cursor: (busy || topupId === null) ? "not-allowed" : "pointer" }}>
              {busy ? "…" : `give ${topupAmt} pts`}
            </button>
          </div>
        </section>

        {/* Ideas shortcut */}
        <section style={{ marginTop: 32, padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 4px" }}>
                MARKET IDEAS
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", margin: 0 }}>
                {pendingIdeasCount > 0 ? `${pendingIdeasCount} pending review` : "no pending ideas"}
              </p>
            </div>
            <a
              href="/ideas"
              style={{
                padding: "8px 16px", background: pendingIdeasCount > 0 ? "var(--accent)" : "transparent",
                border: `1px solid ${pendingIdeasCount > 0 ? "var(--accent)" : "var(--border)"}`,
                color: pendingIdeasCount > 0 ? "#000" : "var(--muted)",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", textDecoration: "none",
              }}
            >
              review →
            </a>
          </div>
        </section>

        {/* League creation */}
        <section style={{ marginTop: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>LEAGUES</p>

          {/* Existing leagues */}
          {leagues.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {leagues.map(lg => (
                <div key={lg.league_id} style={{
                  padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)",
                  marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{lg.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: lg.status === "active" ? "var(--accent)" : "var(--muted)", marginLeft: 10 }}>
                      {lg.status === "active" ? "● ACTIVE" : "ENDED"}
                    </span>
                  </div>
                  {lg.status === "active" && (
                    <button
                      onClick={() => endLeague(lg.league_id)}
                      style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer", padding: "4px 10px" }}
                    >
                      end
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {leagueMsg && (
            <div style={{ padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 12 }}>
              {leagueMsg}
            </div>
          )}

          <form onSubmit={createLeague} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="League name (e.g. Spring 2026)" value={leagueName} onChange={e => setLeagueName(e.target.value)} required minLength={2} maxLength={100} style={inputStyle} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>start</label>
                <input type="datetime-local" value={leagueStarts} onChange={e => setLeagueStarts(e.target.value)} required style={{ ...inputStyle, colorScheme: "dark", marginTop: 4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>end</label>
                <input type="datetime-local" value={leagueEnds} onChange={e => setLeagueEnds(e.target.value)} required style={{ ...inputStyle, colorScheme: "dark", marginTop: 4 }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>starting pts:</label>
              <input type="number" value={leagueStartPts} onChange={e => setLeagueStartPts(Number(e.target.value))} min={100} max={100000} style={{ ...inputStyle, width: 100 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={leagueFreq} onChange={e => setLeagueFreq(e.target.value as typeof leagueFreq)} style={{ ...inputStyle, flex: 1, appearance: "none" }}>
                <option value="">no fixed schedule</option>
                <option value="weekly">weekly</option>
                <option value="biweekly">biweekly</option>
                <option value="custom">custom</option>
              </select>
              {leagueFreq && (
                <select value={leagueDay ?? ""} onChange={e => setLeagueDay(e.target.value !== "" ? parseInt(e.target.value) : null)} style={{ ...inputStyle, flex: 1, appearance: "none" }}>
                  <option value="">any day</option>
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              )}
              {leagueFreq && (
                <input type="time" value={leagueTime} onChange={e => setLeagueTime(e.target.value)} placeholder="time" style={{ ...inputStyle, flex: 1 }} />
              )}
            </div>
            <button type="submit" disabled={leagueBusy} style={{ ...primaryBtnStyle, opacity: leagueBusy ? 0.4 : 1, cursor: leagueBusy ? "not-allowed" : "pointer" }}>
              {leagueBusy ? "…" : "create league"}
            </button>
          </form>
        </section>

      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px",
  background: "var(--accent)",
  border: "none",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const sideBtn: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
