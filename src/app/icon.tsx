import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Favicon / app icon — the Nami wordmark in the brand cream + ink. Generated
// with the same ImageResponse pipeline as the OG card so the type rasterises
// reliably (no web-font fetch needed). Next emits the <link rel="icon">.
export default function Icon() {
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
            fontSize: 196,
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
