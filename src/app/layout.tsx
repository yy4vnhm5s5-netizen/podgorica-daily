import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import type { PropsWithChildren } from "react";

import "@/app/globals.css";
import { env } from "@/config/env";
import { getLocaleTag } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

// Restrained editorial display face for major page anchors only (see `font-display` in
// tailwind.config.ts and the `accent`-gated usage in SectionTitle) — everything else in the app
// stays on the system sans stack. `latin-ext` is required for Montenegrin/Serbian Latin
// characters (č, ć, š, ž, đ). Self-hosted at build time via next/font, so there is no runtime
// request to a third-party font CDN and no font-swap layout shift beyond what next/font already
// mitigates automatically. A single static weight (600) is loaded to keep this lean — it matches
// the `font-semibold` weight already used on every heading in the app.
const sourceSerif4 = Source_Serif_4({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  weight: ["600"],
});

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
  },
  applicationName: siteConfig.name,
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
    <html
      className={sourceSerif4.variable}
      lang={getLocaleTag("me")}
      data-app-environment={env.NEXT_PUBLIC_APP_ENV}
    >
      <body>
        {children}
        <Script
          data-website-id="3bcc8064-0d52-4b16-b79c-82256e9b3c57"
          id="umami-analytics"
          src="https://cloud.umami.is/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
