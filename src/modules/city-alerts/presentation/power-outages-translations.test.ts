import assert from "node:assert/strict";
import test from "node:test";

import { getPowerOutagesTranslations } from "./power-outages-translations.ts";
import { createCityContext } from "@/shared/config/cities";

test("uses the city's locative form in Budva electricity titles and empty copy", () => {
  const translations = getPowerOutagesTranslations("me", createCityContext("budva").city);

  assert.equal(translations.title, "Planirana isključenja struje u Budvi");
  assert.match(translations.description, /u Budvi/u);
  assert.equal(translations.empty, "Bez planiranih isključenja struje u Budvi.");
  assert.doesNotMatch(
    `${translations.title} ${translations.description} ${translations.empty}`,
    /Podgorici/u,
  );
});
