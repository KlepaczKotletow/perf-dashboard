import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Nami — Performance Management in Slack";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic Open Graph card. Used automatically by Next.js for the root route
// and inherited by any page that doesn't define its own `opengraph-image`.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #fafaf5 0%, #f8f6f0 50%, #fefcf5 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "#1a1a2e",
              letterSpacing: "-0.025em",
            }}
          >
            Nami
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <span
            style={{
              fontSize: 84,
              fontWeight: 800,
              color: "#1a1a2e",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              maxWidth: 1000,
            }}
          >
            Performance management,
            <br />
            in Slack.
          </span>
          <span
            style={{
              fontSize: 30,
              color: "rgba(26,26,46,0.65)",
              maxWidth: 940,
              lineHeight: 1.35,
            }}
          >
            360° reviews, OKRs, pulse surveys, and continuous feedback —
            without a new tool.
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "rgba(26,26,46,0.5)",
          }}
        >
          <span>namihr.com</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(26,26,46,0.06)",
              border: "1px solid rgba(26,26,46,0.1)",
              fontSize: 20,
              fontWeight: 600,
              color: "#1a1a2e",
            }}
          >
            Add to Slack
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
