"use client";
import { useState } from "react";

const SEEN_KEY = "onboarding_v1_seen";
export const markOnboardingSeen = () => localStorage.setItem(SEEN_KEY, "1");
export const hasSeenOnboarding  = () =>
  typeof window !== "undefined" && !!localStorage.getItem(SEEN_KEY);

// ── Slide visuals ────────────────────────────────────────────

function VisualWelcome() {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 900, color: "var(--accent)", letterSpacing: "-2px" }}>
        odds.
      </span>
    </div>
  );
}

function VisualSides() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1, padding: "14px 8px", border: "2px solid var(--accent)", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
        YES 2.4×
      </div>
      <div style={{ flex: 1, padding: "14px 8px", border: "2px solid var(--no)", color: "var(--no)", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
        NO 1.7×
      </div>
    </div>
  );
}

function VisualOdds() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>EXAMPLE</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>YES 3.2×</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: "var(--muted)" }}>you spend</span>
        <span style={{ color: "var(--text)" }}>10 pts</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>if YES wins</span>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>+32 pts</span>
      </div>
    </div>
  );
}

function VisualPoints({ startingPts }: { startingPts: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 900, color: "var(--text)" }}>
        {startingPts.toFixed(0)}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--muted)" }}>pts</span>
    </div>
  );
}

function VisualReady() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        {["LIVE ODDS", "REAL-TIME", "CHAT", "TROPHIES"].map(tag => (
          <span key={tag} style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
            color: "var(--accent)", border: "1px solid var(--accent)",
            padding: "4px 8px",
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Slide definitions ─────────────────────────────────────────

type Slide = {
  tag: string;
  title: string;
  body: string;
  visual: (pts: number) => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    tag: "WELCOME",
    title: "Prediction markets\nfor your group.",
    body: "Bet points on anything with a YES or NO outcome. Read the crowd. Outsmart your friends.",
    visual: () => <VisualWelcome />,
  },
  {
    tag: "MARKETS",
    title: "Pick a side.",
    body: "Every market has a YES and NO. Buy shares before it resolves. Odds shift as people trade — move fast.",
    visual: () => <VisualSides />,
  },
  {
    tag: "ODDS",
    title: "Bigger odds =\nbigger payout.",
    body: "The number next to YES or NO is your multiplier. Long shots pay more. Favourites pay less. Simple.",
    visual: () => <VisualOdds />,
  },
  {
    tag: "POINTS",
    title: "This is your stake.",
    body: "Spend points to buy. Win them back — and more — when you're right. Don't go broke.",
    visual: (pts) => <VisualPoints startingPts={pts} />,
  },
  {
    tag: "YOU'RE IN",
    title: "May the best\npredictor win.",
    body: "Odds update live. Chat on every market. Trophies go to the top 3 on each settlement.",
    visual: () => <VisualReady />,
  },
];

// ── Modal ─────────────────────────────────────────────────────

interface Props {
  startingPts: number;
  onDone: () => void;
}

export default function OnboardingModal({ startingPts, onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast  = slide === SLIDES.length - 1;

  function next() {
    if (isLast) { markOnboardingSeen(); onDone(); }
    else setSlide(s => s + 1);
  }

  function skip() { markOnboardingSeen(); onDone(); }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        key={slide}
        style={{
          width: "100%", maxWidth: 340,
          background: "var(--canvas)",
          border: "1px solid var(--border)",
          padding: 28,
          animation: "slide-up 0.18s ease-out",
        }}
      >
        {/* Tag */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em", margin: "0 0 20px" }}>
          {current.tag}
        </p>

        {/* Visual */}
        <div style={{ marginBottom: 24 }}>
          {current.visual(startingPts)}
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.25, whiteSpace: "pre-line" }}>
          {current.title}
        </h2>

        {/* Body */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: "0 0 28px" }}>
          {current.body}
        </p>

        {/* Dots + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 6 }}>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === slide ? 16 : 6, height: 6,
                  background: i === slide ? "var(--accent)" : "var(--border)",
                  transition: "width 0.2s ease, background 0.2s ease",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {!isLast && (
              <button
                onClick={skip}
                style={{
                  padding: "10px 14px", background: "transparent",
                  border: "1px solid var(--border)", color: "var(--muted)",
                  fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer",
                }}
              >
                skip
              </button>
            )}
            <button
              onClick={next}
              style={{
                padding: "10px 20px",
                background: isLast ? "var(--accent)" : "var(--surface)",
                border: `1px solid ${isLast ? "var(--accent)" : "var(--border)"}`,
                color: isLast ? "#000" : "var(--text)",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.06em",
              }}
            >
              {isLast ? "let's go →" : "next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
