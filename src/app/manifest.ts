import type { MetadataRoute } from "next";

function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#FFFFFF",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/android-chrome-192x192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/android-chrome-512x512.png",
        type: "image/png",
      },
    ],
    name: "Gradom",
    short_name: "Gradom",
    theme_color: "#2563EB",
  };
}

export default manifest;
