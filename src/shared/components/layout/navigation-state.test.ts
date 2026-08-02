import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isNavigationItemCurrent } from "./navigation-state.ts";

test("navigation current state matches the exact public route", () => {
  assert.equal(isNavigationItemCurrent("/podgorica", "/podgorica"), true);
  assert.equal(isNavigationItemCurrent("/kontakt", "/kontakt"), true);
  assert.equal(isNavigationItemCurrent("/podgorica/dogadjaji", "/podgorica"), false);
});

test("desktop and mobile navigation expose the current page through aria-current", async () => {
  const source = await readFile(new URL("./navigation.tsx", import.meta.url), "utf8");

  assert.match(source, /aria-current=\{isCurrent \? "page" : undefined\}/);
});

test("navigation receives the contact feature decision from its server parents", async () => {
  const [navigation, dashboardLayout, appHeader, mobileNavigation] = await Promise.all([
    readFile(new URL("./navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("./dashboard-layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("./mobile-navigation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(navigation, /contactEnabled: boolean/);
  assert.match(navigation, /\.\.\.\(contactEnabled/);
  assert.doesNotMatch(navigation, /isFeatureEnabled/);
  assert.doesNotMatch(navigation, /shared\/config\/features/);
  assert.match(dashboardLayout, /const contactEnabled = isFeatureEnabled\("contact"\)/);
  assert.match(appHeader, /contactEnabled=\{contactEnabled\}/);
  assert.match(mobileNavigation, /contactEnabled=\{contactEnabled\}/);
});
