"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Notification, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeIcon(type: Notification["type"]): string {
  if (type === "settlement") return "★";
  if (type === "chat") return "↗";
  return "↕";
}

export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.is_read).length;

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    api.notifications().then(ns => { setNotifs(ns); setLoaded(true); }).catch(() => {});
  }, [user]);

  // Real-time via WS
  useEffect(() => {
    if (!user) return;
    const unsub = connectWS((e: WSEvent) => {
      if (e.type === "notification" && e.user_id === user.user_id) {
        setNotifs(prev => [e.notification, ...prev]);
      }
    });
    return unsub;
  }, [user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    setOpen(o => !o);
    if (!open && unread > 0) {
      // Optimistically mark read locally
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      api.markNotificationsRead().catch(() => {});
    }
  }

  function handleNotifClick(n: Notification) {
    setOpen(false);
    if (n.market_id) router.push(`/markets/${n.market_id}`);
  }

  if (!user) return null;

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 4px",
          color: open ? "var(--text)" : "var(--muted)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          lineHeight: 1,
        }}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: 4,
            right: 0,
            minWidth: 16,
            height: 16,
            background: "var(--text)",
            color: "var(--canvas)",
            borderRadius: 8,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 300,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: 400,
          overflowY: "auto",
          background: "#141414",
          border: "1px solid var(--border)",
          borderRadius: 8,
          zIndex: 200,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: "0.05em",
          }}>
            NOTIFICATIONS
          </div>

          {!loaded && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              loading...
            </div>
          )}

          {loaded && notifs.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              nothing yet
            </div>
          )}

          {notifs.map(n => (
            <button
              key={n.id}
              onClick={() => handleNotifClick(n)}
              style={{
                width: "100%",
                background: n.is_read ? "none" : "rgba(255,255,255,0.03)",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: n.market_id ? "pointer" : "default",
                padding: "12px 16px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.4,
                  flex: 1,
                }}>
                  <span style={{ color: "var(--muted)", marginRight: 6 }}>{typeIcon(n.type)}</span>
                  {n.content}
                </span>
                {!n.is_read && (
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: "var(--text)",
                    flexShrink: 0,
                    marginTop: 5,
                  }} />
                )}
              </div>
              {n.market_title && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                  {n.market_title}
                </span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", opacity: 0.6 }}>
                {timeAgo(n.created_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
