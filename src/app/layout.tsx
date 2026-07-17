import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import "@/app/globals.css";
import { env } from "@/config/env";
import { ThemeScript } from "@/shared/components/theme/theme-script";
import { ThemeProvider } from "@/shared/components/theme/theme-provider";
import { getLocaleTag } from "@/shared/config/locale";
import { siteConfig } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const metadata: Metadata = {
  description: getTranslations("me").metadata.description,
  metadataBase: env.NEXT_PUBLIC_SITE_URL ? new URL(env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: siteConfig.name,
};

export default function RootLayout({ children }: Readonly<PropsWithChildren>) {
  return (
    <html
      lang={getLocaleTag("me")}
      data-app-environment={env.NEXT_PUBLIC_APP_ENV}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
