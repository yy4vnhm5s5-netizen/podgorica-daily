import type { MetadataRoute } from "next";

import { getDefaultCityContext } from "@/config/city-context";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { locales } from "@/shared/config/locale";
import { getContactPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";

const stablePaths = ["", "/events"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stableEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    stablePaths.map((path) => ({
      changeFrequency: path ? ("daily" as const) : ("hourly" as const),
      lastModified: new Date(),
      priority: path ? 0.8 : 1,
      url: new URL(`/${locale}${path}`, siteConfig.url).toString(),
    })),
  );
  const contactEntries: MetadataRoute.Sitemap = locales.map((locale) => ({
    changeFrequency: "monthly",
    priority: 0.5,
    url: new URL(getContactPath(locale), siteConfig.url).toString(),
  }));

  const eventEntries = await Promise.all(
    locales.map(async (locale) => {
      try {
        const { events } = await getCityEvents(getDefaultCityContext(locale));
        return events.map((event) => ({
          changeFrequency: "weekly" as const,
          lastModified: event.sourceUpdatedAt ? new Date(event.sourceUpdatedAt) : undefined,
          priority: 0.6,
          url: new URL(
            `/${locale}/events/${encodeURIComponent(event.id)}`,
            siteConfig.url,
          ).toString(),
        }));
      } catch {
        return [];
      }
    }),
  );

  return [...stableEntries, ...contactEntries, ...eventEntries.flat()];
}
