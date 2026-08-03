import assert from "node:assert/strict";
import test from "node:test";

import { getDistinctBeachName } from "./sea-water-quality-location-ui-model.ts";

test("shows the broader beach for a numbered monitoring point", () => {
  // The page is the canonical URL for point "Jaz 01"; "JAZ" is the beach it sits on, which is
  // genuinely new context and must be shown.
  assert.equal(getDistinctBeachName({ beachName: "JAZ", displayName: "Jaz 01" }), "JAZ");
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA PLAZA", displayName: "Slovenska plaža 01" }),
    "SLOVENSKA PLAZA",
  );
  assert.equal(getDistinctBeachName({ beachName: "Bečići", displayName: "Bečići 02" }), "Bečići");
});

test("never strips a numeric point suffix to call two values duplicates", () => {
  // Suffix-stripping would make every numbered point look identical to its beach and would
  // suppress the whole line. Each of these must still resolve to a displayed beach name.
  for (const suffix of ["01", "02", "10", "1"]) {
    assert.equal(
      getDistinctBeachName({ beachName: "MOGREN", displayName: `Mogren ${suffix}` }),
      "MOGREN",
    );
  }
});

test("suppresses only an effectively identical complete name", () => {
  // Case, diacritics and insignificant whitespace alone are not new information.
  assert.equal(getDistinctBeachName({ beachName: "KAMENOVO", displayName: "Kamenovo" }), undefined);
  assert.equal(
    getDistinctBeachName({ beachName: "  kamenovo  ", displayName: "Kamenovo" }),
    undefined,
  );
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA  PLAŽA", displayName: "Slovenska plaza" }),
    undefined,
  );
});

test("returns the verified source string rather than an invented presentation form", () => {
  // No re-casing: the uppercase value is what JPMD published, and nothing in the repository can
  // safely restore "Slovenska plaža" from "SLOVENSKA PLAZA".
  assert.equal(
    getDistinctBeachName({ beachName: "SLOVENSKA PLAZA", displayName: "Slovenska plaža 01" }),
    "SLOVENSKA PLAZA",
  );
});

test("renders nothing when JPMD supplied no beach name", () => {
  assert.equal(getDistinctBeachName({ displayName: "Topolica 01" }), undefined);
  assert.equal(
    getDistinctBeachName({ beachName: undefined, displayName: "Topolica 01" }),
    undefined,
  );
  assert.equal(getDistinctBeachName({ beachName: "   ", displayName: "Topolica 01" }), undefined);
});
