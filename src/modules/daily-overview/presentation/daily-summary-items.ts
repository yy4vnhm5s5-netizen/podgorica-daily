interface DailySummaryAvailability {
  cinema: boolean;
  events: boolean;
  goingOut: boolean;
  seaWaterQuality: boolean;
}

type DailySummaryItemId = "cinema" | "events" | "goingOut" | "seaWaterQuality" | "weather";

function getDailySummaryItemIds({
  cinema,
  events,
  goingOut,
  seaWaterQuality,
}: DailySummaryAvailability) {
  return [
    "weather",
    ...(goingOut ? ["goingOut"] : []),
    ...(events ? ["events"] : []),
    ...(cinema ? ["cinema"] : []),
    ...(seaWaterQuality ? ["seaWaterQuality"] : []),
  ] as DailySummaryItemId[];
}

export { getDailySummaryItemIds, type DailySummaryAvailability, type DailySummaryItemId };
