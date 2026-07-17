import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { kicEventProvider } from "./kic-event-provider.ts";

const eventProviderRegistry: readonly EventProvider[] = [kicEventProvider];

function getEnabledEventProviders() {
  if (!env.ENABLE_EVENTS || env.EVENT_PROVIDER_MODE === "disabled") return [];
  return eventProviderRegistry;
}

export { eventProviderRegistry, getEnabledEventProviders };
