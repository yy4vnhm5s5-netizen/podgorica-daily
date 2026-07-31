import assert from "node:assert/strict";
import test from "node:test";

import { getCity } from "@/shared/config/cities";

import { runActiveVodovodKotorCollector } from "./collect-vodovod-kotor.ts";

test("runs the collector for active Kotor with the water capability", async () => {
  let collectorCalls = 0;
  const expected = { exitCode: 0, summary: { status: "success" } } as Awaited<
    ReturnType<typeof import("./vodovod-kotor.ts").runVodovodKotorCollector>
  >;
  const result = await runActiveVodovodKotorCollector({
    city: getCity("kotor"),
    runCollector: async () => {
      collectorCalls += 1;
      return expected;
    },
  });

  assert.equal(result, expected);
  assert.equal(collectorCalls, 1);
});

test("keeps the inactive-city guard without fetching or writing a snapshot", async () => {
  let collectorCalls = 0;
  const kotor = getCity("kotor");
  assert.ok(kotor);

  const result = await runActiveVodovodKotorCollector({
    city: { ...kotor, isActive: false },
    runCollector: async () => {
      collectorCalls += 1;
      throw new Error("collector must not run for inactive Kotor");
    },
  });

  assert.equal(result, null);
  assert.equal(collectorCalls, 0);
});
