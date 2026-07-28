import { env } from "../../../config/env.ts";
import type { EventProvider } from "../domain/event.ts";
import { cnpEventProvider } from "./cnp-event-provider.ts";
import { cineplexxEventProvider } from "./cineplexx-event-provider.ts";
import { glavniGradEventProvider } from "./glavni-grad-event-provider.ts";
import { tivatTourismEventProvider } from "./tivat-tourism-event-provider.ts";
import { tourismEventProvider } from "./tourism-event-provider.ts";

// KIC is intentionally excluded: kic.podgorica.me has an expired TLS certificate and is no
// longer a reliable production source. The kic-* infrastructure is retained to re-enable later.
// Each provider self-filters by supportedCityIds (see isCitySupportedByProvider), so registering
// tivatTourismEventProvider here does not affect what Podgorica or Budva requests return, the
// same way tourismEventProvider (Podgorica-only) never affects Tivat's.
const eventProviderRegistry: readonly EventProvider[] = [
  cnpEventProvider,
  cineplexxEventProvider,
  glavniGradEventProvider,
  tivatTourismEventProvider,
  tourismEventProvider,
];

function getEnabledEventProviders(
  configuration: Pick<typeof env, "ENABLE_EVENTS" | "EVENT_PROVIDER_MODE"> = env,
) {
  if (!configuration.ENABLE_EVENTS || configuration.EVENT_PROVIDER_MODE !== "live") return [];
  return eventProviderRegistry;
}

export { eventProviderRegistry, getEnabledEventProviders };
