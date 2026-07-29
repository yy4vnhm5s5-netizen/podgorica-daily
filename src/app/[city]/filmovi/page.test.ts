import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCinemaPath } from "@/shared/config/public-routes";
import { getCity } from "@/shared/config/cities";

test("the cinema route is /filmovi, matching getCinemaPath", () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  assert.equal(getCinemaPath(podgorica), "/podgorica/filmovi");
});

// Regression test for the /podgorica-vs-/podgorica/filmovi movie-count mismatch: this page used to
// reuse selectHomepageCinemaProgramme (the homepage teaser's today/tomorrow-only, ≤3-event
// selector), so it could never show every movie with an upcoming screening the homepage highlight
// counted.
test("shows every upcoming Cineplexx screening via selectUpcomingCineplexxScreenings, not the homepage teaser selector", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /selectHomepageCinemaProgramme/u);
  assert.match(
    source,
    /import \{ selectUpcomingCineplexxScreenings \} from "@\/modules\/events\/presentation\/cineplexx-programme-ui-model";/u,
  );
  assert.match(
    source,
    /const screenings = selectUpcomingCineplexxScreenings\(cinemaEvents, \{ now: new Date\(\) \}\);/u,
  );
  // No `limit` prop passed — CineplexxProgrammeCard shows every movie in `screenings`, not a
  // hardcoded slice.
  assert.match(
    source,
    /<CineplexxProgrammeCard events=\{screenings\} locale=\{locale\} state=\{providerState\} \/>/u,
  );
  assert.doesNotMatch(source, /limit=\{/u);
});
