"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

const FAKE_TRADES = [
  { username: "alex_h", side: true,  qty: 5,  cost: "3.4 pts" },
  { username: "sarah",  side: false, qty: 3,  cost: "1.0 pts" },
  { username: "finn",   side: true,  qty: 10, cost: "7.1 pts" },
];

export default function TutorialMarketPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [side,  setSide]  = useState(true);
  const [qty,   setQty]   = useState(1);
  const [flash, setFlash] = useState("");

  if (loading || !user) return null;

  // Approximate LMSR cost for demo (b=30, qYes=20, qNo=4)
  const approxCost = side
    ? (0.68 * qty).toFixed(1)
    : (0.32 * qty).toFixed(1);

  function handleBuy() {
    setFlash("demo mode — real trades happen on live markets");
    setTimeout(() => setFlash(""), 3000);
  }

  return (
    <>
      <Nav />
      <main className="page-content">

        {/* Back */}
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", marginBottom: 16, padding: 0 }}
        >
          ← markets
        </button>

        {/* DEMO badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", border: "1px solid var(--border)", padding: "2px 7px", letterSpacing: "0.1em" }}>
            DEMO
          </span>
        </div>

        {/* Status */}
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>
            ● LIVE
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, lineHeight: 1.4, color: "var(--text)" }}>
          Will Jamie show up on time for once?
        </h1>

        {/* Probability display */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ textAlign: "left", flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 900, color: "var(--accent)", lineHeight: 1 }}>
              67%
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>YES</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>VS</span>
          </div>
          <div style={{ textAlign: "right", flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 900, color: "var(--no)", lineHeight: 1 }}>
              33%
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>NO</div>
          </div>
        </div>

        {/* Bar */}
        <div style={{ height: 4, background: "var(--no)", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: "67%", background: "var(--accent)" }} />
        </div>

        {/* Odds */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>YES pays 1.5×</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>NO pays 3.0×</span>
        </div>

        {/* Trade panel */}
        <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", padding: 16 }}>

          {/* BUY / SELL tabs */}
          <div style={{ display: "flex", marginBottom: 16, gap: 1 }}>
            {(["buy", "sell"] as const).map(t => (
              <button key={t} style={{
                flex: 1, padding: "8px",
                background: t === "buy" ? "var(--border)" : "transparent",
                border: "1px solid var(--border)",
                color: t === "buy" ? "var(--text)" : "var(--muted)",
                fontFamily: "var(--font-mono)", fontSize: 12,
                fontWeight: t === "buy" ? 700 : 400,
                letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
              }}>
                {t}
              </button>
            ))}
          </div>

          {/* YES / NO */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              data-tutorial="yes-button"
              onClick={() => setSide(true)}
              style={{
                flex: 1, padding: "16px 12px",
                background: side ? "var(--accent)" : "transparent",
                border: `1px solid ${side ? "var(--accent)" : "var(--border)"}`,
                color: side ? "#000" : "var(--accent)",
                fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              YES
            </button>
            <button
              onClick={() => setSide(false)}
              style={{
                flex: 1, padding: "16px 12px",
                background: !side ? "var(--no)" : "transparent",
                border: `1px solid ${!side ? "var(--no)" : "var(--border)"}`,
                color: !side ? "#fff" : "var(--no)",
                fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              NO
            </button>
          </div>

          {/* Quantity */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={qBtnStyle}>−</button>
            <input
              type="text"
              inputMode="numeric"
              value={qty}
              onFocus={e => e.target.select()}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setQty(v === "" ? 1 : Math.min(100, parseInt(v) || 1));
              }}
              style={{
                flex: 1, textAlign: "center",
                fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
                color: "var(--text)", background: "var(--canvas)",
                border: "1px solid var(--border)", padding: "8px 4px", outline: "none",
              }}
            />
            <button onClick={() => setQty(q => Math.min(100, q + 1))} style={qBtnStyle}>+</button>
          </div>

          {/* Cost preview */}
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
              cost{" "}
              <span style={{ color: "var(--text)", fontWeight: 700 }}>{approxCost} pts</span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
              payout{" "}
              <span style={{ color: side ? "var(--accent)" : "var(--no)", fontWeight: 700 }}>
                {qty} pts
              </span>{" "}
              if {side ? "YES" : "NO"}
            </span>
          </div>

          {flash && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              {flash}
            </p>
          )}

          <button
            onClick={handleBuy}
            style={{
              width: "100%", padding: "16px",
              background: side ? "var(--accent)" : "var(--no)",
              border: "none",
              color: side ? "#000" : "#fff",
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            buy {qty} {side ? "YES" : "NO"}
          </button>
        </div>

        {/* Fake activity */}
        <div style={{ marginTop: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 12px" }}>
            ACTIVITY
          </p>
          {FAKE_TRADES.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flex: 1 }}>{t.username}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>bought</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: t.side ? "var(--accent)" : "var(--no)" }}>
                {t.side ? "YES" : "NO"} ×{t.qty}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{t.cost}</span>
            </div>
          ))}
        </div>

      </main>
    </>
  );
}

const qBtnStyle: React.CSSProperties = {
  width: 48, height: 48,
  background: "var(--canvas)", border: "1px solid var(--border)",
  color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 18,
  cursor: "pointer", flexShrink: 0,
};
