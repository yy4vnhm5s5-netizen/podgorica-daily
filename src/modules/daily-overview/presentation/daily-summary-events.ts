type DailyEventsSummary =
  | { count: number; status: "available" }
  | { status: "unavailable" };

function getDailyEventsSummary(eventsToday: number | undefined): DailyEventsSummary {
  return eventsToday === undefined
    ? { status: "unavailable" }
    : { count: eventsToday, status: "available" };
}

export { getDailyEventsSummary, type DailyEventsSummary };
