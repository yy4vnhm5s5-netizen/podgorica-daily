import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import "@/app/globals.css";
import { env } from "@/config/env";
import { getLocaleTag } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
  },
  applicationName: siteConfig.name,
  alternates: {
    canonical: siteConfig.url,
  },
  description: getTranslations("me").metadata.description,
  icons: {
    apple: [{ sizes: "180x180", type: "image/png", url: "/apple-touch-icon.png" }],
    icon: [
      { url: "/favicon.ico" },
      { sizes: "any", type: "image/svg+xml", url: "/favicon.svg" },
      { sizes: "16x16", type: "image/png", url: "/favicon-16x16.png" },
      { sizes: "32x32", type: "image/png", url: "/favicon-32x32.png" },
    ],
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: getTranslations("me").metadata.description,
    images: [{ height: 675, url: "/og-image.png", width: 1200 }],
    locale: "sr_Latn_ME",
    siteName: siteConfig.name,
    title: siteConfig.homepageTitle,
    type: "website",
    url: siteConfig.url,
  },
  title: {
    default: siteConfig.homepageTitle,
    template: `%s | ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    description: getTranslations("me").metadata.description,
    images: ["/og-image.png"],
    title: siteConfig.homepageTitle,
  },
};

export default function RootLayout({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang={getLocaleTag("me")} data-app-environment={env.NEXT_PUBLIC_APP_ENV}>
      <body>{children}</body>
    </html>
  );
}
