import { env } from "@/config/env";
import { runVikpgCollector } from "@/modules/city-alerts/infrastructure/collect-vikpg";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toCityAlertRefreshEndpointResult } from "../../provider-refresh-result";
import { buildVikpgWriteReadBackDiagnostic } from "./vikpg-write-read-diagnostic";

export const POST = createRefreshPostHandler({
  refresh: async () => {
    const collectorResult = await runVikpgCollector();
    const endpointResult = toCityAlertRefreshEndpointResult("vikpg", collectorResult);

    // TEMPORARY (remove this block, the import above, and vikpg-write-read-diagnostic.ts once the
    // production write/read path has been verified): only attached right after a genuinely
    // successful write, and read back before this response is constructed — never changes
    // `state`, so a failed/retained refresh is reported exactly as before.
    return {
      ...endpointResult,
      ...(endpointResult.state === "success"
        ? {
            diagnostics: await buildVikpgWriteReadBackDiagnostic({
              summary: collectorResult.summary,
            }),
          }
        : {}),
    };
  },
  secret: env.VIKPG_REFRESH_SECRET,
});
