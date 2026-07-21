import type { MetadataRoute } from "next";

import { siteConfig } from "@/shared/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    host: siteConfig.url,
    rules: [
      { allow: "/", disallow: ["/api/"], userAgent: "*" },
      { disallow: "/", userAgent: "GPTBot" },
      { disallow: "/", userAgent: "Google-Extended" },
      { disallow: "/", userAgent: "ClaudeBot" },
      { disallow: "/", userAgent: "CCBot" },
      { disallow: "/", userAgent: "Bytespider" },
      { disallow: "/", userAgent: "Amazonbot" },
    ],
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
