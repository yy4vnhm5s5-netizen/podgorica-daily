import assert from "node:assert/strict";
import test from "node:test";

import robots from "./robots.ts";

test("allows search indexing while protecting APIs and publishing the canonical sitemap", () => {
  const output = JSON.stringify(robots());

  assert.match(output, /"host":"https:\/\/gradom\.me"/u);
  assert.match(output, /"sitemap":"https:\/\/gradom\.me\/sitemap\.xml"/u);
  assert.match(output, /"disallow":\["\/api\/"\]/u);
  assert.doesNotMatch(output, /"userAgent":"Googlebot"/u);
  assert.match(output, /"userAgent":"Google-Extended"/u);
});
