"use client";
import { useEffect, useRef } from "react";
import { drawToken, TokenKey } from "@/lib/tokens";

interface Props {
  tokenKey: TokenKey;
  size?: number;
  className?: string;
}

export default function Token({ tokenKey, size = 32, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawToken(ctx, tokenKey, size);
  }, [tokenKey, size]);

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
