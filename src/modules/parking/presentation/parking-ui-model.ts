import type { Locale } from "@/shared/config/locale";
import { formatRelativeTime } from "@/shared/lib/date";

import type { ParkingLocationReadModel } from "../domain/parking-availability.ts";

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

export { getParkingAvailabilityLabel };
