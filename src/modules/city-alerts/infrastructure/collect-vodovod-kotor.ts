import { getCity, supportsCityCapability } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

import { runVodovodKotorCollector } from "./vodovod-kotor.ts";

async function runActiveVodovodKotorCollector({
  city = getCity("kotor"),
  runCollector = runVodovodKotorCollector,
}: {
  city?: City;
  runCollector?: typeof runVodovodKotorCollector;
} = {}) {
  if (!city?.isActive || !supportsCityCapability(city, "water")) return null;
  return runCollector();
}

if (process.argv[1]?.endsWith("collect-vodovod-kotor.ts")) {
  void runActiveVodovodKotorCollector().then((result) => {
    process.exitCode = result?.exitCode ?? 0;
  });
}

export { runActiveVodovodKotorCollector };
