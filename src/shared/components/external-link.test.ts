import assert from "node:assert/strict";
import test from "node:test";

import { getNewTabNotice } from "./external-link.ts";

test("new-tab notice is localized for external links", () => {
  assert.equal(getNewTabNotice("me"), "(otvara se u novom tabu)");
  assert.equal(getNewTabNotice("en"), "(opens in a new tab)");
});
