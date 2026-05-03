"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTutorial } from "@/lib/tutorial";

type Rect = { top: number; left: number; width: number; height: number };

const OVERLAY_BG = "rgba(0,0,0,0.82)";
const OVERLAY_Z  = 45;
const TOOLTIP_Z  = 499;

const TUTORIAL_CSS = `
  [data-tutorial-active] {
    outline: 2px solid var(--accent) !important;
    outline-offset: 3px !important;
    position: relative !important;
    z-index: 46 !important;
    animation: tut-ring 1.8s ease-in-out infinite !important;
  }
  @keyframes tut-ring {
    0%, 100% { outline-color: var(--accent); }
    50%       { outline-color: rgba(212,255,0,0.3); }
  }
`;

export default function TutorialOverlay() {
  const { isActive, currentStep, step, totalSteps, advance, skipSteps, skipAll } = useTutorial();
  const [rect, setRect]         = useState<Rect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const prevEl   = useRef<Element | null>(null);

  // ── Element polling (skipped for noSpotlight steps) ──────────
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.noSpotlight) {
      setRect(null);
      setNotFound(false);
      prevEl.current?.removeAttribute("data-tutorial-active");
      prevEl.current = null;
      return;
    }
    setRect(null);
    setNotFound(false);

    let tries = 0;
    const poll = setInterval(() => {
      const el = document.querySelector(`[data-tutorial="${currentStep.id}"]`) as HTMLElement | null;
      if (el) {
        clearInterval(poll);
        prevEl.current?.removeAttribute("data-tutorial-active");
        el.setAttribute("data-tutorial-active", "true");
        prevEl.current = el;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }
      if (++tries > 15) { clearInterval(poll); setNotFound(true); }
    }, 100);

    return () => {
      clearInterval(poll);
      prevEl.current?.removeAttribute("data-tutorial-active");
      prevEl.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep?.id, pathname]);

  useEffect(() => () => { prevEl.current?.removeAttribute("data-tutorial-active"); }, []);

  // ── Click-to-advance (not for nextButton / finishButton steps) ─
  useEffect(() => {
    if (!isActive || !currentStep || !rect) return;
    if (currentStep.nextButton || currentStep.finishButton) return;
    const el = document.querySelector(`[data-tutorial="${currentStep.id}"]`);
    if (!el) return;
    const handler = () => {
      el.removeAttribute("data-tutorial-active");
      prevEl.current = null;
      advance();
    };
    el.addEventListener("click", handler, { once: true });
    return () => el.removeEventListener("click", handler);
  }, [isActive, currentStep?.id, rect, advance]);

  // ── Rect sync on resize / scroll ──────────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.noSpotlight) return;
    const sync = () => {
      const el = document.querySelector(`[data-tutorial="${currentStep.id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => { window.removeEventListener("resize", sync); window.removeEventListener("scroll", sync); };
  }, [isActive, currentStep?.id]);

  if (!isActive || !currentStep) return null;

  const W = typeof window !== "undefined" ? window.innerWidth  : 390;
  const H = typeof window !== "undefined" ? window.innerHeight : 844;
  const isLast = step === totalSteps - 1;

  // ── noSpotlight landing steps — floating bottom card ─────────
  if (currentStep.noSpotlight) {
    const btnLabel = currentStep.finishButton
      ? (isLast ? "done ✓" : "next →")
      : "next →";
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          zIndex: TOOLTIP_Z,
          background: "var(--canvas)",
          borderTop: "1px solid var(--border)",
          padding: "20px 20px 28px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em" }}>
                {step + 1} / {totalSteps}
              </span>
              <button onClick={skipAll} style={skipBtnStyle}>skip tutorial</button>
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.3 }}>
              {currentStep.title}
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: "0 0 16px" }}>
              {currentStep.body}
            </p>
            <button onClick={advance} style={btnLabel === "done ✓" ? finishBtnStyle : nextBtnStyle}>
              {btnLabel}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── No-market fallback — show a demo market card ──────────────
  if (notFound && currentStep.noMarketFallback) {
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <div style={{ position: "fixed", inset: 0, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
        <div style={{
          position: "fixed", left: 16, right: 16,
          top: "50%", transform: "translateY(-55%)",
          zIndex: TOOLTIP_Z, maxWidth: 448, margin: "0 auto",
        }}>
          {/* Tooltip header */}
          <div style={{
            background: "var(--canvas)", border: "1px solid var(--border)",
            padding: "16px 18px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em" }}>
                {step + 1} / {totalSteps}
              </span>
              <button onClick={skipAll} style={skipBtnStyle}>skip tutorial</button>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
              Open a market
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Tap this demo market to see how betting works. It&apos;ll disappear once you&apos;re done.
            </p>
          </div>

          {/* Demo market card */}
          <DemoMarketCard onTap={() => { router.push("/tutorial-market"); advance(); }} />
        </div>
      </>
    );
  }

  // ── Generic not-found ─────────────────────────────────────────
  if (notFound) {
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <div style={{ position: "fixed", inset: 0, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
        <div style={{
          position: "fixed", left: 16, right: 16,
          top: "50%", transform: "translateY(-50%)",
          background: "var(--canvas)", border: "1px solid var(--border)",
          padding: "20px", zIndex: TOOLTIP_Z,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em" }}>
              {step + 1} / {totalSteps}
            </span>
            <button onClick={skipAll} style={skipBtnStyle}>skip tutorial</button>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{currentStep.title}</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: "0 0 14px" }}>
            {currentStep.body}
          </p>
          <button onClick={advance} style={nextBtnStyle}>skip this step →</button>
        </div>
      </>
    );
  }

  if (!rect) return null;

  // ── Spotlight ─────────────────────────────────────────────────
  const PAD = 6;
  const sTop    = Math.max(0, rect.top    - PAD);
  const sLeft   = Math.max(0, rect.left   - PAD);
  const sH      = rect.height + PAD * 2;
  const sW      = rect.width  + PAD * 2;
  const sBottom = sTop  + sH;
  const sRight  = sLeft + sW;

  const ttW    = Math.min(300, W - 32);
  const ttLeft = Math.max(16, Math.min(sLeft, W - ttW - 16));
  const below  = H - sBottom > 160;

  const btnLabel = currentStep.finishButton
    ? (isLast ? "done ✓" : "next →")
    : undefined;

  return (
    <>
      <style>{TUTORIAL_CSS}</style>

      {/* 4 dimming panels — nav (z-index 50) floats above these */}
      <div style={{ position: "fixed", top: 0,       left: 0, right: 0, height: sTop, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sBottom, left: 0, right: 0, bottom: 0,   background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sTop,    left: 0, width: sLeft, height: sH, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sTop,    left: sRight, right: 0, height: sH, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />

      {/* Tooltip */}
      <div style={{
        position: "fixed",
        left: ttLeft,
        width: ttW,
        zIndex: TOOLTIP_Z,
        background: "var(--canvas)",
        border: "1px solid var(--border)",
        padding: "16px 18px",
        ...(below ? { top: sBottom + 10 } : { bottom: H - sTop + 10 }),
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em" }}>
            {step + 1} / {totalSteps}
          </span>
          <button onClick={skipAll} style={skipBtnStyle}>skip tutorial</button>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.3 }}>
          {currentStep.title}
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
          {currentStep.body}
        </p>
        {btnLabel ? (
          <button onClick={advance} style={{ marginTop: 14, ...(btnLabel === "done ✓" ? finishBtnStyle : nextBtnStyle) }}>
            {btnLabel}
          </button>
        ) : currentStep.cta ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "10px 0 0", opacity: 0.65 }}>
            {below ? "↑" : "↓"} {currentStep.cta}
          </p>
        ) : null}
      </div>
    </>
  );
}

// ── Demo market card ──────────────────────────────────────────

function DemoMarketCard({ onTap }: { onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      style={{
        padding: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--text)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>
          ● LIVE
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", border: "1px solid var(--border)", padding: "1px 6px", letterSpacing: "0.08em" }}>
          DEMO
        </span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text)", lineHeight: 1.4 }}>
        Will Jamie show up on time for once?
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)" }}>YES 67%</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no)" }}>NO 33%</span>
      </div>
      <div style={{ height: 3, background: "var(--no)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: "67%", background: "var(--accent)" }} />
      </div>
    </div>
  );
}

// ── Shared button styles ──────────────────────────────────────

const finishBtnStyle: React.CSSProperties = {
  width: "100%", padding: "12px",
  background: "var(--accent)", border: "none", color: "#000",
  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
};

const nextBtnStyle: React.CSSProperties = {
  width: "100%", padding: "12px",
  background: "transparent", border: "1px solid var(--border)", color: "var(--text)",
  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
  letterSpacing: "0.06em", cursor: "pointer",
};

const skipBtnStyle: React.CSSProperties = {
  background: "none", border: "none",
  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)",
  cursor: "pointer", padding: "2px 4px",
};
