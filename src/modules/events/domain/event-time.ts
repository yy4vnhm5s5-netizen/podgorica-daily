import type { EventRecurrence, EventStatus } from "./event.ts";
import { toZonedIso } from "@/shared/lib/date";

interface EventTimeInput {
  endsAt?: string;
  explicitStatus?: "cancelled" | "postponed" | "scheduled";
  startDate?: string;
  startsAt?: string;
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

export { expandRecurrence, getEventStatus, toZonedIso, type EventTimeInput };
