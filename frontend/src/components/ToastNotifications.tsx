"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { connectWS, WSEvent } from "@/lib/api";
import { useUser } from "@/lib/auth";

type Toast = {
  id: number;
  label: string;   // small caps tag e.g. "NEW MARKET"
  body: string;
  href: string;
  expiresAt: number;
};

const DURATION = 5000; // ms before auto-dismiss

let _nextId = 0;

export default function ToastNotifications() {
  const { user } = useUser();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id" | "expiresAt">) => {
    const id = _nextId++;
    setToasts(prev => [...prev.slice(-2), { ...t, id, expiresAt: Date.now() + DURATION }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), DURATION + 300);
  }, []);

  useEffect(() => {
    if (!user) return;
    const disconnect = connectWS((e: WSEvent) => {
      if (e.type === "market_created") {
        push({
          label: "NEW MARKET",
          body: e.title,
          href: `/markets/${e.market_id}`,
        });
      }
      if (e.type === "settlement") {
        push({
          label: "SETTLED",
          body: `${e.market_title} — ${e.settled_side ? "YES" : "NO"} won`,
          href: `/markets/${e.market_id}`,
        });
      }
    });
    return disconnect;
  }, [user, push]);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 16,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 300,
        width: "calc(100vw - 32px)",
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => { router.push(t.href); setToasts(prev => prev.filter(x => x.id !== t.id)); }}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "10px 12px 0",
              cursor: "pointer",
              animation: "toast-in 0.2s ease-out",
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            }}
          >
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--accent)", letterSpacing: "0.15em",
              margin: "0 0 4px",
            }}>
              {t.label}
            </p>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 12,
              color: "var(--text)", margin: "0 0 10px",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {t.body}
            </p>
            {/* Progress bar */}
            <div style={{ height: 2, background: "var(--border)", margin: "0 -12px" }}>
              <div style={{
                height: "100%",
                background: "var(--accent)",
                animation: `toast-shrink ${DURATION}ms linear forwards`,
              }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
