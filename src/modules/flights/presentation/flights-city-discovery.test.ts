import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function componentSource() {
  return readFile(new URL("./flights-city-discovery.tsx", import.meta.url), "utf8");
}

test("renders crawlable, keyboard-focusable internal destination tiles", async () => {
  const source = await componentSource();

  assert.match(source, /import Link from "next\/link";/u);
  assert.match(source, /href=\{link\.href\}/u);
  assert.match(source, /aria-label=\{link\.navigationLabel\}/u);
  assert.match(source, /focus-visible:ring-2/u);
  assert.match(source, /aria-hidden="true"/u);
  assert.doesNotMatch(source, /onClick|router\.push|<button/u);
});

test("uses a responsive count-driven tile grid without a carousel or client-side data access", async () => {
  const source = await componentSource();

  assert.match(source, /grid grid-cols-2 gap-3/u);
  assert.match(source, /getFlightsCityDiscovery\(city\)/u);
  assert.match(source, /getFlightsCityDiscoveryDesktopColumns\(discovery\.links\.length\)/u);
  assert.doesNotMatch(source, /"use client"|useEffect|useState|fetch\(/u);
  assert.doesNotMatch(source, /carousel|overflow-x|scroll-snap|useMediaQuery/u);
});

test("uses the established capability accents instead of a neutral link list", async () => {
  const source = await componentSource();

  assert.match(source, /events: CalendarDays/u);
  assert.match(source, /goingOut: Music2/u);
  assert.match(source, /seaWaterQuality: Waves/u);
  assert.match(source, /electricity: Zap/u);
  assert.match(source, /bg-indigo-50/u);
  assert.match(source, /bg-violet-50/u);
  assert.match(source, /bg-cyan-50/u);
  assert.match(source, /bg-amber-50/u);
});
