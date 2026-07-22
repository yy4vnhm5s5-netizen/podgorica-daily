import { deduplicateEvents } from "./event-deduplication.ts";
import { isIsoDate, isIsoTimestamp, type CityEvent } from "./event.ts";
import type { CityId } from "@/shared/types/city";

type EventQualityStatus = "accepted" | "acceptedWithWarnings" | "rejected";
type EventQualityCode =
  | "date-only-event"
  | "duplicate-source-reference"
  | "end-before-start"
  | "excessively-future-event"
  | "excessively-old-event"
  | "invalid-city"
  | "invalid-date"
  | "missing-category"
  | "missing-description"
  | "missing-provenance"
  | "missing-source-url"
  | "missing-start-time"
  | "missing-title"
  | "missing-venue"
  | "no-city"
  | "stale-event"
  | "suspicious-title"
  | "unknown-category"
  | "unsupported-timezone";
type EventQualityRuleResult = { code: EventQualityCode; outcome: "error" | "pass" | "warning" };

interface EventQualityPolicy {
  countDropRatio: number;
  maximumFutureDays: number;
  maximumPastDays: number;
  minimumAcceptedScore: number;
  version: "1";
  warnOnMissingDescription: boolean;
  warnOnMissingStartTime: boolean;
  warnOnMissingVenue: boolean;
}

interface EventQualityResult {
  errors: EventQualityCode[];
  eventId?: string;
  ruleResults: EventQualityRuleResult[];
  score: number;
  sourceId: string;
  status: EventQualityStatus;
  warnings: EventQualityCode[];
}

interface EventQualityPipelineResult {
  accepted: CityEvent[];
  acceptedWithWarnings: CityEvent[];
  diagnostics: EventQualityDiagnostics;
  finalEvents: CityEvent[];
  rejected: EventQualityResult[];
}

interface EventQualityDiagnostics {
  acceptedCount: number;
  acceptedWithWarningsCount: number;
  candidatesDiscovered: number;
  countDropWarning: boolean;
  deduplicatedCount: number;
  finalEventCount: number;
  normalizedCount: number;
  previousSuccessfulEventCount?: number;
  qualityPolicyVersion: EventQualityPolicy["version"];
  qualityScoreDistribution: Record<"50to74" | "75to89" | "90to100" | "below50", number>;
  rejectedCount: number;
  rejectionCounts: Partial<Record<EventQualityCode, number>>;
  warningCounts: Partial<Record<EventQualityCode, number>>;
}

const defaultEventQualityPolicy: EventQualityPolicy = {
  countDropRatio: 0.5,
  maximumFutureDays: 366,
  maximumPastDays: 30,
  minimumAcceptedScore: 50,
  version: "1",
  warnOnMissingDescription: true,
  warnOnMissingStartTime: true,
  warnOnMissingVenue: true,
};

function assessEventQuality(
  event: CityEvent,
  validCityIds: readonly CityId[],
  policy: EventQualityPolicy = defaultEventQualityPolicy,
  now = new Date(),
): EventQualityResult {
  const errors: EventQualityCode[] = [];
  const warnings: EventQualityCode[] = [];
  const add = (code: EventQualityCode, outcome: "error" | "warning") =>
    (outcome === "error" ? errors : warnings).push(code);
  if (!event.title.trim()) add("missing-title", "error");
  if (!event.sourceUrl) add("missing-source-url", "error");
  if (!event.sourceReferences.length) add("missing-provenance", "error");
  if (!validCityIds.includes(event.cityId)) add("invalid-city", "error");
  if (event.timezone !== "Europe/Podgorica") add("unsupported-timezone", "error");
  if (!event.startsAt && !event.startDate) add("invalid-date", "error");
  if (event.startsAt && !isIsoTimestamp(event.startsAt)) add("invalid-date", "error");
  if (event.startDate && !isIsoDate(event.startDate)) add("invalid-date", "error");
  if (event.endsAt && !isIsoTimestamp(event.endsAt)) add("invalid-date", "error");
  if (event.startsAt && event.endsAt && new Date(event.endsAt) < new Date(event.startsAt))
    add("end-before-start", "error");
  if (event.category === "other") add("unknown-category", "warning");
  if (!event.description && policy.warnOnMissingDescription) add("missing-description", "warning");
  if (!event.venueId && !event.venueName && policy.warnOnMissingVenue)
    add("missing-venue", "warning");
  if (!event.startsAt && policy.warnOnMissingStartTime) add("missing-start-time", "warning");
  if (event.startDate && !event.startsAt) add("date-only-event", "warning");
  if (event.title.trim().length < 3) add("suspicious-title", "warning");
  const eventDate = event.startsAt ?? event.startDate;
  if (eventDate) {
    const eventTime = new Date(eventDate).getTime();
    if (!Number.isNaN(eventTime)) {
      const ageDays = (now.getTime() - eventTime) / 86_400_000;
      if (ageDays > policy.maximumPastDays) add("excessively-old-event", "error");
      if (-ageDays > policy.maximumFutureDays) add("excessively-future-event", "error");
      if (ageDays > 0 && event.status === "scheduled") add("stale-event", "warning");
    }
  }
  const duplicateReferences = new Set(
    event.sourceReferences.map(({ sourceId, sourceUrl }) => `${sourceId}|${sourceUrl}`),
  );
  if (duplicateReferences.size !== event.sourceReferences.length)
    add("duplicate-source-reference", "warning");
  const score = Math.max(0, 100 - errors.length * 30 - warnings.length * 5);
  const status: EventQualityStatus =
    errors.length || score < policy.minimumAcceptedScore
      ? "rejected"
      : warnings.length
        ? "acceptedWithWarnings"
        : "accepted";
  return {
    errors,
    eventId: event.id,
    ruleResults: [
      ...errors.map((code) => ({ code, outcome: "error" as const })),
      ...warnings.map((code) => ({ code, outcome: "warning" as const })),
    ],
    score,
    sourceId: event.sourceId,
    status,
    warnings,
  };
}

function runEventQualityPipeline({
  events,
  candidatesDiscovered,
  now,
  policy = defaultEventQualityPolicy,
  previousSuccessfulEventCount,
  validCityIds,
}: {
  candidatesDiscovered: number;
  events: readonly CityEvent[];
  now: Date;
  policy?: EventQualityPolicy;
  previousSuccessfulEventCount?: number;
  validCityIds: readonly CityId[];
}): EventQualityPipelineResult {
  const reports = events.map((event) => ({
    event,
    report: assessEventQuality(event, validCityIds, policy, now),
  }));
  const accepted = reports
    .filter(({ report }) => report.status === "accepted")
    .map(({ event }) => event);
  const acceptedWithWarnings = reports
    .filter(({ report }) => report.status === "acceptedWithWarnings")
    .map(({ event }) => event);
  const finalEvents = deduplicateEvents([...accepted, ...acceptedWithWarnings]);
  const rejected = reports
    .filter(({ report }) => report.status === "rejected")
    .map(({ report }) => report);
  const diagnostics = createDiagnostics({
    accepted,
    acceptedWithWarnings,
    candidatesDiscovered,
    finalEvents,
    policy,
    previousSuccessfulEventCount,
    rejected,
    reports,
  });
  return { accepted, acceptedWithWarnings, diagnostics, finalEvents, rejected };
}

function createDiagnostics({
  accepted,
  acceptedWithWarnings,
  candidatesDiscovered,
  finalEvents,
  policy,
  previousSuccessfulEventCount,
  rejected,
  reports,
}: {
  accepted: CityEvent[];
  acceptedWithWarnings: CityEvent[];
  candidatesDiscovered: number;
  finalEvents: CityEvent[];
  policy: EventQualityPolicy;
  previousSuccessfulEventCount?: number;
  rejected: EventQualityResult[];
  reports: { report: EventQualityResult }[];
}): EventQualityDiagnostics {
  const count = (codes: EventQualityCode[]) =>
    codes.reduce<Partial<Record<EventQualityCode, number>>>(
      (all, code) => ({ ...all, [code]: (all[code] ?? 0) + 1 }),
      {},
    );
  const scores = reports.map(({ report }) => report.score);
  return {
    acceptedCount: accepted.length,
    acceptedWithWarningsCount: acceptedWithWarnings.length,
    candidatesDiscovered,
    countDropWarning:
      previousSuccessfulEventCount !== undefined &&
      finalEvents.length < previousSuccessfulEventCount * policy.countDropRatio,
    deduplicatedCount: accepted.length + acceptedWithWarnings.length - finalEvents.length,
    finalEventCount: finalEvents.length,
    normalizedCount: reports.length,
    previousSuccessfulEventCount,
    qualityPolicyVersion: policy.version,
    qualityScoreDistribution: {
      "50to74": scores.filter((score) => score >= 50 && score < 75).length,
      "75to89": scores.filter((score) => score >= 75 && score < 90).length,
      "90to100": scores.filter((score) => score >= 90).length,
      below50: scores.filter((score) => score < 50).length,
    },
    rejectedCount: rejected.length,
    rejectionCounts: count(rejected.flatMap(({ errors }) => errors)),
    warningCounts: count(reports.flatMap(({ report }) => report.warnings)),
  };
}

export {
  assessEventQuality,
  defaultEventQualityPolicy,
  runEventQualityPipeline,
  type EventQualityCode,
  type EventQualityDiagnostics,
  type EventQualityPipelineResult,
  type EventQualityPolicy,
  type EventQualityResult,
  type EventQualityStatus,
};
