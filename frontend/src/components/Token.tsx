"use client";
import { useEffect, useRef } from "react";
import { drawToken, isCustomToken, TokenKey } from "@/lib/tokens";

interface Props {
  tokenKey: TokenKey;
  size?: number;
  className?: string;
}

export default function Token({ tokenKey, size = 32, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isCustomToken(tokenKey)) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawToken(ctx, tokenKey, size);
  }, [tokenKey, size]);

  if (isCustomToken(tokenKey)) {
    return (
      <img
        src={`/tokens/${tokenKey}.png`}
        width={size}
        height={size}
        alt={tokenKey.replace("p_", "")}
        className={className}
        style={{ display: "block", borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}
