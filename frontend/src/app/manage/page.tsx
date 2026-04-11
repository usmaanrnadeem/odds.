"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Market, ApiError, GroupMember } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default function ManagePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [b,        setB]        = useState(100);
  const [closesAt, setClosesAt] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState("");

  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [settleId,   setSettleId]   = useState<number | null>(null);
  const [settleSide, setSettleSide] = useState<boolean>(true);

  const [members,    setMembers]    = useState<GroupMember[]>([]);
  const [topupId,    setTopupId]    = useState<number | null>(null);
  const [topupAmt,   setTopupAmt]   = useState(100);

  const [joinToken,  setJoinToken]  = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);


  useEffect(() => {
    if (!loading && (!user || user.group_role !== "admin")) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.group_role !== "admin") return;
    api.markets().then(mkts => setMarkets(mkts.filter(m => m.status === "open")));
    api.groupMembers().then(setMembers);
    api.myGroup()
      .then(g => setJoinToken(g.join_token ?? null))
      .catch(err => setMsg(`invite link error: ${err instanceof ApiError ? err.message : String(err)}`));
  }, [user]);

  async function createMarket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      // Convert local datetime-local value to UTC ISO string, or null
      const closesAtUtc = closesAt ? new Date(closesAt).toISOString() : null;
      const m = await api.createMarket(title, desc || null, b, closesAtUtc);
      setMsg(`Created: "${m.title}"`);
      setTitle(""); setDesc(""); setClosesAt("");
      setMarkets(prev => [m, ...prev]);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
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
            <button type="submit" disabled={busy} style={primaryBtnStyle}>
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
              <button onClick={settle} disabled={busy || settleId === null} style={primaryBtnStyle}>
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
            <button onClick={topup} disabled={busy || topupId === null} style={primaryBtnStyle}>
              {busy ? "…" : `give ${topupAmt} pts`}
            </button>
          </div>
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
