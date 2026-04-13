"use client";
import { useUser } from "@/lib/auth";
import { usePushSubscription } from "@/lib/usePushSubscription";

export default function PushSetup() {
  const { user } = useUser();
  usePushSubscription(!!user);
  return null;
}
