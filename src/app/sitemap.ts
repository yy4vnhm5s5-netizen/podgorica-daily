import type { MetadataRoute } from "next";

import { createCityContext, getActiveCities } from "@/shared/config/cities";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { isEventSitemapEligible } from "@/modules/events/domain/event-lifecycle";
import type { SeaWaterQualityHistoryLocation } from "@/modules/sea-water-quality/domain/sea-water-quality";
import { getCityEventsForPublicListing } from "@/modules/events/presentation/events-ui-model";
import { getFuelPrices } from "@/modules/fuel/infrastructure/gov-me-fuel-prices";
import { getSeaWaterQualityHistory } from "@/modules/sea-water-quality/application/get-sea-water-quality-history";
import {
  getAboutPlatformPath,
  getContactPath,
  getEventDetailPath,
  getFuelPricesPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
  getSeaWaterQualityLocationPath,
} from "@/shared/config/public-routes";
import { isFeatureEnabled } from "@/shared/config/features";
import { siteConfig } from "@/shared/config/site";
import { getCitySitemapPaths, isCityPublicFeatureRouteAvailable } from "./city-routing.ts";

// `sitemap.ts` is a Next.js metadata route: without a route segment config it is prerendered
// during `next build` and cached. That is wrong here, because the sitemap is derived entirely from
// runtime snapshots on the persistent volume (RUNTIME_DATA_DIR, /app/.runtime in production) and
// Railway builds the image WITHOUT that volume mounted — so a build-time render always sees an
// empty beach/event inventory.
//
// This must be `force-dynamic` rather than a revalidate window. A window (e.g. `revalidate = 3600`)
// still emits a build-time prerender and serves it as the initial payload, so *every* deployment
// would re-bake the empty inventory and hide runtime-derived URLs until the window expired —
// turning a one-off into a recurring per-deploy regression. Forcing dynamic rendering removes the
// build-time artifact entirely: every request reads the current local snapshots, so a refresh or
// backfill is visible immediately and a deploy never erases URLs. Generation stays local-only
// (~8 file reads, crawler-only traffic) and must never issue an upstream request.
export const dynamic = "force-dynamic";

function createEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"],
  priority: number,
) {
  // The base entry carries no lastModified: hub and listing routes are rendered from live/cached
  // provider data with no tracked content revision, and stamping them with the sitemap generation
  // time would be a fabricated "just changed" date on every request. changeFrequency conveys the
  // update cadence instead. Callers that *do* hold a verified per-URL timestamp — event details
  // via sourceUpdatedAt, beach details via the newest sampling date — add it on top.
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
    // One evergreen national URL. lastModified is the effective date of the newest official
    // calculation — a real content-change fact published by the ministry, matching the beach
    // detail convention of using the source's own date rather than the collector's run time.
    ...(await getFuelSitemapEntry()),
    createEntry(getContactPath(), "monthly", 0.5),
    createEntry(getTermsOfUsePath(), "yearly", 0.3),
    createEntry(getPrivacyPolicyPath(), "yearly", 0.3),
  ];
  // One reference instant for the whole document, so two cities can never land on opposite sides
  // of a midnight boundary within a single sitemap response.
  const now = new Date();
  const eventEntries = await Promise.all(
    cities
      // The same public-route availability rule the events listing path itself is gated on, so a
      // detail URL can never be advertised for a city whose /dogadjaji route does not exist. Using
      // the shared helper rather than a bare capability check also means any future feature gating
      // of `events` applies here automatically instead of silently missing the sitemap.
      .filter((city) => isCityPublicFeatureRouteAvailable(city, "events"))
      .map(async (city) => {
        try {
          const context = createCityContext(city.id, "me");
          const { events } = await getCityEvents(context);
          // Explicit lifecycle rule rather than "whatever the snapshot happens to hold": promote
          // upcoming and ongoing events, keep a just-ended event briefly so crawlers re-read the
          // page now that it says the event is over, and drop older ones. Undatable events are
          // never promoted. The detail URLs stay resolvable either way — leaving the sitemap is
          // not a 404 (see event-lifecycle.ts).
          return getCityEventsForPublicListing(events)
            .filter((event) => isEventSitemapEligible(event, { now, timezone: context.timezone }))
            .map((event) => ({
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

function getLatestSamplingDate(location: SeaWaterQualityHistoryLocation) {
  const newest = [...location.measurements]
    .sort((left, right) => left.sourceRound - right.sourceRound)
    .reverse()
    .find(({ samplingDate }) => samplingDate !== undefined)?.samplingDate;
  if (!newest || !/^\d{4}-\d{2}-\d{2}$/.test(newest)) return undefined;
  const parsed = new Date(`${newest}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
          return result.history.locations.map((location) => {
            const lastModified = getLatestSamplingDate(location);
            return {
              ...createEntry(
                getSeaWaterQualityLocationPath(city, location.canonicalSlug),
                "weekly",
                0.55,
              ),
              // A beach detail page's entire content is its measurement history, so the newest
              // sampling date IS the date that content last changed — a verified per-location fact,
              // never build time, request time or a collector run. `samplingDate` is a plain ISO
              // calendar date, so it is anchored at UTC midnight for a deterministic Date; the
              // freeform `samplingDateTime` display string is deliberately not parsed. Points with
              // no dated measurement get no lastModified rather than a fabricated one.
              ...(lastModified ? { lastModified } : {}),
            };
          });
        } catch {
          return [];
        }
      }),
  );
  return entries.flat();
}

export { getSeaWaterQualitySitemapEntries };

async function getFuelSitemapEntry(
  readFuelPrices: typeof getFuelPrices = getFuelPrices,
  enabled = isFeatureEnabled("fuelPrices"),
): Promise<MetadataRoute.Sitemap> {
  // A disabled feature contributes no URL, so the sitemap never advertises a page that 404s.
  if (!enabled) return [];
  const entry = createEntry(getFuelPricesPath(), "weekly", 0.6);
  try {
    const { calculations } = await readFuelPrices();
    const effectiveDate = calculations[0]?.effectiveDate;
    if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return [entry];
    const lastModified = new Date(`${effectiveDate}T00:00:00.000Z`);
    return [Number.isNaN(lastModified.getTime()) ? entry : { ...entry, lastModified }];
  } catch {
    return [entry];
  }
}

export { getFuelSitemapEntry };
