import { env } from "@/config/env";

export const siteConfig = {
  description:
    "Pouzdane lokalne informacije za gradove Crne Gore — vrijeme, događaji, prevoz i servisne obavijesti na jednom mjestu.",
  homepageTitle: "Gradom.me | Sve o vašem gradu",
  logoMarkPath: "/brand/gradom-mark.svg",
  name: "Gradom.me",
  slogan: "Sve o vašem gradu.",
  url: env.NEXT_PUBLIC_SITE_URL ?? "https://gradom.me",
} as const;

function getPageTitle(pageTitle: string) {
  return `${pageTitle} | ${siteConfig.name}`;
}

export { getPageTitle };
