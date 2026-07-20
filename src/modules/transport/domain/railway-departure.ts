const podgoricaTimeZone = "Europe/Podgorica";

interface RailwayDeparture {
  arrivalTime?: string;
  departureDate: string;
  departureStation: "Podgorica";
  departureTime: string;
  destination: string;
  detailsUrl?: string;
  duration?: string;
  firstClassPrice?: string;
  secondClassPrice?: string;
  trainNumber?: string;
}

interface RailwayDepartureCandidate extends Omit<
  RailwayDeparture,
  "departureDate" | "departureStation"
> {
  departureDate: string;
  departureStation?: string;
}

function normalizeRailwayDeparture(
  candidate: RailwayDepartureCandidate,
): RailwayDeparture | undefined {
  const departureDate = candidate.departureDate.trim();
  const departureTime = candidate.departureTime.trim();
  const destination = candidate.destination.replace(/\s+/g, " ").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || !isTime(departureTime) || !destination) {
    return undefined;
  }

  return {
    ...(isTime(candidate.arrivalTime) ? { arrivalTime: candidate.arrivalTime } : {}),
    departureDate,
    departureStation: "Podgorica",
    departureTime,
    destination,
    ...(candidate.detailsUrl ? { detailsUrl: candidate.detailsUrl } : {}),
    ...(candidate.duration ? { duration: candidate.duration } : {}),
    ...(candidate.firstClassPrice ? { firstClassPrice: candidate.firstClassPrice } : {}),
    ...(candidate.secondClassPrice ? { secondClassPrice: candidate.secondClassPrice } : {}),
    ...(candidate.trainNumber ? { trainNumber: candidate.trainNumber } : {}),
  };
}

function sortAndDeduplicateRailwayDepartures(departures: readonly RailwayDeparture[]) {
  return [
    ...new Map(
      departures
        .slice()
        .sort((left, right) => departureKey(left).localeCompare(departureKey(right)))
        .map((departure) => [departureIdentity(departure), departure]),
    ).values(),
  ];
}

function selectUpcomingRailwayDepartures(
  departures: readonly RailwayDeparture[],
  now = new Date(),
  limit = 5,
) {
  const nowLocal = localDateAndTime(now);
  return sortAndDeduplicateRailwayDepartures(departures)
    .filter((departure) => `${departure.departureDate}T${departure.departureTime}` >= nowLocal)
    .slice(0, limit);
}

function departureIdentity(departure: RailwayDeparture) {
  return [
    departure.departureDate,
    departure.departureTime,
    departure.destination.toLocaleLowerCase(),
    departure.trainNumber ?? "",
  ].join("|");
}

function departureKey(departure: RailwayDeparture) {
  return `${departure.departureDate}T${departure.departureTime}|${departure.destination}`;
}

function localDateAndTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: podgoricaTimeZone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function isTime(value: string | undefined): value is string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour < 24 && minute < 60;
}

export {
  normalizeRailwayDeparture,
  selectUpcomingRailwayDepartures,
  sortAndDeduplicateRailwayDepartures,
  type RailwayDeparture,
  type RailwayDepartureCandidate,
};
