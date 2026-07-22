import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import type { Locale } from "../../../shared/config/locale.ts";
import { formatRelativeTime } from "../../../shared/lib/date.ts";

type PodgoricaFlightsDisplayState = "empty" | "flights" | "stale" | "unavailable";

function getPodgoricaFlightsDisplayState({
  flightCount,
  state,
}: {
  flightCount: number;
  state: FlightCacheState;
}): PodgoricaFlightsDisplayState {
  if (flightCount > 0) return state === "stale" ? "stale" : "flights";
  return state === "unavailable" ? "unavailable" : "empty";
}

function getPodgoricaFlightsUpdatedLabel({
  lastSuccessfulRefreshAt,
  locale,
  now = new Date(),
}: {
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  now?: Date;
}) {
  if (!lastSuccessfulRefreshAt) return undefined;

  const updatedAt = new Date(lastSuccessfulRefreshAt);
  if (Number.isNaN(updatedAt.getTime())) return undefined;

  return `${locale === "me" ? "Ažurirano" : "Updated"} ${formatRelativeTime(updatedAt, {
    locale,
    now,
  })}`;
}

export {
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
  type PodgoricaFlightsDisplayState,
};
