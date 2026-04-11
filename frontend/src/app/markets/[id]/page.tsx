"use client";
import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { api, Market, FeedEntry, WSEvent, connectWS, ApiError, ChatMessage } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import ChatPanel from "@/components/ChatPanel";
import { TokenKey } from "@/lib/tokens";

// ── Title with subject name highlighted ──────────────────────
function MarketTitle({ title, username, tokenKey }: { title: string; username: string | null; tokenKey: string | null }) {
  if (!username || !tokenKey) return <span>{title}</span>;
  const idx = title.toLowerCase().indexOf(username.toLowerCase());
  if (idx === -1) return <span>{title}</span>;
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

// ── LMSR cost preview ─────────────────────────────────────────
// Exact cost formula so the preview matches the backend exactly.
function logSumExp(a: number, b: number): number {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}
function lmsrCost(b: number, qYes: number, qNo: number, qty: number, buyYes: boolean): number {
  const nY = buyYes ? qYes + qty : qYes;
  const nN = buyYes ? qNo : qNo + qty;
  return b * (logSumExp(nY / b, nN / b) - logSumExp(qYes / b, qNo / b));
}
function lmsrSellReturn(b: number, qYes: number, qNo: number, qty: number, sellYes: boolean): number {
  // Selling is buying the other direction then negating — or just cost of removing shares
  const nY = sellYes ? qYes - qty : qYes;
  const nN = sellYes ? qNo : qNo - qty;
  return b * (logSumExp(qYes / b, qNo / b) - logSumExp(nY / b, nN / b));
}

// ── Animated probability display ──────────────────────────────
function ProbDisplay({ prob, side, flash }: { prob: number; side: "yes" | "no"; flash: boolean }) {
  const pct = Math.round(prob * 100);
  const color = side === "yes" ? "var(--accent)" : "var(--no)";
  return (
    <div style={{ textAlign: side === "yes" ? "left" : "right", flex: 1 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 52,
          fontWeight: 900,
          color,
          lineHeight: 1,
          transition: "color 0.2s",
          animation: flash ? "prob-flash 0.4s ease-out" : undefined,
          display: "inline-block",
        }}
      >
        {pct}%
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
        {side.toUpperCase()}
      </div>
    </div>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = parseInt(id);
  const { user, loading, updatePoints } = useUser();
  const router = useRouter();

  const [market,   setMarket]   = useState<Market | null>(null);
  const [feed,     setFeed]     = useState<FeedEntry[]>([]);
  const [position, setPosition] = useState<{ yes: number; no: number } | null>(null);
  const [qtyStr,   setQtyStr]   = useState("1");
  const [side,     setSide]     = useState<boolean>(true);
  const [busy,     setBusy]     = useState(false);
  const [tab,      setTab]      = useState<"buy" | "sell">("buy");
  const [flash,    setFlash]    = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [chat,     setChat]     = useState<ChatMessage[]>([]);
  const [section,  setSection]  = useState<"activity" | "chat">("activity");
  const [probFlash, setProbFlash] = useState(false);
  const prevProbRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.market(marketId).then(m => { setMarket(m); prevProbRef.current = m.yes_prob; });
    api.activity(marketId).then(setFeed);
    api.position(marketId).then(setPosition).catch(() => {});
    api.marketChat(marketId).then(setChat).catch(() => {});

    const disconnect = connectWS((event: WSEvent) => {
      if (event.type === "chat" && event.scope === "market" && event.scope_id === marketId) {
        setChat(prev => {
          if (prev.some(m => m.message_id === event.message_id)) return prev;
          return [...prev, {
            message_id: event.message_id, user_id: event.user_id,
            username: event.username, token_key: event.token_key,
            content: event.content, created_at: event.created_at,
          }];
        });
      }
      if (event.type === "trade" && event.market_id === marketId) {
        setMarket(prev => {
          if (!prev) return prev;
          // Trigger flash if prob changed
          if (prevProbRef.current !== null && prevProbRef.current !== event.yes_prob) {
            setProbFlash(true);
            setTimeout(() => setProbFlash(false), 400);
          }
          prevProbRef.current = event.yes_prob;
          return { ...prev, yes_prob: event.yes_prob, no_prob: event.no_prob, yes_odds: event.yes_odds, no_odds: event.no_odds };
        });
        setFeed(prev => {
          if (prev.some(e => e.trade_id === event.feed_entry.trade_id)) return prev;
          return [event.feed_entry, ...prev].slice(0, 50);
        });
      }
    });
    return disconnect;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, marketId]);

  const qty = Math.max(1, parseInt(qtyStr) || 1);

  async function trade() {
    if (!market || !user) return;
    setBusy(true);
    setError(null);
    try {
      const fn = tab === "buy" ? api.buy : api.sell;
      const result = await fn(marketId, side, qty);
      setFlash(tab === "buy"
        ? `Bought ${qty} ${side ? "YES" : "NO"} for ${result.cost.toFixed(1)} pts`
        : `Sold ${qty} ${side ? "YES" : "NO"}, received ${result.cost.toFixed(1)} pts`
      );
      updatePoints(result.new_balance);
      setPosition(prev => {
        if (!prev) return prev;
        const delta = tab === "buy" ? qty : -qty;
        return side
          ? { ...prev, yes: Math.max(0, prev.yes + delta) }
          : { ...prev, no:  Math.max(0, prev.no  + delta) };
      });
      api.position(marketId).then(setPosition).catch(() => {});
      setQtyStr("1");
      setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !market) return null;

  const isOpen   = market.status === "open";
  const isClosed = isOpen && market.closes_at != null && new Date(market.closes_at) < new Date();
  const canTrade = isOpen && !isClosed;

  // Live cost preview using exact LMSR formula
  const costPreview = (() => {
    if (!market || qty < 1) return null;
    try {
      if (tab === "buy") {
        const c = lmsrCost(market.b, market.outstanding_yes, market.outstanding_no, qty, side);
        return { label: "costs", value: c };
      } else {
        const maxSell = side ? (position?.yes ?? 0) : (position?.no ?? 0);
        if (qty > maxSell) return { label: "you only hold", value: null, warn: `${maxSell.toFixed(0)}` };
        const r = lmsrSellReturn(market.b, market.outstanding_yes, market.outstanding_no, qty, side);
        return { label: "returns", value: r };
      }
    } catch { return null; }
  })();

  function fmtCloseTime(closesAt: string): string {
    const diff = new Date(closesAt).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `closes in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `closes in ${hrs}h ${mins % 60}m`;
    return `closes ${new Date(closesAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <>
      <Nav />
      <style>{`
        @keyframes prob-flash {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
      <main className="page-content">
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", marginBottom: 16, padding: 0 }}
        >
          ← markets
        </button>

        {/* Subject tag */}
        {market.subject_username && market.subject_token_key && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Token tokenKey={market.subject_token_key as TokenKey} size={20} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
              {market.subject_username.toUpperCase()}
            </span>
          </div>
        )}

        {/* Title — highlight subject's name if it appears */}
        <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, lineHeight: 1.4, color: "var(--text)" }}>
          <MarketTitle title={market.title} username={market.subject_username} tokenKey={market.subject_token_key} />
        </h1>

        {/* Big probability display */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <ProbDisplay prob={market.yes_prob} side="yes" flash={probFlash} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>VS</span>
          </div>
          <ProbDisplay prob={market.no_prob} side="no" flash={probFlash} />
        </div>

        {/* Probability bar */}
        <div style={{ height: 4, background: "var(--border)", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${Math.round(market.yes_prob * 100)}%`, background: "var(--accent)", transition: "width 0.4s ease" }} />
        </div>

        {/* Odds + close time */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            YES {market.yes_odds}×
          </span>
          {canTrade && market.closes_at && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {fmtCloseTime(market.closes_at)}
            </span>
          )}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            NO {market.no_odds}×
          </span>
        </div>

        {/* Trade panel */}
        {canTrade && (
          <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", padding: 16 }}>
            {/* Buy / Sell tabs */}
            <div style={{ display: "flex", marginBottom: 16, gap: 1 }}>
              {(["buy", "sell"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "8px",
                  background: tab === t ? "var(--border)" : "transparent",
                  border: "1px solid var(--border)",
                  color: tab === t ? "var(--text)" : "var(--muted)",
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  fontWeight: tab === t ? 700 : 400,
                  letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
                }}>
                  {t}
                </button>
              ))}
            </div>

            {/* YES / NO */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setSide(true)} style={{
                flex: 1, padding: "16px 12px",
                background: side ? "var(--accent)" : "transparent",
                border: `1px solid ${side ? "var(--accent)" : "var(--border)"}`,
                color: side ? "#000" : "var(--accent)",
                fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                YES {market.yes_odds}×
              </button>
              <button onClick={() => setSide(false)} style={{
                flex: 1, padding: "16px 12px",
                background: !side ? "var(--no)" : "transparent",
                border: `1px solid ${!side ? "var(--no)" : "var(--border)"}`,
                color: !side ? "#fff" : "var(--no)",
                fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                NO {market.no_odds}×
              </button>
            </div>

            {/* Quantity */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setQtyStr(q => String(Math.max(1, (parseInt(q) || 1) - 1)))} style={qBtnStyle}>−</button>
              <input
                type="text"
                inputMode="numeric"
                value={qtyStr}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setQtyStr(v === "" ? "" : String(Math.min(10000, parseInt(v) || 1)));
                }}
                onBlur={() => setQtyStr(q => String(Math.max(1, parseInt(q) || 1)))}
                style={{
                  flex: 1, textAlign: "center",
                  fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
                  color: "var(--text)", background: "var(--canvas)",
                  border: "1px solid var(--border)", padding: "8px 4px",
                  outline: "none",
                }}
              />
              <button onClick={() => setQtyStr(q => String(Math.min(10000, (parseInt(q) || 1) + 1)))} style={qBtnStyle}>+</button>
            </div>

            {/* Cost preview */}
            <div style={{ marginBottom: 16, minHeight: 20, textAlign: "center" }}>
              {costPreview && costPreview.warn && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)" }}>
                  you only hold {costPreview.warn} {side ? "YES" : "NO"}
                </span>
              )}
              {costPreview && costPreview.value !== null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                  {costPreview.label}{" "}
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>
                    {costPreview.value.toFixed(1)} pts
                  </span>
                  {tab === "buy" && user.points < costPreview.value && (
                    <span style={{ color: "var(--no)", marginLeft: 8 }}>insufficient balance</span>
                  )}
                </span>
              )}
            </div>

            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", marginBottom: 8 }}>{error}</p>}
            {flash && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 8 }}>{flash}</p>}

            <button
              onClick={trade}
              disabled={busy || (tab === "buy" && costPreview?.value !== null && costPreview?.value !== undefined && user.points < (costPreview.value ?? 0))}
              style={{
                width: "100%", padding: "16px",
                background: side ? "var(--accent)" : "var(--no)",
                border: "none",
                color: side ? "#000" : "#fff",
                fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "…" : `${tab} ${qty} ${side ? "YES" : "NO"}`}
            </button>

            {/* Position */}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {(["yes", "no"] as const).map(s => {
                const val = position?.[s] ?? 0;
                const active = val > 0;
                const col = s === "yes" ? "var(--accent)" : "var(--no)";
                return (
                  <div key={s} style={{
                    flex: 1, padding: "8px 10px",
                    border: `1px solid ${active ? col : "var(--border)"}`,
                    background: active ? `color-mix(in srgb, ${col} 8%, transparent)` : "transparent",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: active ? col : "var(--muted)" }}>
                      {s.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: active ? col : "var(--muted)" }}>
                      {position ? (active ? val.toFixed(1) : "—") : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Closed / settled banners */}
        {isClosed && (
          <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            CLOSED — awaiting result
          </div>
        )}
        {!isOpen && (
          <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            {market.settled_side !== null
              ? `settled — ${market.settled_side ? "YES" : "NO"} won`
              : "refunded at close-time price"}
          </div>
        )}

        {/* Activity / Chat */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", gap: 1, marginBottom: 16 }}>
            {(["activity", "chat"] as const).map(t => (
              <button key={t} onClick={() => setSection(t)} style={{
                flex: 1, padding: "8px",
                background: section === t ? "var(--border)" : "transparent",
                border: "1px solid var(--border)",
                color: section === t ? "var(--text)" : "var(--muted)",
                fontFamily: "var(--font-mono)", fontSize: 11,
                fontWeight: section === t ? 700 : 400,
                letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
              }}>
                {t}
              </button>
            ))}
          </div>

          {section === "activity" && (
            <>
              {feed.length === 0 && (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>no trades yet</p>
              )}
              {feed.map(entry => (
                <div key={entry.trade_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <Token tokenKey={entry.token_key as TokenKey} size={24} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flex: 1 }}>
                    {entry.username}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: entry.side ? "var(--accent)" : "var(--no)" }}>
                    {entry.side ? "YES" : "NO"} ×{entry.quantity}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                    {entry.cost.toFixed(1)}
                  </span>
                </div>
              ))}
            </>
          )}

          {section === "chat" && (
            <div style={{ height: 360 }}>
              <ChatPanel
                messages={chat}
                currentUserId={user.user_id}
                onSend={async (content) => { await api.sendMarketChat(marketId, content); }}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const qBtnStyle: React.CSSProperties = {
  width: 48, height: 48,
  background: "var(--canvas)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 18,
  cursor: "pointer",
  flexShrink: 0,
};
