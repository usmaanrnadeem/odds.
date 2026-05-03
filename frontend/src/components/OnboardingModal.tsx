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

function VisualMarket() {
  const yesPct = 28;
  const noPct  = 72;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 10px", letterSpacing: "0.06em" }}>
        EXAMPLE MARKET
      </p>
      <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 14px", lineHeight: 1.4 }}>
        Finn ends his night gardening in rural Budapest
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>YES {yesPct}%</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--no)" }}>NO {noPct}%</span>
      </div>
      <div style={{ height: 4, background: "var(--no)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${yesPct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

function VisualBuy() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 12px", letterSpacing: "0.06em" }}>
        BUYING 10 YES SHARES AT 28%
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "var(--muted)" }}>you pay now</span>
        <span style={{ color: "var(--text)", fontWeight: 700 }}>2.8 pts</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "var(--muted)" }}>if YES wins → you get</span>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>10 pts</span>
      </div>
      <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>profit</span>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>+7.2 pts</span>
      </div>
    </div>
  );
}

function VisualProb() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 12px", letterSpacing: "0.06em" }}>
        HOW THE % MOVES
      </p>
      {[
        { label: "market opens", yes: 50, no: 50 },
        { label: "people buy YES", yes: 65, no: 35 },
        { label: "people buy NO", yes: 40, no: 60 },
      ].map(({ label, yes, no }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
              <span style={{ color: "var(--accent)" }}>YES {yes}%</span>
              <span style={{ color: "var(--muted)" }}> · </span>
              <span style={{ color: "var(--no)" }}>NO {no}%</span>
            </span>
          </div>
          <div style={{ height: 3, background: "var(--no)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${yes}%`, background: "var(--accent)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      ))}
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

function VisualLeague() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { label: "💡  pitch market ideas", sub: "admin picks the best ones" },
        { label: "📊  track your PnL", sub: "see how you did on each market" },
        { label: "🏆  leaderboard", sub: "who's up, who's down" },
      ].map(({ label, sub }) => (
        <div key={label} style={{
          padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{sub}</span>
        </div>
      ))}
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
    title: "Bet on anything.\nWith your friends.",
    body: "odds. is a prediction market. Each market is a yes/no question — you bet points on the outcome and win more back if you're right.",
    visual: () => <VisualWelcome />,
  },
  {
    tag: "THE MARKET",
    title: "The % is what\neveryone thinks.",
    body: "YES 28% means the group collectively thinks there's a 28% chance it happens. You can agree with that — or bet against it.",
    visual: () => <VisualMarket />,
  },
  {
    tag: "HOW YOU WIN",
    title: "Each share pays\n1 pt if you're right.",
    body: "Buy 10 YES shares at 28% → costs ~2.8 pts. If YES wins, you receive 10 pts back. Profit: +7.2 pts. Low % = cheap shares = big upside.",
    visual: () => <VisualBuy />,
  },
  {
    tag: "LIVE ODDS",
    title: "The % shifts as\npeople trade.",
    body: "Every trade moves the odds. Buy YES and the YES% goes up, making it pricier for the next person. Get in early on the right side.",
    visual: () => <VisualProb />,
  },
  {
    tag: "YOUR STAKE",
    title: "Don't go broke.",
    body: "These are your points for the whole game. Spend them wisely — you can't earn more, only win them from markets.",
    visual: (pts) => <VisualPoints startingPts={pts} />,
  },
  {
    tag: "& MORE",
    title: "More than\njust a market.",
    body: "Pitch market ideas, vote with your wallet. Check the leaderboard to see who's winning. Your profile shows your PnL on every settled market.",
    visual: () => <VisualLeague />,
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
      overflowY: "auto",
    }}>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={{
        minHeight: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, boxSizing: "border-box",
      }}>
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
    </div>
  );
}
