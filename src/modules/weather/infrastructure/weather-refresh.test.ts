import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";

import { readWeatherCache } from "./weather-cache.ts";
import { refreshWeather } from "./weather-refresh.ts";

const weather = {
  apparent_temperature: 28.1,
  relative_humidity_2m: 42,
  temperature_2m: 27.4,
  time: 1_784_709_600,
  weather_code: 1,
  wind_speed_10m: 12.4,
};

test("writes one normalized city Weather snapshot after a successful refresh", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-refresh-"));
  const cachePath = join(directory, "weather-budva.json");
  const context = createCityContext("budva");

  try {
    const result = await refreshWeather({
      cachePath,
      context,
      httpClient: async () => weather,
      now: () => new Date("2026-08-02T10:00:00.000Z"),
    });

    assert.equal(result.success, true);
    assert.equal(result.snapshot?.cityId, "budva");
    assert.equal(result.snapshot?.weather.temperature, 27.4);
    assert.equal((await readWeatherCache("budva", cachePath))?.cityId, "budva");
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("retains a city's previous usable snapshot when only that city's request fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-retention-"));
  const cachePath = join(directory, "weather-kotor.json");
  const context = createCityContext("kotor");

  try {
    await refreshWeather({ cachePath, context, httpClient: async () => weather });
    const result = await refreshWeather({
      cachePath,
      context,
      httpClient: async () => {
        throw new Error("Open-Meteo unavailable");
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.retainedPreviousSnapshot, true);
    assert.equal(result.snapshot?.cityId, "kotor");
    assert.ok(await readWeatherCache("kotor", cachePath));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("returns unavailable on a refresh failure when no prior snapshot exists", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-no-retention-"));
  const cachePath = join(directory, "weather-bar.json");

  try {
    const result = await refreshWeather({
      cachePath,
      context: createCityContext("bar"),
      httpClient: async () => {
        throw new Error("Open-Meteo unavailable");
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.retainedPreviousSnapshot, false);
    assert.equal(result.snapshot, null);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
