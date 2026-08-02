import assert from "node:assert/strict";
import test from "node:test";

import { getCedisCityId, getCedisMunicipality, isCedisSupportedCityId } from "./cedis-cities.ts";
import { createCityContext } from "@/shared/config/cities";

test("recognizes Bar, Kotor, and existing CEDIS-supported municipalities", () => {
  assert.equal(isCedisSupportedCityId("podgorica"), true);
  assert.equal(isCedisSupportedCityId("budva"), true);
  assert.equal(isCedisSupportedCityId("tivat"), true);
  assert.equal(isCedisSupportedCityId("kotor"), true);
  assert.equal(isCedisSupportedCityId("bar"), true);
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
  assert.equal(getCedisCityId("bar"), "bar");
});

test("exposes Bar's verified municipality heading", () => {
  assert.deepEqual(getCedisMunicipality("bar"), { cityId: "bar", headingVariants: ["Bar"] });
  assert.equal(getCedisCityId(createCityContext("bar")), "bar");
});

test("exposes the verified Kotor municipality heading", () => {
  assert.deepEqual(getCedisMunicipality("kotor"), { cityId: "kotor", headingVariants: ["Kotor"] });
  assert.equal(getCedisCityId(createCityContext("kotor")), "kotor");
});
