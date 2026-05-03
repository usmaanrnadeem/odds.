"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
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
    50%       { outline-color: rgba(212,255,0,0.35); }
  }
`;

export default function TutorialOverlay() {
  const { isActive, currentStep, step, totalSteps, advance, skipSteps, skipAll } = useTutorial();
  const [rect, setRect]       = useState<Rect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pathname  = usePathname();
  const prevEl    = useRef<Element | null>(null);

  // ── Find + highlight target ───────────────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep) {
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
  // pathname in deps so we re-scan after client-side navigation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep?.id, pathname]);

  // Cleanup on unmount
  useEffect(() => () => { prevEl.current?.removeAttribute("data-tutorial-active"); }, []);

  // ── Click-to-advance ──────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep || !rect || currentStep.finishButton) return;
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
    if (!isActive || !currentStep) return;
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

  // ── No-markets fallback ───────────────────────────────────────
  if (notFound && currentStep.noMarketFallback) {
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <div style={{ position: "fixed", inset: 0, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
        <Tooltip
          step={step} total={totalSteps}
          title="No markets yet"
          body="Your admin hasn't posted any markets yet — they'll appear here once they do."
          style={{ position: "fixed", left: 16, right: 16, top: "50%", transform: "translateY(-50%)", zIndex: TOOLTIP_Z }}
          onSkip={skipAll}
        >
          <button
            onClick={() => skipSteps(2)} // skip market-card AND yes-button steps
            style={skipStepBtn}
          >
            skip for now →
          </button>
        </Tooltip>
      </>
    );
  }

  // ── Generic not-found (e.g. on wrong page) ────────────────────
  if (notFound) {
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <div style={{ position: "fixed", inset: 0, background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
        <Tooltip
          step={step} total={totalSteps}
          title={currentStep.title}
          body={currentStep.body}
          style={{ position: "fixed", left: 16, right: 16, top: "50%", transform: "translateY(-50%)", zIndex: TOOLTIP_Z }}
          onSkip={skipAll}
        >
          <button onClick={() => advance()} style={skipStepBtn}>skip this step →</button>
        </Tooltip>
      </>
    );
  }

  if (!rect) return null;

  // ── Spotlight geometry ────────────────────────────────────────
  const PAD = 6;
  const sTop    = Math.max(0, rect.top    - PAD);
  const sLeft   = Math.max(0, rect.left   - PAD);
  const sH      = rect.height + PAD * 2;
  const sW      = rect.width  + PAD * 2;
  const sBottom = sTop  + sH;
  const sRight  = sLeft + sW;

  // ── Tooltip position ──────────────────────────────────────────
  const ttW    = Math.min(300, W - 32);
  const ttLeft = Math.max(16, Math.min(sLeft, W - ttW - 16));
  const below  = H - sBottom > 150;

  return (
    <>
      <style>{TUTORIAL_CSS}</style>

      {/* 4 dimming panels — nav (z-index 50) floats above these naturally */}
      <div style={{ position: "fixed", top: 0,       left: 0, right: 0,       height: sTop,     background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sBottom, left: 0, right: 0,       bottom: 0,        background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sTop,    left: 0, width: sLeft,   height: sH,       background: OVERLAY_BG, zIndex: OVERLAY_Z }} />
      <div style={{ position: "fixed", top: sTop,    left: sRight, right: 0,  height: sH,       background: OVERLAY_BG, zIndex: OVERLAY_Z }} />

      {/* Tooltip */}
      <Tooltip
        step={step} total={totalSteps}
        title={currentStep.title}
        body={currentStep.body}
        cta={currentStep.cta}
        arrowUp={below}
        style={{
          position: "fixed",
          left: ttLeft,
          width: ttW,
          zIndex: TOOLTIP_Z,
          ...(below ? { top: sBottom + 10 } : { bottom: H - sTop + 10 }),
        }}
        onSkip={skipAll}
      >
        {currentStep.finishButton && (
          <button onClick={advance} style={finishBtn}>done ✓</button>
        )}
      </Tooltip>
    </>
  );
}

// ── Tooltip card ──────────────────────────────────────────────

function Tooltip({
  step, total, title, body, cta, arrowUp = true,
  style, onSkip, children,
}: {
  step: number; total: number;
  title: string; body: string; cta?: string; arrowUp?: boolean;
  style: React.CSSProperties;
  onSkip: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--canvas)",
      border: "1px solid var(--border)",
      padding: "16px 18px",
      ...style,
    }}>
      {/* Top row: progress + skip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.2em" }}>
          {step + 1} / {total}
        </span>
        <button
          onClick={onSkip}
          style={{ background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", cursor: "pointer", padding: "2px 4px" }}
        >
          skip tutorial
        </button>
      </div>

      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.3 }}>
        {title}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
        {body}
      </p>

      {children}

      {/* CTA hint — only when no custom children action */}
      {!children && cta && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: "10px 0 0", opacity: 0.65 }}>
          {arrowUp ? "↑" : "↓"} {cta}
        </p>
      )}
    </div>
  );
}

const finishBtn: React.CSSProperties = {
  marginTop: 14, width: "100%", padding: "10px",
  background: "var(--accent)", border: "none", color: "#000",
  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
};

const skipStepBtn: React.CSSProperties = {
  marginTop: 12, width: "100%", padding: "10px",
  background: "transparent", border: "1px solid var(--border)", color: "var(--muted)",
  fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer",
};
