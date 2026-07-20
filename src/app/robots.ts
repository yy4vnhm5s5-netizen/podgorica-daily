import type { MetadataRoute } from "next";

import { siteConfig } from "@/shared/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    host: siteConfig.url,
    rules: {
      allow: "/",
      disallow: ["/api/"],
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
