import { env } from "@/config/env";

export const siteConfig = {
  logoPath: "/logo.svg",
  name: "Gradom",
  url: env.NEXT_PUBLIC_SITE_URL ?? "https://gradom.me",
} as const;
