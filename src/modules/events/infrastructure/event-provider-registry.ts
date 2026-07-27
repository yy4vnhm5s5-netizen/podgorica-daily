import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { cnpEventProvider } from "./cnp-event-provider.ts";
import { cineplexxEventProvider } from "./cineplexx-event-provider.ts";
import { glavniGradEventProvider } from "./glavni-grad-event-provider.ts";
import { tourismEventProvider } from "./tourism-event-provider.ts";

// KIC is intentionally excluded: kic.podgorica.me has an expired TLS certificate and is no
// longer a reliable production source. The kic-* infrastructure is retained to re-enable later.
const eventProviderRegistry: readonly EventProvider[] = [
  cnpEventProvider,
  cineplexxEventProvider,
  glavniGradEventProvider,
  tourismEventProvider,
];

function getEnabledEventProviders(
  configuration: Pick<typeof env, "ENABLE_EVENTS" | "EVENT_PROVIDER_MODE"> = env,
) {
  if (!configuration.ENABLE_EVENTS || configuration.EVENT_PROVIDER_MODE !== "live") return [];
  return eventProviderRegistry;
}

export { eventProviderRegistry, getEnabledEventProviders };
