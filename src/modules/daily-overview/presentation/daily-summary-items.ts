interface DailySummaryAvailability {
  cinema: boolean;
  events: boolean;
  goingOut: boolean;
}

type DailySummaryItemId = "cinema" | "events" | "goingOut" | "weather";

function getDailySummaryItemIds({ cinema, events, goingOut }: DailySummaryAvailability) {
  return [
    "weather",
    ...(goingOut ? ["goingOut"] : []),
    ...(events ? ["events"] : []),
    ...(cinema ? ["cinema"] : []),
  ] as DailySummaryItemId[];
}

export { getDailySummaryItemIds, type DailySummaryAvailability, type DailySummaryItemId };
