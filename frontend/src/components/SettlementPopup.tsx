"use client";
import { useEffect, useState, useRef } from "react";
import { WSSettlementEvent, connectWS, WSEvent } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Token from "./Token";
import { TokenKey } from "@/lib/tokens";

// ── Confetti ─────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#D4FF00", "#FF4757", "#4ECDC4", "#A855F7",
  "#FFD93D", "#6BCB77", "#FF7F50", "#5C7AEA",
];

type Particle = {
  id: number;
  x: number;       // vw %
  size: number;    // px
  color: string;
  delay: number;   // s
  duration: number; // s
  rotation: number; // deg
};

function Confetti({ active }: { active: boolean }) {
  const particles = useRef<Particle[]>(
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.floor(Math.random() * 6) + 4,  // 4–9px pixel squares
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 1.2,
      duration: 1.8 + Math.random() * 1.4,
      rotation: Math.random() * 360,
    }))
  );

  if (!active) return null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 201, overflow: "hidden" }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-sway {
          0%   { margin-left: 0; }
          25%  { margin-left: 20px; }
          75%  { margin-left: -20px; }
          100% { margin-left: 0; }
        }
      `}</style>
      {particles.current.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.x}vw`,
            width: p.size,
            height: p.size,
            background: p.color,
            imageRendering: "pixelated",
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards,
                        confetti-sway ${p.duration * 0.6}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 260, h = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", margin: "0 auto" }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────

export default function SettlementPopup() {
  const { user } = useUser();
  const [event, setEvent] = useState<WSSettlementEvent | null>(null);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!user) return;
    const disconnect = connectWS((e: WSEvent) => {
      if (e.type === "settlement") {
        setEvent(e);
        setConfetti(true);
        // Stop emitting new confetti after 3s, particles finish falling naturally
        setTimeout(() => setConfetti(false), 3000);
      }
    });
    return disconnect;
  }, [user]);

  function dismiss() {
    setEvent(null);
    setConfetti(false);
  }

  return (
    <>
      <Confetti active={confetti} />

      {event && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={dismiss}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360,
              background: "var(--canvas)",
              border: "1px solid var(--accent)",
              boxShadow: "0 0 40px #D4FF0022",
              padding: 24,
              textAlign: "center",
              animation: "popup-in 0.2s ease-out",
            }}
          >
            <style>{`
              @keyframes popup-in {
                from { transform: scale(0.92); opacity: 0; }
                to   { transform: scale(1);    opacity: 1; }
              }
            `}</style>

            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.15em", margin: "0 0 16px" }}>
              MARKET SETTLED
            </p>

            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700,
              color: event.settled_side ? "var(--accent)" : "var(--no)",
              margin: "0 0 4px",
            }}>
              {event.settled_side ? "YES" : "NO"} WON
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.4 }}>
              {event.market_title}
            </p>

            {/* Winner */}
            {event.winner_username && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <div style={{
                    padding: 6,
                    border: "2px solid var(--accent)",
                    boxShadow: "0 0 20px #D4FF0044",
                    display: "inline-block",
                    animation: "pulse-ring 1.5s ease-in-out infinite",
                  }}>
                    <Token tokenKey={event.winner_token_key as TokenKey} size={64} />
                  </div>
                </div>
                <style>{`
                  @keyframes pulse-ring {
                    0%, 100% { box-shadow: 0 0 12px #D4FF0044; }
                    50%      { box-shadow: 0 0 28px #D4FF0088; }
                  }
                `}</style>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 2px" }}>
                  {event.winner_username}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--accent)", margin: 0 }}>
                  +{event.winner_profit.toFixed(1)} pts
                </p>
              </div>
            )}

            {/* Rest of podium */}
            {event.podium.length > 1 && (
              <div style={{ marginBottom: 20, textAlign: "left" }}>
                {event.podium.slice(1).map(p => (
                  <div key={p.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 16 }}>#{p.rank}</span>
                    <Token tokenKey={p.token_key as TokenKey} size={20} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flex: 1 }}>{p.username}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: p.profit >= 0 ? "var(--accent)" : "var(--no)" }}>
                      {p.profit >= 0 ? "+" : ""}{p.profit.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Price arc */}
            {event.price_arc.length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <Sparkline data={event.price_arc} />
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 6 }}>price history</p>
              </div>
            )}

            <button
              onClick={dismiss}
              style={{
                width: "100%", padding: "10px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontFamily: "var(--font-mono)", fontSize: 12,
                cursor: "pointer", letterSpacing: "0.08em",
              }}
            >
              dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
