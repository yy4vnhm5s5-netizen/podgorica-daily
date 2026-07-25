import assert from "node:assert/strict";
import test from "node:test";

import { skeletonClassName } from "./skeleton-classes.ts";

test("skeleton animation respects reduced-motion preferences", () => {
  assert.match(skeletonClassName, /animate-pulse/);
  assert.match(skeletonClassName, /motion-reduce:animate-none/);
});
