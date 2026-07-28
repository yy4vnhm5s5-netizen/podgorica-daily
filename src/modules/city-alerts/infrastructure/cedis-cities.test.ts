import assert from "node:assert/strict";
import test from "node:test";

import {
  getCedisCityId,
  getCedisMunicipality,
  isCedisSupportedCityId,
} from "./cedis-cities.ts";
import { createCityContext } from "@/shared/config/cities";

test("recognizes Tivat as a CEDIS-supported municipality alongside Podgorica and Budva", () => {
  assert.equal(isCedisSupportedCityId("podgorica"), true);
  assert.equal(isCedisSupportedCityId("budva"), true);
  assert.equal(isCedisSupportedCityId("tivat"), true);
  assert.equal(isCedisSupportedCityId("bar"), false);
});

test("exposes Tivat's heading variants for municipality-section matching", () => {
  assert.deepEqual(getCedisMunicipality("tivat"), {
    cityId: "tivat",
    headingVariants: ["Tivat", "Opština Tivat"],
  });
});

test("resolves the CEDIS city id from a Tivat context the same way as the other supported cities", () => {
  assert.equal(getCedisCityId(createCityContext("tivat")), "tivat");
  assert.equal(getCedisCityId("tivat"), "tivat");
  assert.equal(getCedisCityId("bar"), undefined);
});
