import type { City } from "@/shared/types/city";
import {
  getCityPath,
  getSeaWaterQualityLocationPath,
  getSeaWaterQualityPath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";

interface SeaWaterQualityLocationBreadcrumbStructuredData {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    item: string;
    name: string;
    position: number;
  }>;
}

interface SeaWaterQualityBreadcrumbStep {
  href: string;
  name: string;
  url: string;
}

// One source of truth for the trail: city → beach listing → this monitoring location. Both the
// visible breadcrumb and the BreadcrumbList JSON-LD are built from it, so the two can never drift
// apart. `href` is the app-relative path the visible nav links to; `url` is the absolute form
// schema.org requires.
function getSeaWaterQualityLocationBreadcrumbTrail({
  city,
  locationName,
  slug,
}: {
  city: City;
  locationName: string;
  slug: string;
}): SeaWaterQualityBreadcrumbStep[] {
  return [
    { href: getCityPath(city), name: city.name },
    { href: getSeaWaterQualityPath(city), name: "Plaže i kvalitet mora" },
    { href: getSeaWaterQualityLocationPath(city, slug), name: locationName },
  ].map((step) => ({ ...step, url: new URL(step.href, siteConfig.url).toString() }));
}

function createSeaWaterQualityLocationBreadcrumbStructuredData(input: {
  city: City;
  locationName: string;
  slug: string;
}): SeaWaterQualityLocationBreadcrumbStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: getSeaWaterQualityLocationBreadcrumbTrail(input).map((step, index) => ({
      "@type": "ListItem" as const,
      item: step.url,
      name: step.name,
      position: index + 1,
    })),
  };
}

function serializeSeaWaterQualityStructuredData(
  value: SeaWaterQualityLocationBreadcrumbStructuredData,
) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export {
  createSeaWaterQualityLocationBreadcrumbStructuredData,
  getSeaWaterQualityLocationBreadcrumbTrail,
  serializeSeaWaterQualityStructuredData,
  type SeaWaterQualityBreadcrumbStep,
  type SeaWaterQualityLocationBreadcrumbStructuredData,
};
