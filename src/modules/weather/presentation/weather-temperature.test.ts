import assert from "node:assert/strict";
import test from "node:test";

import type { CurrentWeatherResult } from "../application/get-current-weather.ts";
import { getWeatherTemperature } from "./weather-temperature.ts";

test("returns the identical resolved temperature for every weather presentation", () => {
  const weather: CurrentWeatherResult = {
    data: {
      apparentTemperature: 31.2,
      cityIds: ["podgorica"],
      condition: "clearSky",
      humidity: 41,
      temperature: 30.6,
      updatedAt: new Date("2026-07-19T10:00:00.000Z"),
      windSpeed: 7.4,
    },
    status: "success",
  };

  const summaryTemperature = getWeatherTemperature(weather);
  const cardTemperature = getWeatherTemperature(weather);

  assert.equal(summaryTemperature, 30.6);
  assert.equal(cardTemperature, summaryTemperature);
});
