import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import "@/app/globals.css";
import { env } from "@/config/env";
import { ThemeScript } from "@/shared/components/theme/theme-script";
import { ThemeProvider } from "@/shared/components/theme/theme-provider";
import { siteConfig } from "@/shared/config/site";

export const metadata: Metadata = {
  description: siteConfig.description,
  title: siteConfig.name,
};

export default function RootLayout({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang="en" data-app-environment={env.NEXT_PUBLIC_APP_ENV} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
