import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime, formatRelativeTime } from "@/shared/lib/date";

import type { ParkingLocationReadModel } from "../domain/parking-availability.ts";

type ParkingAvailabilityLabel =
  | {
      freeSpaces: number;
      state: "fresh";
      updatedLabel: string;
    }
  | {
      lastReportedLabel: string;
      sourceLabel: string;
      state: "stale";
    }
  | {
      state: "unavailable";
    };

function getParkingAvailabilityLabel(
  location: ParkingLocationReadModel,
  locale: Locale,
  now = new Date(),
): ParkingAvailabilityLabel {
  if (location.freeSpaces === undefined || !location.sourceUpdatedAt) {
    return { state: "unavailable" as const };
  }

  if (location.availabilityState === "fresh") {
    return {
      freeSpaces: location.freeSpaces,
      state: "fresh",
      updatedLabel: `${locale === "me" ? "Ažurirano" : "Updated"} ${formatRelativeTime(
        new Date(location.sourceUpdatedAt),
        { locale, now },
      )}`,
    };
  }

  if (location.availabilityState === "stale") {
    const sourceDate = formatDateTime(new Date(location.sourceUpdatedAt), {
      formatOptions: { day: "numeric", month: "long", year: "numeric" },
      locale: getLocaleTag(locale),
    }).label;

    return {
      lastReportedLabel:
        locale === "me"
          ? `Posljednje prijavljeno: ${location.freeSpaces} slobodnih mjesta`
          : `Last reported: ${location.freeSpaces} free spaces`,
      sourceLabel: `${locale === "me" ? "Izvorni podatak" : "Source data"}: ${sourceDate}`,
      state: "stale",
    };
  }

  return { state: "unavailable" };
}

export { getParkingAvailabilityLabel, type ParkingAvailabilityLabel };
