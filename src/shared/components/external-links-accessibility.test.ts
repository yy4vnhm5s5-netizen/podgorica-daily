import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const externalLinkFiles = [
  "src/modules/city-alerts/presentation/power-outages-page.tsx",
  "src/modules/events/presentation/cineplexx-programme-card.tsx",
  "src/modules/events/presentation/event-detail.tsx",
  "src/modules/flights/presentation/airport-flights-page.tsx",
  "src/modules/going-out/presentation/going-out-page.tsx",
  "src/modules/going-out/presentation/going-out-section.tsx",
  "src/modules/transport/presentation/bus-station-card.tsx",
  "src/modules/transport/presentation/railway-station-card.tsx",
] as const;

test("every public link opening in a new tab announces that behavior", async () => {
  const sources = await Promise.all(
    externalLinkFiles.map((file) => readFile(join(process.cwd(), file), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /target="_blank"/);
    assert.match(source, /rel="(?:noopener )?noreferrer"/);
    assert.match(source, /<NewTabNotice locale=\{locale\} \/>/);
  }
});
