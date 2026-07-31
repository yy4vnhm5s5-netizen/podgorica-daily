import assert from "node:assert/strict";
import test from "node:test";

import { getCity } from "@/shared/config/cities";

import { runActiveVodovodKotorCollector } from "./collect-vodovod-kotor.ts";

test("does not fetch or write a snapshot while Kotor is inactive", async () => {
  let collectorCalls = 0;
  const result = await runActiveVodovodKotorCollector({
    city: getCity("kotor"),
    runCollector: async () => {
      collectorCalls += 1;
      throw new Error("collector must not run for inactive Kotor");
    },
  });

  assert.equal(result, null);
  assert.equal(collectorCalls, 0);
});
