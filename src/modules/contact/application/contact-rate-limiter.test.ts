import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryContactRateLimiter } from "./contact-rate-limiter.ts";

test("allows bounded contact submissions and recovers after the rate-limit window", () => {
  const limiter = createInMemoryContactRateLimiter({ limit: 2, windowMs: 1_000 });

  assert.equal(limiter.consume("203.0.113.10", 0).allowed, true);
  assert.equal(limiter.consume("203.0.113.10", 1).allowed, true);
  assert.deepEqual(limiter.consume("203.0.113.10", 2), {
    allowed: false,
    retryAfterSeconds: 1,
  });
  assert.equal(limiter.consume("203.0.113.10", 1_001).allowed, true);
});
