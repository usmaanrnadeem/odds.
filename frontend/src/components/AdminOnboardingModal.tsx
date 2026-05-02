"use client";
import { useState } from "react";

const SEEN_KEY = "admin_onboarding_v1_seen";
export const markAdminOnboardingSeen = () => localStorage.setItem(SEEN_KEY, "1");
export const hasSeenAdminOnboarding  = () =>
  typeof window !== "undefined" && !!localStorage.getItem(SEEN_KEY);

// ── Slide visuals ─────────────────────────────────────────────

function VisualAdmin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { icon: "📋", label: "post markets",   sub: "create yes/no questions" },
        { icon: "✅", label: "settle markets", sub: "pay out winners" },
        { icon: "🔗", label: "invite people",  sub: "share the group link" },
        { icon: "💡", label: "review ideas",   sub: "approve member pitches" },
      ].map(({ icon, label, sub }) => (
        <div key={label} style={{
          padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{icon}  {label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{sub}</span>
        </div>
      ))}
    </div>
  );
}

function VisualPost() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 10px", letterSpacing: "0.06em" }}>
        POSTING A MARKET
      </p>
      <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.4 }}>
        Will Jamie bail on the Saturday match?
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, padding: "8px 10px", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textAlign: "center" }}>
          YES
        </div>
        <div style={{ flex: 1, padding: "8px 10px", border: "1px solid color-mix(in srgb, var(--no) 40%, transparent)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--no)", textAlign: "center" }}>
          NO
        </div>
      </div>
      <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
        ✓ specific &nbsp;&nbsp; ✓ verifiable &nbsp;&nbsp; ✓ clear deadline
      </div>
    </div>
  );
}

function VisualSettle() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 10px", letterSpacing: "0.06em" }}>
        SETTLING A MARKET
      </p>
      <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 14px", lineHeight: 1.4 }}>
        Will Jamie bail on the Saturday match?
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, padding: "9px", border: "1px solid var(--accent)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 700, textAlign: "center" }}>
          YES happened
        </div>
        <div style={{ flex: 1, padding: "9px", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          NO happened
        </div>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
        Points paid out automatically once you confirm.
      </p>
    </div>
  );
}

function VisualInvite() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "0 0 10px", letterSpacing: "0.06em" }}>
        SHARE THE LINK
      </p>
      <div style={{
        padding: "10px 12px",
        background: "var(--canvas)", border: "1px solid var(--border)",
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)",
        wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10,
      }}>
        odds.example.com/join?token=abc123
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.8 }}>
        → anyone with this link can join your group<br />
        → regenerate anytime to invalidate old links
      </div>
    </div>
  );
}

function VisualIdeas() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[
        { title: "Will Sarah make the team?", status: "PENDING", accent: true },
        { title: "Does Tom finish the marathon?",  status: "APPROVED → LIVE", accent: false },
      ].map(({ title, status, accent }) => (
        <div key={title} style={{
          padding: "10px 14px", background: "var(--surface)",
          border: `1px solid ${accent ? "color-mix(in srgb, var(--accent) 25%, var(--border))" : "var(--border)"}`,
        }}>
          <p style={{ fontSize: 12, color: "var(--text)", margin: "0 0 4px", lineHeight: 1.4 }}>{title}</p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: accent ? "var(--accent)" : "var(--muted)", letterSpacing: "0.08em" }}>
            {status}
          </span>
        </div>
      ))}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.6 }}>
        Review pitches from members in the Ideas tab.
      </p>
    </div>
  );
}

// ── Slide definitions ─────────────────────────────────────────

type Slide = {
  tag: string;
  title: string;
  body: string;
  visual: () => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    tag: "YOU'RE THE ADMIN",
    title: "You run\nthis group.",
    body: "As admin you control what your group bets on. You post markets, settle them once the outcome is known, and invite your friends.",
    visual: VisualAdmin,
  },
  {
    tag: "POSTING MARKETS",
    title: "Create yes/no\nquestions to bet on.",
    body: "Good markets are specific and have a clear, verifiable outcome. Anyone can pitch an idea — you decide which ones go live.",
    visual: VisualPost,
  },
  {
    tag: "SETTLING MARKETS",
    title: "When it's over,\nyou call it.",
    body: "Once the real-world outcome is known, open the Manage page and settle the market. Points are distributed to the winners instantly.",
    visual: VisualSettle,
  },
  {
    tag: "INVITING PEOPLE",
    title: "Share a link.\nThat's it.",
    body: "Your group has a unique invite link. Share it with friends to add them. Regenerate the link anytime if you want to stop new joins.",
    visual: VisualInvite,
  },
  {
    tag: "MARKET IDEAS",
    title: "Let the group\npitch ideas.",
    body: "Members can suggest markets in the Ideas tab. You review them and approve the best ones — they go live as real markets automatically.",
    visual: VisualIdeas,
  },
];

// ── Modal ─────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export default function AdminOnboardingModal({ onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast  = slide === SLIDES.length - 1;

  function next() {
    if (isLast) { markAdminOnboardingSeen(); onDone(); }
    else setSlide(s => s + 1);
  }

  function skip() { markAdminOnboardingSeen(); onDone(); }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <style>{`
        @keyframes admin-slide-up {
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
          animation: "admin-slide-up 0.18s ease-out",
        }}
      >
        {/* Tag */}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em", margin: "0 0 20px" }}>
          {current.tag}
        </p>

        {/* Visual */}
        <div style={{ marginBottom: 24 }}>
          {current.visual()}
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
              {isLast ? "got it →" : "next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
