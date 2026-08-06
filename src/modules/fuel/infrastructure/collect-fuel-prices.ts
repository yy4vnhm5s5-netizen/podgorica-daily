import { runFuelPricesCollector } from "./gov-me-fuel-prices.ts";

if (process.argv[1]?.endsWith("collect-fuel-prices.ts")) {
  void runFuelPricesCollector().then((result) => {
    process.exitCode = result.exitCode;
  });
}

export { runFuelPricesCollector };
