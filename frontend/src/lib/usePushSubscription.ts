"use client";
import { useEffect } from "react";
import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function subscribe() {
      try {
        // Register SW
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check existing subscription
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Get VAPID public key
        const { public_key } = await api.vapidPublicKey();
        if (!public_key) return;

        // Subscribe
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key),
        });

        // Send to backend
        await api.subscribePush(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      } catch (err) {
        console.warn("Push subscription failed:", err);
      }
    }

    subscribe();
  }, [enabled]);
}
