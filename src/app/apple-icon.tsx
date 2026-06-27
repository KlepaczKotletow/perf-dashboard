import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon (iOS "Add to Home Screen"). Same Nami wordmark on brand
// cream; iOS rounds the corners automatically.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f2ea",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            fontSize: 70,
            fontWeight: 900,
            color: "#15151b",
            letterSpacing: "-0.06em",
          }}
        >
          Nami
        </span>
      </div>
    ),
    { ...size },
  );
}
