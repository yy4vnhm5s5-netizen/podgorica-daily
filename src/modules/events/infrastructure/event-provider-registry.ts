import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";

const eventProviderRegistry: readonly EventProvider[] = [];

function getEnabledEventProviders() {
  if (!env.ENABLE_EVENTS || env.EVENT_PROVIDER_MODE === "disabled") return [];
  return eventProviderRegistry;
}

export { eventProviderRegistry, getEnabledEventProviders };
