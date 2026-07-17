import { env } from "./env.ts";
import type { EventQualityPolicy } from "@/modules/events/domain/event-quality";

interface EventQualityHealthThresholds {
  countDropRatio: number;
  degradedWarningRate: number;
  failingRejectionRate: number;
}

function getEventQualityPolicy(): EventQualityPolicy {
  return {
    countDropRatio: env.EVENT_QUALITY_COUNT_DROP_RATIO,
    maximumFutureDays: env.EVENT_QUALITY_MAX_FUTURE_DAYS,
    maximumPastDays: env.EVENT_QUALITY_MAX_PAST_DAYS,
    minimumAcceptedScore: env.EVENT_QUALITY_MIN_SCORE,
    version: "1",
    warnOnMissingDescription: env.EVENT_QUALITY_WARN_MISSING_DESCRIPTION,
    warnOnMissingStartTime: env.EVENT_QUALITY_WARN_MISSING_START_TIME,
    warnOnMissingVenue: env.EVENT_QUALITY_WARN_MISSING_VENUE,
  };
}

function getEventQualityHealthThresholds(): EventQualityHealthThresholds {
  return {
    countDropRatio: env.EVENT_QUALITY_COUNT_DROP_RATIO,
    degradedWarningRate: env.EVENT_QUALITY_DEGRADED_WARNING_RATE,
    failingRejectionRate: env.EVENT_QUALITY_FAILING_REJECTION_RATE,
  };
}

export {
  getEventQualityHealthThresholds,
  getEventQualityPolicy,
  type EventQualityHealthThresholds,
};
