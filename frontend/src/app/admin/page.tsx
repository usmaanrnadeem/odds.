"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Market, ApiError } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [title,  setTitle]  = useState("");
  const [desc,   setDesc]   = useState("");
  const [b,      setB]      = useState(100);
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState("");

  const [markets,     setMarkets]     = useState<Market[]>([]);
  const [invite,      setInvite]      = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [settleId,    setSettleId]    = useState<number | null>(null);
  const [settleSide,  setSettleSide]  = useState<boolean>(true);

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.is_admin) return;
    api.markets().then(setMarkets);
  }, [user]);

  async function createMarket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const m = await api.createMarket(title, desc || null, b);
      setMsg(`Created: "${m.title}" (id=${m.market_id})`);
      setTitle(""); setDesc("");
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
      setMsg(`Settled! Rarity: ${result.rarity}. Winner: ${result.podium[0]?.username ?? "none"}`);
      const updated = await api.markets();
      setMarkets(updated);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function genInvite() {
    setBusy(true);
    try {
      const r = await api.createInvite();
      setInvite(r.token);
      setInviteExpiry(new Date(r.expires_at).toLocaleString());
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user?.is_admin) return null;

  const openMarkets = markets.filter(m => m.status === "open");

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 24 }}>
          ADMIN
        </p>

        {msg && (
          <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 20 }}>
            {msg}
          </div>
        )}

        {/* Create market */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>CREATE MARKET</p>
          <form onSubmit={createMarket} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="Market title"
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
            <button type="submit" disabled={busy} style={primaryBtnStyle}>
              {busy ? "…" : "create market"}
            </button>
          </form>
        </section>

        {/* Settle market */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>SETTLE MARKET</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              value={settleId ?? ""}
              onChange={e => setSettleId(e.target.value ? parseInt(e.target.value) : null)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="">select market…</option>
              {openMarkets.map(m => (
                <option key={m.market_id} value={m.market_id}>{m.title}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSettleSide(true)} style={{ ...sideBtn, background: settleSide ? "var(--accent)" : "transparent", color: settleSide ? "#000" : "var(--accent)", border: `1px solid ${settleSide ? "var(--accent)" : "var(--border)"}` }}>
                YES wins
              </button>
              <button onClick={() => setSettleSide(false)} style={{ ...sideBtn, background: !settleSide ? "var(--no)" : "transparent", color: !settleSide ? "#fff" : "var(--no)", border: `1px solid ${!settleSide ? "var(--no)" : "var(--border)"}` }}>
                NO wins
              </button>
            </div>
            <button onClick={settle} disabled={busy || settleId === null} style={primaryBtnStyle}>
              {busy ? "…" : "settle"}
            </button>
          </div>
        </section>

        {/* Invite */}
        <section>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>INVITE TOKEN</p>
          <button onClick={genInvite} disabled={busy} style={primaryBtnStyle}>generate invite (24h)</button>
          {invite && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>expires {inviteExpiry}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", wordBreak: "break-all", userSelect: "all" }}>{invite}</p>
            </div>
          )}
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
