import type { Metadata } from "next";

import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { AboutPlatformPage } from "@/modules/about/presentation/about-platform-page";
import { aboutPlatformContent } from "@/modules/about/presentation/about-platform-content";
import { getMainCity } from "@/shared/config/cities";
import { getAboutPlatformPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";

function generateMetadata(): Metadata {
  return createPublicRouteMetadata({
    canonical: getAboutPlatformPath(),
    description: aboutPlatformContent.metadataDescription,
    title: getPageTitle("O platformi"),
  });
}

function AboutPlatformRoute() {
  return <AboutPlatformPage city={getMainCity()} />;
}

export { generateMetadata };
export default AboutPlatformRoute;
