import type { MetadataRoute } from "next";

import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import {
  getContactPath,
  getEventDetailPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import { getCitySitemapPaths } from "./city-routing";

function createEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"],
  priority: number,
) {
  return {
    changeFrequency,
    lastModified: new Date(),
    priority,
    url: new URL(path, siteConfig.url).toString(),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = getActiveCities();
  const cityEntries = cities.flatMap((city) => {
    const paths = getCitySitemapPaths(city);
    const landingPath = paths[0];
    return paths.map((path) => {
      const priority = path === landingPath ? 1 : 0.7;
      const changeFrequency =
        path.endsWith("/dogadjaji") || path.endsWith("/izlasci") || path.endsWith("/filmovi")
          ? "daily"
          : path.endsWith("/letovi") || path === landingPath
            ? "hourly"
            : "daily";
      return createEntry(path, changeFrequency, priority);
    });
  });
  const globalEntries = [
    createEntry(getContactPath(), "monthly", 0.5),
    createEntry(getTermsOfUsePath(), "yearly", 0.3),
    createEntry(getPrivacyPolicyPath(), "yearly", 0.3),
  ];
  const eventEntries = await Promise.all(
    cities
      .filter((city) => supportsCityCapability(city, "events"))
      .map(async (city) => {
        try {
          const { events } = await getCityEvents(createCityContext(city.id, "me"));
          return events.map((event) => ({
            changeFrequency: "weekly" as const,
            lastModified: event.sourceUpdatedAt ? new Date(event.sourceUpdatedAt) : undefined,
            priority: 0.6,
            url: new URL(getEventDetailPath(city, event.id), siteConfig.url).toString(),
          }));
        } catch {
          return [];
        }
      }),
  );

  return [...cityEntries, ...globalEntries, ...eventEntries.flat()];
}
