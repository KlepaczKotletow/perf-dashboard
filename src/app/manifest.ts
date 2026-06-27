import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Keeps mobile share previews / "Add to Home
// Screen" tidy on iOS and Android, and gives crawlers a structured product
// description.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nami — Performance Management in Slack",
    short_name: "Nami",
    description:
      "Modern performance management powered by Slack. Run 360° reviews, track competencies, set goals, and give continuous feedback — without leaving Slack.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // Matches --primary (Warm Indigo) for system UI tinting.
    theme_color: "#3a4cb5",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "any" },
    ],
  };
}
