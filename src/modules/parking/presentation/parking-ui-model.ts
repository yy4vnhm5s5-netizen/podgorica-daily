import type { Locale } from "@/shared/config/locale";
import { formatRelativeTime } from "@/shared/lib/date";

import type {
  ParkingLocationReadModel,
  ParkingLocationType,
} from "../domain/parking-availability.ts";
import { formatBcsCount } from "@/shared/lib/pluralize";

interface ParkingSection {
  locations: readonly ParkingLocationReadModel[];
  type: ParkingLocationType;
}

interface ParkingDashboardLocation extends ParkingLocationReadModel {
  freeSpaces: number;
}

interface ParkingDashboardSummary {
  locations: readonly ParkingDashboardLocation[];
  summaryLabel?: string;
}

function getParkingAvailabilityLabel(
  location: ParkingLocationReadModel,
  locale: Locale,
  now = new Date(),
) {
  if (
    location.availabilityState !== "fresh" ||
    location.freeSpaces === undefined ||
    !location.sourceUpdatedAt
  ) {
    return { state: "unavailable" as const };
  }

  return {
    freeSpaces: location.freeSpaces,
    state: "fresh" as const,
    updatedLabel: `${locale === "me" ? "Ažurirano" : "Updated"} ${formatRelativeTime(
      new Date(location.sourceUpdatedAt),
      { locale, now },
    )}`,
  };
}

function getParkingSections(locations: readonly ParkingLocationReadModel[]): ParkingSection[] {
  return (["parking", "garage"] as const).flatMap((type) => {
    const sectionLocations = locations.filter((location) => location.type === type);
    return sectionLocations.length > 0 ? [{ locations: sectionLocations, type }] : [];
  });
}

// The application read model already removes every stale, missing, invalid, and rejected source
// record. This selector only chooses the most useful three of those publishable locations; it
// deliberately owns no timestamp or freshness policy of its own.
function getParkingDashboardSummary(
  locations: readonly ParkingLocationReadModel[],
): ParkingDashboardSummary {
  const publishableLocations = locations.filter(
    (location): location is ParkingDashboardLocation => typeof location.freeSpaces === "number",
  );
  const topLocations = publishableLocations
    .map((location, catalogueIndex) => ({ catalogueIndex, location }))
    .sort(
      (left, right) =>
        right.location.freeSpaces - left.location.freeSpaces ||
        left.catalogueIndex - right.catalogueIndex,
    )
    .slice(0, 3)
    .map(({ location }) => location);

  return {
    locations: topLocations,
    ...(publishableLocations.length > 0
      ? {
          summaryLabel: `Aktuelni podaci za ${formatBcsCount(
            publishableLocations.length,
            "lokaciju",
            "lokacije",
            "lokacija",
          )}`,
        }
      : {}),
  };
}

export {
  getParkingAvailabilityLabel,
  getParkingDashboardSummary,
  getParkingSections,
  type ParkingDashboardLocation,
  type ParkingDashboardSummary,
  type ParkingSection,
};
