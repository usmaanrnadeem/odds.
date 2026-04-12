import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontWeight: 700,
            fontSize: 192,
            color: "#D4FF00",
            letterSpacing: "-4px",
          }}
        >
          odds.
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
