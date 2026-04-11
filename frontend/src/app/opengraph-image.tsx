import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontWeight: 700,
            fontSize: 160,
            color: "#D4FF00",
            lineHeight: 1,
          }}
        >
          odds.
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 32,
            color: "#666",
            marginTop: 24,
          }}
        >
          prediction markets for your friend group
        </div>
      </div>
    ),
    size
  );
}
