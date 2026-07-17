import assert from "node:assert/strict";
import test from "node:test";

import { isRefreshAuthorized } from "./refresh-auth.ts";

const secret = "a-strong-test-secret-with-at-least-thirty-two-characters";

test("accepts exactly one valid bearer token", () => {
  assert.equal(isRefreshAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isRefreshAuthorized(`Bearer ${secret} extra`, secret), false);
  assert.equal(isRefreshAuthorized(`Basic ${secret}`, secret), false);
  assert.equal(isRefreshAuthorized("Bearer ", secret), false);
});

test("fails closed for invalid or absent secrets", () => {
  assert.equal(isRefreshAuthorized(`Bearer ${secret.slice(0, -1)}b`, secret), false);
  assert.equal(isRefreshAuthorized(`Bearer ${secret}`, undefined), false);
  assert.equal(isRefreshAuthorized(`Bearer ${secret}`, ` ${secret}`), false);
});
