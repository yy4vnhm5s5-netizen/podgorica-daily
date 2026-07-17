import type { EventRecurrence, EventStatus } from "./event.ts";

interface EventTimeInput {
  endsAt?: string;
  explicitStatus?: "cancelled" | "postponed" | "scheduled";
  startDate?: string;
  startsAt?: string;
}

interface LocalDateTime {
  date: string;
  time?: string;
}

function getEventStatus(input: EventTimeInput, now = new Date()): EventStatus {
  if (input.explicitStatus === "cancelled" || input.explicitStatus === "postponed") {
    return input.explicitStatus;
  }

  if (!input.startsAt) return "scheduled";
  const start = new Date(input.startsAt);
  const end = input.endsAt ? new Date(input.endsAt) : start;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "scheduled";
  if (now.getTime() > end.getTime()) return "completed";
  return now.getTime() >= start.getTime() ? "active" : "scheduled";
}

function toZonedIso(local: LocalDateTime, timezone: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(local.date)) return undefined;
  if (!local.time || !/^\d{2}:\d{2}$/.test(local.time)) return undefined;

  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);
  const provisional = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimezoneOffset(provisional, timezone);
  const adjusted = provisional - firstOffset;
  const finalOffset = getTimezoneOffset(adjusted, timezone);
  return new Date(provisional - finalOffset).toISOString();
}

function getTimezoneOffset(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const zonedTimestamp = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return zonedTimestamp - timestamp;
}

function expandRecurrence(
  recurrence: EventRecurrence | undefined,
  start: Date,
  rangeStart: Date,
  rangeEnd: Date,
  maximumOccurrences: number,
) {
  if (!recurrence || recurrence.frequency === "oneTime" || recurrence.frequency === "custom") {
    return [start];
  }
  const occurrences: Date[] = [];
  const cursor = new Date(start);
  const until = recurrence.until ? new Date(recurrence.until) : rangeEnd;
  const dayIncrement = recurrence.frequency === "daily" ? 1 : 7;

  while (cursor <= rangeEnd && cursor <= until && occurrences.length < maximumOccurrences) {
    if (cursor >= rangeStart) occurrences.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + dayIncrement);
  }

  return occurrences;
}

export { expandRecurrence, getEventStatus, toZonedIso, type EventTimeInput, type LocalDateTime };
