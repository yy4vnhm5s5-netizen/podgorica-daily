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

function createSeaWaterQualityLocationBreadcrumbStructuredData({
  city,
  locationName,
  slug,
}: {
  city: City;
  locationName: string;
  slug: string;
}): SeaWaterQualityLocationBreadcrumbStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        item: new URL(getCityPath(city), siteConfig.url).toString(),
        name: city.name,
        position: 1,
      },
      {
        "@type": "ListItem",
        item: new URL(getSeaWaterQualityPath(city), siteConfig.url).toString(),
        name: "Plaže i kvalitet mora",
        position: 2,
      },
      {
        "@type": "ListItem",
        item: new URL(getSeaWaterQualityLocationPath(city, slug), siteConfig.url).toString(),
        name: locationName,
        position: 3,
      },
    ],
  };
}

function serializeSeaWaterQualityStructuredData(
  value: SeaWaterQualityLocationBreadcrumbStructuredData,
) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export {
  createSeaWaterQualityLocationBreadcrumbStructuredData,
  serializeSeaWaterQualityStructuredData,
  type SeaWaterQualityLocationBreadcrumbStructuredData,
};
