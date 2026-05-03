import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: "#0A0A0A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          fontWeight: 900,
          fontSize: 19,
          color: "#D4FF00",
          letterSpacing: "-1px",
          marginTop: 1,
        }}
      >
        o.
      </span>
    </div>,
    { ...size },
  );
}
