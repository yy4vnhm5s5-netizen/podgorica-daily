import type { EventProviderResult } from "../domain/event.ts";
import type { EventQualityDiagnostics } from "../domain/event-quality.ts";

type EventProviderHealthState = "degraded" | "disabled" | "failing" | "healthy" | "unavailable";

interface EventProviderStatusThresholds {
  degradedWarningRate: number;
  failingRejectionRate: number;
}

interface EventProviderStatusInput {
  diagnostics?: Partial<EventQualityDiagnostics>;
  enabled: boolean;
  lastRefreshError?: string;
  providerId: string;
  providerName: string;
  result: EventProviderResult;
}

interface EventProviderStatusReadModel {
  acceptedCount?: number;
  acceptedWithWarningsCount?: number;
  availabilityState: EventProviderResult["state"];
  commonRejections: readonly [string, number][];
  commonWarnings: readonly [string, number][];
  countDropWarning: boolean;
  deduplicatedCount?: number;
  enabled: boolean;
  fetchedAt?: string;
  finalEventCount: number;
  freshness: EventProviderResult["state"];
  lastError?: string;
  lastSuccessfulRefreshAt?: string;
  parserWarnings: readonly string[];
  previousSuccessfulEventCount?: number;
  providerId: string;
  providerName: string;
  qualityHealthState: EventProviderHealthState;
  rejectionRate: number;
  rejectedCount?: number;
  scoreDistribution?: EventQualityDiagnostics["qualityScoreDistribution"];
  warningRate: number;
  zeroResultProtectionTriggered: boolean;
}

function deriveEventProviderHealth(
  input: EventProviderStatusInput,
  thresholds: EventProviderStatusThresholds,
): EventProviderHealthState {
  if (!input.enabled || input.result.state === "disabled") return "disabled";
  if (input.result.state === "unavailable") return "unavailable";
  const diagnostics = input.diagnostics;
  const total = diagnostics?.normalizedCount ?? 0;
  const rejectionRate = total ? (diagnostics?.rejectedCount ?? 0) / total : 0;
  const warningRate = total ? (diagnostics?.acceptedWithWarningsCount ?? 0) / total : 0;
  if (
    input.lastRefreshError ||
    (diagnostics?.finalEventCount === 0 && diagnostics?.previousSuccessfulEventCount)
  )
    return "failing";
  if (rejectionRate >= thresholds.failingRejectionRate) return "failing";
  if (input.result.state === "stale" || diagnostics?.countDropWarning) return "degraded";
  if (warningRate >= thresholds.degradedWarningRate || input.result.parserWarnings.length)
    return "degraded";
  return "healthy";
}

function toEventProviderStatusReadModel(
  input: EventProviderStatusInput,
  thresholds: EventProviderStatusThresholds,
): EventProviderStatusReadModel {
  const diagnostics = input.diagnostics;
  const total = diagnostics?.normalizedCount ?? 0;
  return {
    acceptedCount: diagnostics?.acceptedCount,
    acceptedWithWarningsCount: diagnostics?.acceptedWithWarningsCount,
    availabilityState: input.result.state,
    commonRejections: sortCounts(diagnostics?.rejectionCounts),
    commonWarnings: sortCounts(diagnostics?.warningCounts),
    countDropWarning: diagnostics?.countDropWarning ?? false,
    deduplicatedCount: diagnostics?.deduplicatedCount,
    enabled: input.enabled,
    fetchedAt: input.result.fetchedAt,
    finalEventCount: diagnostics?.finalEventCount ?? input.result.events.length,
    freshness: input.result.state,
    lastError: input.lastRefreshError ?? input.result.lastRefreshError,
    lastSuccessfulRefreshAt: input.result.fetchedAt,
    parserWarnings: input.result.parserWarnings,
    previousSuccessfulEventCount: diagnostics?.previousSuccessfulEventCount,
    providerId: input.providerId,
    providerName: input.providerName,
    qualityHealthState: deriveEventProviderHealth(input, thresholds),
    rejectionRate: total ? (diagnostics?.rejectedCount ?? 0) / total : 0,
    rejectedCount: diagnostics?.rejectedCount,
    scoreDistribution: diagnostics?.qualityScoreDistribution,
    warningRate: total ? (diagnostics?.acceptedWithWarningsCount ?? 0) / total : 0,
    zeroResultProtectionTriggered: Boolean(
      diagnostics?.previousSuccessfulEventCount && diagnostics.finalEventCount === 0,
    ),
  };
}

function sortCounts(counts: Record<string, number> | undefined): readonly [string, number][] {
  return Object.entries(counts ?? {}).sort(
    ([leftCode, leftCount], [rightCode, rightCount]) =>
      rightCount - leftCount || leftCode.localeCompare(rightCode),
  );
}

export {
  deriveEventProviderHealth,
  toEventProviderStatusReadModel,
  type EventProviderHealthState,
  type EventProviderStatusReadModel,
  type EventProviderStatusThresholds,
};
