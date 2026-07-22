import { getEventRefreshExitCode, serializeEventRefreshSummary } from "./events-refresh-cli.ts";
import { refreshStandardEvents } from "./events-refresh.ts";

void refreshStandardEvents()
  .then((summary) => {
    process.stdout.write(`${serializeEventRefreshSummary(summary)}\n`);
    process.exitCode = getEventRefreshExitCode(summary);
  })
  .catch(() => {
    process.stdout.write('{"code":"REFRESH_INTERNAL_ERROR","status":"error"}\n');
    process.exitCode = 1;
  });
