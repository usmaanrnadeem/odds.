import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "odds.",
    short_name: "odds.",
    description: "Prediction markets for your friend group",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
