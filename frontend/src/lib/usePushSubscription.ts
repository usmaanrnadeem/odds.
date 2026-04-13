"use client";
import { useEffect } from "react";
import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Register the SW silently. Call this on load — no permission needed. */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

/** Returns true if already subscribed (no prompt needed). */
export async function isSubscribed(): Promise<boolean> {
  const reg = await registerSW();
  if (!reg) return false;
  const existing = await reg.pushManager.getSubscription();
  return !!existing;
}

/**
 * Request permission + subscribe. MUST be called from a user gesture (tap).
 * Returns true on success.
 */
export async function subscribePush(): Promise<boolean> {
  try {
    const reg = await registerSW();
    if (!reg) return false;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return true;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const { public_key } = await api.vapidPublicKey();
    if (!public_key) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    });

    await api.subscribePush(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
    return true;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return false;
  }
}

/** Register SW on load (no permission prompt). */
export function usePushSubscription(enabled: boolean) {
  useEffect(() => {
    if (enabled) registerSW();
  }, [enabled]);
}
