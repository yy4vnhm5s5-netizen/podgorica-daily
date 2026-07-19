import { classifyEventMatch } from "../domain/event-deduplication.ts";
import type { EventNormalizationResult } from "../domain/event-normalization.ts";
import type { EventQualityPipelineResult } from "../domain/event-quality.ts";
import type { CityEvent, EventCandidate } from "../domain/event.ts";

type EventRefreshRejectionReason =
  | "duplicate"
  | "event-already-in-past"
  | "failed-quality-validation"
  | "invalid-date"
  | "missing-date"
  | "missing-title"
  | "other";

interface EventRefreshPipelineMetrics {
  acceptedCount: number;
  fetchedCount: number;
  normalizedCount: number;
  parsedCount: number;
  rejectedCount: number;
}

interface EventRefreshRejectedEvent {
  eventId?: string;
  reasons: EventRefreshRejectionReason[];
  sourceUrl: string;
}

interface EventRefreshObservabilityInput {
  candidates: readonly EventCandidate[];
  fetchedCount: number;
  normalized: readonly EventNormalizationResult[];
  parsedCount: number;
  provider: string;
  quality: EventQualityPipelineResult;
}

function createEventRefreshObservability({
  candidates,
  fetchedCount,
  normalized,
  parsedCount,
  provider,
  quality,
}: EventRefreshObservabilityInput) {
  const normalizationRejections = normalized.flatMap((result, index) =>
    result.event
      ? []
      : [
          {
            reasons: result.rejectionReasons,
            sourceUrl: candidates[index]?.source.sourceUrl ?? "unknown",
          },
        ],
  );
  const qualityRejections = quality.rejected.map(({ errors, eventId }) => ({
    eventId,
    reasons: errors.map(mapQualityRejectionReason),
    sourceUrl: findSourceUrl(eventId, normalized) ?? "unknown",
  }));
  const duplicateRejections = findDuplicateRejections([
    ...quality.accepted,
    ...quality.acceptedWithWarnings,
  ]);
  const rejected = [...normalizationRejections, ...qualityRejections, ...duplicateRejections];

  const metrics: EventRefreshPipelineMetrics = {
    acceptedCount: quality.finalEvents.length,
    fetchedCount,
    normalizedCount: normalized.filter(({ event }) => event !== null).length,
    parsedCount,
    rejectedCount: rejected.length,
  };
  return { metrics, provider, rejected };
}

function logEventRefreshObservability(input: EventRefreshObservabilityInput) {
  const diagnostics = createEventRefreshObservability(input);
  console.info(
    JSON.stringify({
      event: "events-refresh-pipeline",
      provider: diagnostics.provider,
      ...diagnostics.metrics,
    }),
  );
  for (const rejected of diagnostics.rejected) {
    console.info(
      JSON.stringify({
        event: "events-refresh-rejected-event",
        eventId: rejected.eventId,
        provider: diagnostics.provider,
        reasons: rejected.reasons,
        sourceUrl: rejected.sourceUrl,
      }),
    );
  }
  return diagnostics;
}

function mapQualityRejectionReason(code: string): EventRefreshRejectionReason {
  if (code === "missing-title") return "missing-title";
  if (code === "invalid-date") return "invalid-date";
  if (code === "excessively-old-event") return "event-already-in-past";
  return "failed-quality-validation";
}

function findSourceUrl(eventId: string | undefined, normalized: readonly EventNormalizationResult[]) {
  return normalized.find(({ event }) => event?.id === eventId)?.event?.sourceUrl;
}

function findDuplicateRejections(events: readonly CityEvent[]): EventRefreshRejectedEvent[] {
  const retained: CityEvent[] = [];
  const duplicates: EventRefreshRejectedEvent[] = [];
  for (const event of events) {
    if (retained.some((existing) => isDuplicate(existing, event))) {
      duplicates.push({ eventId: event.id, reasons: ["duplicate"], sourceUrl: event.sourceUrl });
      continue;
    }
    retained.push(event);
  }
  return duplicates;
}

function isDuplicate(left: CityEvent, right: CityEvent) {
  const kind = classifyEventMatch(left, right);
  return kind === "exact" || kind === "strong";
}

export {
  createEventRefreshObservability,
  logEventRefreshObservability,
  type EventRefreshPipelineMetrics,
  type EventRefreshRejectedEvent,
  type EventRefreshRejectionReason,
};
