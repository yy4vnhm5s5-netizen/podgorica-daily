import type { MetadataRoute } from "next";

import { getDefaultCityContext } from "@/config/city-context";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import {
  getContactPath,
  getElectricityPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";

const stablePaths = ["/", "/dogadjaji"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stableEntries: MetadataRoute.Sitemap = stablePaths.map((path) => ({
    changeFrequency: path === "/" ? ("hourly" as const) : ("daily" as const),
    lastModified: new Date(),
    priority: path === "/" ? 1 : 0.8,
    url: new URL(path, siteConfig.url).toString(),
  }));
  const contactEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "monthly",
      priority: 0.5,
      url: new URL(getContactPath(), siteConfig.url).toString(),
    },
  ];
  const legalEntries: MetadataRoute.Sitemap = [getTermsOfUsePath(), getPrivacyPolicyPath()].map(
    (path) => ({
      changeFrequency: "yearly",
      priority: 0.3,
      url: new URL(path, siteConfig.url).toString(),
    }),
  );
  const electricityEntry: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      priority: 0.7,
      url: new URL(getElectricityPath(), siteConfig.url).toString(),
    },
  ];
  const flightsEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "hourly",
      priority: 0.7,
      url: new URL(getFlightsPath(), siteConfig.url).toString(),
    },
  ];
  const goingOutEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      priority: 0.7,
      url: new URL(getGoingOutPath(), siteConfig.url).toString(),
    },
  ];

  const eventEntries = await (async () => {
    try {
      const { events } = await getCityEvents(getDefaultCityContext("me"));
      return events.map((event) => ({
        changeFrequency: "weekly" as const,
        lastModified: event.sourceUpdatedAt ? new Date(event.sourceUpdatedAt) : undefined,
        priority: 0.6,
        url: new URL(`/dogadjaji/${encodeURIComponent(event.id)}`, siteConfig.url).toString(),
      }));
    } catch {
      return [];
    }
  })();

  return [
    ...stableEntries,
    ...contactEntries,
    ...legalEntries,
    ...electricityEntry,
    ...flightsEntries,
    ...goingOutEntries,
    ...eventEntries,
  ];
}
