import { getCity, supportsCityCapability } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

import { runVikUlcinjCollector } from "./vik-ulcinj.ts";

async function runActiveVikUlcinjCollector({
  city = getCity("ulcinj"),
  runCollector = runVikUlcinjCollector,
}: {
  city?: City;
  runCollector?: typeof runVikUlcinjCollector;
} = {}) {
  if (!city?.isActive || !supportsCityCapability(city, "water")) return null;
  return runCollector();
}

if (process.argv[1]?.endsWith("collect-vik-ulcinj.ts")) {
  void runActiveVikUlcinjCollector().then((result) => {
    process.exitCode = result?.exitCode ?? 0;
  });
}

export { runActiveVikUlcinjCollector };
