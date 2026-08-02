import type { MetadataRoute } from "next";

import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { getCityEventsForPublicListing } from "@/modules/events/presentation/events-ui-model";
import { getSeaWaterQualityHistory } from "@/modules/sea-water-quality/application/get-sea-water-quality-history";
import {
  getAboutPlatformPath,
  getContactPath,
  getEventDetailPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
  getSeaWaterQualityLocationPath,
} from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import { getCitySitemapPaths, isCityPublicFeatureRouteAvailable } from "./city-routing.ts";

function createEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"],
  priority: number,
) {
  // No genuine last-modified timestamp exists for these routes (they are rendered from
  // live/cached provider data, not a tracked content revision), so lastModified is
  // intentionally omitted rather than stamped with the sitemap generation time — a fabricated
  // "just changed" date on every request misleads crawlers into treating stable pages as
  // freshly modified. changeFrequency conveys the update cadence instead.
  return {
    changeFrequency,
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
    createEntry("/", "weekly", 0.9),
    createEntry(getAboutPlatformPath(), "monthly", 0.5),
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
          return getCityEventsForPublicListing(events).map((event) => ({
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

  const seaWaterQualityEntries = await getSeaWaterQualitySitemapEntries(cities);

  return [...cityEntries, ...globalEntries, ...eventEntries.flat(), ...seaWaterQualityEntries];
}

async function getSeaWaterQualitySitemapEntries(
  cities = getActiveCities(),
  readHistory: typeof getSeaWaterQualityHistory = getSeaWaterQualityHistory,
): Promise<MetadataRoute.Sitemap> {
  const entries = await Promise.all(
    cities
      .filter((city) => isCityPublicFeatureRouteAvailable(city, "seaWaterQuality"))
      .map(async (city) => {
        try {
          const result = await readHistory(createCityContext(city.id, "me"));
          if (!result.history) return [];
          return result.history.locations.map((location) =>
            createEntry(
              getSeaWaterQualityLocationPath(city, location.canonicalSlug),
              "weekly",
              0.55,
            ),
          );
        } catch {
          return [];
        }
      }),
  );
  return entries.flat();
}

export { getSeaWaterQualitySitemapEntries };
