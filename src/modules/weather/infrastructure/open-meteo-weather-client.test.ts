import assert from "node:assert/strict";
import test from "node:test";

import { getCurrentWeather } from "../application/get-current-weather.ts";
import {
  createOpenMeteoWeatherClient,
  weatherRequestTimeoutMs,
} from "./open-meteo-weather-client.ts";
import { createCityContext } from "@/shared/config/cities";
import type { CityContext } from "@/shared/types/city";

const context: CityContext = {
  city: {
    country: "Crna Gora",
    id: "podgorica",
    isActive: true,
    isMain: true,
    latitude: 42.4304,
    longitude: 19.2594,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me",
  timezone: "Europe/Podgorica",
};

const currentWeather = {
  current: {
    apparent_temperature: 28.1,
    relative_humidity_2m: 42,
    temperature_2m: 27.4,
    time: 1_784_709_600,
    weather_code: 1,
    wind_speed_10m: 12.4,
  },
};

test("uses the existing cached Open-Meteo request contract for successful responses", async () => {
  let request: { init: RequestInit & { next?: { revalidate: number } }; url: URL } | undefined;
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async (url, init) => {
      request = { init, url };
      return { json: async () => currentWeather, ok: true };
    },
  });

  const weather = await client(context);

  assert.equal(weather?.temperature_2m, 27.4);
  assert.equal(request?.url.hostname, "api.open-meteo.com");
  assert.equal(request?.init.next?.revalidate, 600);
  assert.equal((request?.init.headers as Record<string, string>).Accept, "application/json");
  assert.ok(request?.init.signal instanceof AbortSignal);
  assert.equal(request?.init.signal?.aborted, false);
});

test("constructs the existing weather request from the active Budva CityContext", async () => {
  let requestedUrl: URL | undefined;
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async (url) => {
      requestedUrl = url;
      return { json: async () => currentWeather, ok: true };
    },
  });

  const budva = createCityContext("budva");
  await client(budva);

  assert.equal(budva.city.isActive, true);
  assert.equal(budva.timezone, "Europe/Podgorica");
  assert.equal(requestedUrl?.searchParams.get("latitude"), "42.2864");
  assert.equal(requestedUrl?.searchParams.get("longitude"), "18.8401");
  assert.equal(requestedUrl?.searchParams.get("timezone"), "Europe/Podgorica");
});

test("constructs the existing weather request from the prepared Kotor CityContext", async () => {
  let requestedUrl: URL | undefined;
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async (url) => {
      requestedUrl = url;
      return { json: async () => currentWeather, ok: true };
    },
  });

  const kotor = createCityContext("kotor");
  await client(kotor);

  assert.equal(kotor.city.isActive, false);
  assert.equal(kotor.timezone, "Europe/Podgorica");
  assert.equal(requestedUrl?.searchParams.get("latitude"), "42.4247");
  assert.equal(requestedUrl?.searchParams.get("longitude"), "18.7712");
  assert.equal(requestedUrl?.searchParams.get("timezone"), "Europe/Podgorica");
});

test("aborts a slow Open-Meteo request at the configured timeout", async () => {
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async (_url, init) =>
      new Promise((_, reject) => {
        const signal = init.signal;
        assert.ok(signal);
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("request aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      }),
    timeoutMs: 1,
  });

  await assert.rejects(() => client(context), { name: "AbortError" });
});

test("preserves an upstream abort without translating it outside the weather client", async () => {
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async () => {
      const error = new Error("request cancelled");
      error.name = "AbortError";
      throw error;
    },
  });

  await assert.rejects(() => client(context), { name: "AbortError" });
});

test("rejects unsuccessful upstream HTTP responses", async () => {
  const client = createOpenMeteoWeatherClient({
    fetchImplementation: async () => ({ json: async () => ({}), ok: false }),
  });

  await assert.rejects(() => client(context), {
    message: "Open-Meteo current weather request failed",
  });
});

test("keeps the existing weather fallback when the client request fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("Open-Meteo is unavailable");
  }) as typeof fetch;

  try {
    assert.deepEqual(await getCurrentWeather(context), { status: "error" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses an eight-second default timeout appropriate for the public weather API", () => {
  assert.equal(weatherRequestTimeoutMs, 8_000);
});
