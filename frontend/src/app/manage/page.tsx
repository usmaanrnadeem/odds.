"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Market, ApiError, GroupMember } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

// ── Settle row ────────────────────────────────────────────────

function SettleRow({ market, onSettled }: { market: Market; onSettled: (id: number) => void }) {
  const [confirming, setConfirming] = useState<boolean | null>(null); // null=idle, true=YES, false=NO
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function confirm(side: boolean) {
    setBusy(true); setErr("");
    try {
      await api.settleMarket(market.market_id, side);
      onSettled(market.market_id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed");
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
    }}>
      <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 10px", lineHeight: 1.4 }}>
        {market.title}
      </p>

      {confirming === null ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setConfirming(true)}
            style={{ ...outlineBtn, color: "var(--accent)", borderColor: "var(--accent)", flex: 1 }}
          >
            YES happened
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{ ...outlineBtn, color: "var(--no)", borderColor: "var(--no)", flex: 1 }}
          >
            NO happened
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
            Settle as <span style={{ color: confirming ? "var(--accent)" : "var(--no)", fontWeight: 700 }}>
              {confirming ? "YES" : "NO"}
            </span> — points paid out automatically. Sure?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => confirm(confirming)}
              disabled={busy}
              style={{ ...primaryBtn, flex: 1, opacity: busy ? 0.5 : 1 }}
            >
              {busy ? "…" : "confirm"}
            </button>
            <button
              onClick={() => setConfirming(null)}
              style={{ ...outlineBtn, color: "var(--muted)", flex: 1 }}
            >
              cancel
            </button>
          </div>
          {err && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no)", marginTop: 6 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function ManagePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [members,    setMembers]    = useState<GroupMember[]>([]);
  const [joinToken,  setJoinToken]  = useState<string | null>(null);
  const [pendingIdeasCount, setPendingIdeasCount] = useState(0);

  // Post a market
  const [title,     setTitle]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [b,         setB]         = useState(30);
  const [closesAt,  setClosesAt]  = useState("");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [showAdv,   setShowAdv]   = useState(false);
  const [postBusy,  setPostBusy]  = useState(false);
  const [postMsg,   setPostMsg]   = useState("");

  // Top up
  const [topupId,   setTopupId]   = useState<number | null>(null);
  const [topupAmt,  setTopupAmt]  = useState(100);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMsg,  setTopupMsg]  = useState("");

  // Invite
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.group_role !== "admin")) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.group_role !== "admin") return;
    api.markets().then(mkts => setMarkets(mkts.filter(m => m.status === "open")));
    api.groupMembers().then(setMembers);
    api.pendingIdeas().then(ideas => setPendingIdeasCount(ideas.length)).catch(() => {});
    api.myGroup().then(g => setJoinToken(g.join_token ?? null)).catch(() => {});
  }, [user]);

  async function postMarket(e: React.FormEvent) {
    e.preventDefault();
    setPostBusy(true); setPostMsg("");
    try {
      const closesAtUtc = closesAt ? new Date(closesAt).toISOString() : null;
      const m = await api.createMarket(title, desc || null, b, closesAtUtc, subjectId);
      setPostMsg(`"${m.title}" is now live`);
      setTitle(""); setDesc(""); setClosesAt(""); setSubjectId(null); setShowAdv(false);
      setMarkets(prev => [m, ...prev]);
    } catch (err) {
      setPostMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setPostBusy(false); }
  }

  async function topup() {
    if (!topupId) return;
    setTopupBusy(true); setTopupMsg("");
    try {
      const result = await api.topupUser(topupId, topupAmt);
      setTopupMsg(`+${topupAmt} pts given to ${result.username}`);
      api.groupMembers().then(setMembers);
      setTopupId(null);
    } catch (err) {
      setTopupMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setTopupBusy(false); }
  }

  if (loading || user?.group_role !== "admin") return null;

  const openMarkets = markets;

  return (
    <>
      <Nav />
      <main className="page-content">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 2px" }}>
            ADMIN
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {user.group_name}
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
          {[
            { label: "open markets", value: openMarkets.length },
            { label: "members",      value: members.length },
            { label: "ideas to review", value: pendingIdeasCount, accent: pendingIdeasCount > 0 },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, margin: 0, color: s.accent ? "var(--accent)" : "var(--text)" }}>
                {s.value}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "2px 0 0", letterSpacing: "0.06em" }}>
                {s.label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>

        {/* Pending ideas alert */}
        {pendingIdeasCount > 0 && (
          <a
            href="/ideas"
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", marginBottom: 28,
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              textDecoration: "none",
            }}
          >
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em", margin: "0 0 2px" }}>
                ACTION NEEDED
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", margin: 0 }}>
                {pendingIdeasCount} market {pendingIdeasCount === 1 ? "idea" : "ideas"} waiting for review
              </p>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>review →</span>
          </a>
        )}

        {/* Post a market */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", fontWeight: 700, margin: "0 0 3px", letterSpacing: "0.06em" }}>
              POST A MARKET
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Create a yes/no question. Your group bets on it — you settle it once the outcome is known.
            </p>
          </div>

          <form onSubmit={postMarket} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="e.g. Will Tom be late to Saturday's match?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              style={inputStyle}
            />
            <textarea
              placeholder="Extra context (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
            />

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdv(x => !x)}
              style={{ background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", cursor: "pointer", padding: "2px 0", textAlign: "left" }}
            >
              {showAdv ? "▲ fewer options" : "▼ more options"}
            </button>

            {showAdv && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>Trading closes at (optional)</label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={e => setClosesAt(e.target.value)}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={labelStyle}>About a group member (optional)</label>
                  <select
                    value={subjectId ?? ""}
                    onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : null)}
                    style={{ ...inputStyle, appearance: "none" }}
                  >
                    <option value="">no specific person</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ ...labelStyle, whiteSpace: "nowrap" }}>Liquidity (default 30)</label>
                  <input
                    type="number"
                    value={b}
                    onChange={e => setB(Number(e.target.value))}
                    min={10} max={10000}
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
              </div>
            )}

            {postMsg && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", margin: 0 }}>{postMsg}</p>
            )}
            <button
              type="submit"
              disabled={postBusy || !title.trim()}
              style={{ ...primaryBtn, opacity: postBusy || !title.trim() ? 0.4 : 1, cursor: postBusy || !title.trim() ? "not-allowed" : "pointer" }}
            >
              {postBusy ? "…" : "post market"}
            </button>
          </form>
        </section>

        {/* Settle markets */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", fontWeight: 700, margin: "0 0 3px", letterSpacing: "0.06em" }}>
              SETTLE A MARKET
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Once you know the outcome, settle it here. Points are paid out automatically.
            </p>
          </div>

          {openMarkets.length === 0 ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>no open markets</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openMarkets.map(m => (
                <SettleRow
                  key={m.market_id}
                  market={m}
                  onSettled={id => setMarkets(prev => prev.filter(x => x.market_id !== id))}
                />
              ))}
            </div>
          )}
        </section>

        {/* Invite link */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", fontWeight: 700, margin: "0 0 3px", letterSpacing: "0.06em" }}>
              INVITE PEOPLE
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Share this link to add people to your group.
            </p>
          </div>
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
                    navigator.clipboard.writeText(`${window.location.origin}/join?token=${joinToken}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ ...primaryBtn, flex: 1 }}
                >
                  {copied ? "copied ✓" : "copy link"}
                </button>
                <button
                  onClick={async () => { const r = await api.regenerateJoinToken(); setJoinToken(r.join_token); }}
                  style={{ padding: "10px 14px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer" }}
                >
                  regenerate
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Top up points */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", fontWeight: 700, margin: "0 0 3px", letterSpacing: "0.06em" }}>
              GIVE POINTS
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Top up a player's balance — useful if someone joins late or runs out.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              value={topupId ?? ""}
              onChange={e => setTopupId(e.target.value ? parseInt(e.target.value) : null)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="">select player…</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username} — {m.points.toFixed(0)} pts
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
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
            {topupMsg && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", margin: 0 }}>{topupMsg}</p>}
            <button
              onClick={topup}
              disabled={topupBusy || !topupId}
              style={{ ...primaryBtn, opacity: topupBusy || !topupId ? 0.4 : 1, cursor: topupBusy || !topupId ? "not-allowed" : "pointer" }}
            >
              {topupBusy ? "…" : `give ${topupAmt} pts`}
            </button>
          </div>
        </section>

      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px",
  background: "var(--accent)", border: "none", color: "#000",
  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
};

const outlineBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent", border: "1px solid var(--border)",
  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
  cursor: "pointer",
};
