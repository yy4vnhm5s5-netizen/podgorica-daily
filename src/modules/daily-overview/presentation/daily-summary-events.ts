type DailyEventsSummary =
  | { count: number; status: "today" }
  | { count: number; status: "upcoming" }
  | { status: "empty" }
  | { status: "unavailable" };

interface DailyEventsSummaryInput {
  isUnavailable: boolean;
  todayCount: number;
  upcomingCount: number;
}

function getDailyEventsSummary({
  isUnavailable,
  todayCount,
  upcomingCount,
}: DailyEventsSummaryInput): DailyEventsSummary {
  if (todayCount > 0) return { count: todayCount, status: "today" };
  if (upcomingCount > 0) return { count: upcomingCount, status: "upcoming" };
  if (isUnavailable) return { status: "unavailable" };
  return { status: "empty" };
}

export { getDailyEventsSummary, type DailyEventsSummary, type DailyEventsSummaryInput };
