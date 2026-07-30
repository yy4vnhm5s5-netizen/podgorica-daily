import { env } from "@/config/env";

export const siteConfig = {
  homepageTitle: "Gradom | Sve o vašem gradu",
  logoMarkPath: "/brand/gradom-mark.svg",
  logoPath: "/logo.svg",
  logoWordmarkPath: "/brand/gradom-wordmark.svg",
  name: "Gradom",
  slogan: "Sve o vašem gradu.",
  url: env.NEXT_PUBLIC_SITE_URL ?? "https://gradom.me",
} as const;

function getPageTitle(pageTitle: string) {
  return `${pageTitle} | ${siteConfig.name}`;
}

export { getPageTitle };
