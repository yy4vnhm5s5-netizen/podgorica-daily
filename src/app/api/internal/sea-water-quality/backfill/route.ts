import { env } from "@/config/env";
import { backfillSeaWaterQualityHistory } from "@/modules/sea-water-quality/infrastructure/sea-water-quality-history-backfill";
import { createMorskodobroHttpClient } from "@/modules/sea-water-quality/infrastructure/morskodobro-http-client";
import { createRefreshPostHandler } from "../../refresh-post-handler";

// Manual/operational only: imports completed historical JPMD rounds into the seasonal history
// snapshots. It writes history exclusively — the current sea-water snapshot is never touched, so
// the public summary keeps showing the newest normal refresh. No recurring cron may target this.
// Reuses SEA_WATER_QUALITY_REFRESH_SECRET: same provider, same trust boundary, no new secret.
export const POST = createRefreshPostHandler({
  refresh: async (request) => {
    const body: unknown = await request.json().catch(() => undefined);
    const { rounds, year } = readBackfillRequest(body);

    return backfillSeaWaterQualityHistory(
      { rounds, year },
      { httpClient: createMorskodobroHttpClient() },
    );
  },
  secret: env.SEA_WATER_QUALITY_REFRESH_SECRET,
});

// Anything malformed becomes an empty/NaN request, which the runner rejects as "bad-request"
// (HTTP 400) rather than being coerced into a plausible-looking backfill.
function readBackfillRequest(body: unknown): { rounds: number[]; year: number } {
  if (typeof body !== "object" || body === null) return { rounds: [], year: Number.NaN };
  const candidate = body as { rounds?: unknown; year?: unknown };

  return {
    rounds: Array.isArray(candidate.rounds)
      ? candidate.rounds.filter((round): round is number => typeof round === "number")
      : [],
    year: typeof candidate.year === "number" ? candidate.year : Number.NaN,
  };
}
