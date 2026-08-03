import {
  backfillSeaWaterQualityHistory,
  type SeaWaterQualityBackfillResult,
} from "./sea-water-quality-history-backfill.ts";
import { createMorskodobroHttpClient } from "./morskodobro-http-client.ts";

interface SeaWaterQualityHistoryCliDependencies {
  argv?: readonly string[];
  backfill?: typeof backfillSeaWaterQualityHistory;
  writeOutput?: (line: string) => void;
}

// `--year 2026 --rounds 1,2,3,4`. Deliberately no defaults for either flag: a history backfill is
// a manual operation and must state exactly which season and rounds it intends to touch.
function parseSeaWaterQualityHistoryArgs(argv: readonly string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const [flag, inlineValue] = argument.slice(2).split("=");
    values.set(flag, inlineValue ?? argv[index + 1] ?? "");
  }

  const year = Number(values.get("year"));
  const rounds = (values.get("rounds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map(Number);

  return { rounds, year };
}

async function runSeaWaterQualityHistoryBackfillCli({
  argv = process.argv.slice(2),
  backfill = backfillSeaWaterQualityHistory,
  writeOutput = console.log,
}: SeaWaterQualityHistoryCliDependencies = {}): Promise<{
  exitCode: 0 | 1;
  result: SeaWaterQualityBackfillResult;
}> {
  const { rounds, year } = parseSeaWaterQualityHistoryArgs(argv);
  const result = await backfill(
    { rounds, year },
    { httpClient: createMorskodobroHttpClient() },
  );

  writeOutput(
    [
      "provider=sea-water-quality-history",
      `state=${result.state}`,
      `year=${result.year}`,
      `requested_rounds=${result.requestedRounds.join("|") || "none"}`,
      `resolved_rounds=${result.resolvedRounds.join("|") || "none"}`,
      `rejected_rounds=${result.rejectedRounds.join("|") || "none"}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
      ...result.cities.map(
        (city) =>
          `city=${city.cityId}:${city.state}:${city.rounds
            .map((round) => `r${round.round}=${round.state}(${round.acceptedLocations})`)
            .join(",") || "none"}`,
      ),
    ].join(" "),
  );

  return { exitCode: result.state === "success" ? 0 : 1, result };
}

if (process.argv[1]?.endsWith("collect-sea-water-quality-history.ts")) {
  void runSeaWaterQualityHistoryBackfillCli().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export {
  parseSeaWaterQualityHistoryArgs,
  runSeaWaterQualityHistoryBackfillCli,
  type SeaWaterQualityHistoryCliDependencies,
};
