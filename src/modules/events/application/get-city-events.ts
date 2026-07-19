import { deduplicateEvents } from "../domain/event-deduplication.ts";
import { createEventSlug } from "../domain/event-normalization.ts";
import type { CityEvent, EventProvider, EventProviderResult, Venue } from "../domain/event.ts";
import { getEnabledEventProviders } from "../infrastructure/event-provider-registry.ts";
import { toEventProviderStatusReadModel } from "./event-provider-status.ts";
import { queryEvents } from "./query-events.ts";
import { getEventQualityHealthThresholds } from "../../../config/event-quality.ts";
import type { CityContext } from "@/shared/types/city";

interface CityEventsReadModel {
  events: readonly CityEvent[];
  providers: readonly EventProviderReadState[];
  venues: readonly Venue[];
}

interface EventProviderReadState {
  id: string;
  state: EventProviderResult["state"];
  status: ReturnType<typeof toEventProviderStatusReadModel>;
}

async function getCityEvents(
  context: CityContext,
  providers: readonly EventProvider[] = getEnabledEventProviders(),
): Promise<CityEventsReadModel> {
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        return { metadata: provider.metadata, result: await provider.getCachedEvents(context) };
      } catch {
        return {
          metadata: provider.metadata,
          result: { events: [], parserWarnings: [], state: "unavailable" as const, venues: [] },
        };
      }
    }),
  );
  const events = results
    .flatMap(({ result }) => result.events)
    .filter((event) => event.cityIds.includes(context.city.id))
    .map((event) => ({ ...event, slug: event.slug ?? createEventSlug(event.title) }));

  return {
    events: queryEvents(deduplicateEvents(events), context),
    providers: results.map(({ metadata, result }) => ({
      id: metadata.id,
      state: result.state,
      status: toEventProviderStatusReadModel(
        {
          diagnostics: result.qualityDiagnostics,
          enabled: metadata.enabled,
          providerId: metadata.id,
          providerName: metadata.displayName,
          result,
        },
        getEventQualityHealthThresholds(),
      ),
    })),
    venues: results.flatMap(({ result }) => result.venues),
  };
}

export { getCityEvents, type CityEventsReadModel, type EventProviderReadState };
