import assert from "node:assert/strict";
import test from "node:test";

import { getDailyOverview, shouldIncludeCityAlerts } from "./get-daily-overview.ts";
import { createCityContext } from "@/shared/config/cities";

function unsupportedContext() {
  const podgorica = createCityContext("podgorica");
  return { ...podgorica, city: { ...podgorica.city, capabilities: [] } };
}

function contextWithAlertCapabilities(capabilities: "electricity"[] | "water"[]) {
  const podgorica = createCityContext("podgorica");
  return { ...podgorica, city: { ...podgorica.city, capabilities } };
}

test("does not request City Alerts when an unsupported city opts in", async () => {
  const context = unsupportedContext();

  assert.equal(shouldIncludeCityAlerts(context, true), false);
  const result = await getDailyOverview(context, { includeCityAlerts: true });
  assert.equal(result.status, "success");
});

test("does not request City Alerts when a supported city opts out", async () => {
  const context = createCityContext("podgorica");
  assert.equal(shouldIncludeCityAlerts(context, false), false);
  const result = await getDailyOverview(context, { includeCityAlerts: false });
  assert.equal(result.status, "success");
});

test("requests City Alerts only when a supported city opts in", () => {
  const context = createCityContext("podgorica");
  assert.equal(shouldIncludeCityAlerts(context, true), true);
});

test("allows either supported City Alerts capability to opt in", () => {
  assert.equal(shouldIncludeCityAlerts(contextWithAlertCapabilities(["electricity"]), true), true);
  assert.equal(shouldIncludeCityAlerts(contextWithAlertCapabilities(["water"]), true), true);
});
