import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { cnpEventProvider } from "./cnp-event-provider.ts";
import { glavniGradEventProvider } from "./glavni-grad-event-provider.ts";
import { tourismEventProvider } from "./tourism-event-provider.ts";
import { kicEventProvider } from "./kic-event-provider.ts";

const eventProviderRegistry: readonly EventProvider[] = [
  cnpEventProvider,
  glavniGradEventProvider,
  tourismEventProvider,
  kicEventProvider,
];

function getEnabledEventProviders(
  configuration: Pick<typeof env, "ENABLE_EVENTS" | "EVENT_PROVIDER_MODE"> = env,
) {
  if (!configuration.ENABLE_EVENTS || configuration.EVENT_PROVIDER_MODE !== "live") return [];
  return eventProviderRegistry;
}

export { eventProviderRegistry, getEnabledEventProviders };
