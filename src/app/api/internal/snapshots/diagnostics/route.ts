import { env } from "@/config/env";

import { createRefreshPostHandler } from "../../refresh-post-handler";
import { collectAndEmitFileBackedSnapshotDiagnostics } from "../snapshot-diagnostics";

export const POST = createRefreshPostHandler({
  refresh: async () => ({
    snapshots: await collectAndEmitFileBackedSnapshotDiagnostics(),
    state: "success" as const,
  }),
  secret: env.SNAPSHOT_DIAGNOSTICS_SECRET,
});
