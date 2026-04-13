"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth";
import { usePushSubscription, isSubscribed, subscribePush } from "@/lib/usePushSubscription";

const DISMISSED_KEY = "push_prompt_dismissed";

export default function PushSetup() {
  const { user } = useUser();
  const [show, setShow] = useState(false);

  usePushSubscription(!!user);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("PushManager" in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (Notification.permission !== "default") return; // already granted or denied

    // Check if already subscribed
    isSubscribed().then(subscribed => {
      if (!subscribed) setShow(true);
    });
  }, [user]);

  async function handleEnable() {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
    await subscribePush();
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 40px)",
      maxWidth: 440,
      background: "#1a1a1a",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      zIndex: 300,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
        get notified when friends trade or chat
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          background: "none", border: "1px solid var(--border)", borderRadius: 6,
          padding: "6px 10px", fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--muted)", cursor: "pointer",
        }}>
          no thanks
        </button>
        <button onClick={handleEnable} style={{
          background: "var(--text)", border: "none", borderRadius: 6,
          padding: "6px 10px", fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--canvas)", cursor: "pointer", fontWeight: 700,
        }}>
          enable
        </button>
      </div>
    </div>
  );
}
