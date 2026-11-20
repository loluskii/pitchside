import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pitchside",
    short_name: "Pitchside",
    description: "Live betting and casino. Play money only.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F1EC",
    theme_color: "#121A16",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
