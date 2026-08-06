import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatFuelPrice,
  fuelProductIds,
  type FuelPriceCalculation,
} from "../domain/fuel-price.ts";
import { formatFuelDay } from "./fuel-day-label.ts";
import {
  getTrendPointDetails,
  getTrendPointLabel,
  getTrendPoints,
} from "./fuel-price-trend-model.ts";

const trendSource = async () =>
  readFile(new URL("./fuel-price-trend.tsx", import.meta.url), "utf8");
const pageSource = async () => readFile(new URL("./fuel-prices-page.tsx", import.meta.url), "utf8");

const calculation = (
  effectiveDate: string,
  cents: Record<string, number>,
  change?: { cents: number; direction: "decrease" | "increase" | "unchanged" },
): FuelPriceCalculation => ({
  effectiveDate,
  prices: Object.entries(cents).map(([productId, priceCents]) => ({
    ...(change && productId === "eurosuper95"
      ? { change: { ...change, source: "official" as const } }
      : {}),
    priceCents,
    productId: productId as never,
  })),
  // Deliberately a different day from effectiveDate: the chart must never plot this one.
  publishedAt: "2000-01-01",
  sourceName: "Ministarstvo energetike i rudarstva",
  sourceUrl: "https://www.gov.me/clanak/nove-cijene-goriva-od-04082026",
});

const history = [
  calculation("2026-08-04", { eurodiesel: 185, eurosuper95: 175, eurosuper98: 179 }, {
    cents: 2,
    direction: "decrease",
  }),
  calculation("2026-07-28", { eurodiesel: 179, eurosuper95: 177, eurosuper98: 181 }),
  calculation("2026-07-21", { eurodiesel: 174, eurosuper95: 170, eurosuper98: 174 }),
];

test("plots one point per official calculation, oldest first, keyed on the effective date", () => {
  const points = getTrendPoints(history, "eurosuper95");

  assert.deepEqual(
    points.map(({ effectiveDate }) => effectiveDate),
    ["2026-07-21", "2026-07-28", "2026-08-04"],
  );
  // Exactly as many points as calculations — no interpolated daily observations.
  assert.equal(points.length, history.length);
  assert.deepEqual(
    points.map(({ priceCents }) => priceCents),
    [170, 177, 175],
  );
});

test("uses effectiveDate, never publishedAt", () => {
  const points = getTrendPoints(history, "eurosuper95");

  for (const point of points) assert.notEqual(point.effectiveDate, "2000-01-01");
});

test("every product can be selected and reads its own series", () => {
  assert.deepEqual(
    getTrendPoints(history, "eurosuper98").map(({ priceCents }) => priceCents),
    [174, 181, 179],
  );
  assert.deepEqual(
    getTrendPoints(history, "eurodiesel").map(({ priceCents }) => priceCents),
    [174, 179, 185],
  );
  // A product absent from the stored calculations simply yields no points.
  assert.deepEqual(getTrendPoints(history, "heatingOil"), []);
});

test("the newest point carries the official change, and older points fall back to adjacent", () => {
  const points = getTrendPoints(history, "eurosuper95");
  const latest = points.at(-1);
  const middle = points[1];

  // Official Promjena from the source wins.
  assert.deepEqual(latest?.change, { cents: 2, direction: "decrease", source: "official" });
  // No official value on the older calculation, so the adjacent difference is used and labelled.
  assert.deepEqual(middle?.change, { cents: 7, direction: "increase", source: "derived" });
});

test("the first point has no change, because there is nothing before it", () => {
  assert.equal(getTrendPoints(history, "eurosuper95")[0].change, undefined);
});

test("an identical-price history stays plottable", () => {
  const flat = [
    calculation("2026-08-04", { eurosuper95: 170 }),
    calculation("2026-07-28", { eurosuper95: 170 }),
  ];
  const points = getTrendPoints(flat, "eurosuper95");

  assert.equal(points.length, 2);
  assert.deepEqual(
    points.map(({ priceCents }) => priceCents),
    [170, 170],
  );
  // Both points report "unchanged" rather than a bogus move.
  assert.equal(points[1].change?.direction, "unchanged");
});

test("the chart guards against a zero-span series and states the real min and max", async () => {
  const source = await trendSource();

  assert.match(source, /Math\.max\(rawMax - rawMin, 4\)/u);
  // Axis labels are the true extremes, so padding can never exaggerate a small move.
  assert.match(source, /formatFuelPrice\(rawMax, localeTag\)/u);
  assert.match(source, /formatFuelPrice\(rawMin, localeTag\)/u);
});

test("Eurosuper 95 is the default series", async () => {
  const source = await trendSource();

  assert.match(source, /useState<FuelProductId>\("eurosuper95"\)/u);
});

test("prices render with a Montenegrin decimal comma", () => {
  assert.equal(formatFuelPrice(175), "1,75");
  assert.equal(formatFuelPrice(159), "1,59");
  assert.equal(formatFuelPrice(2), "0,02");
});

test("a single calculation explains itself instead of drawing a line", async () => {
  const source = await trendSource();

  assert.match(source, /points\.length < 2 \?/u);
  assert.match(source, /najmanje dva zvanična obračuna/u);
});

test("the chart and the history table read the same calculations", async () => {
  const page = await pageSource();

  // One dataset, two views: the chart and the table consume the same displayed slice.
  assert.match(page, /const visible = result\.calculations\.slice\(0, historyRowLimit\);/u);
  assert.match(page, /calculations=\{visible\}/u);
  assert.match(page, /\{visible\.map\(\(calculation\) => \(/u);
  // No second historical source anywhere in the module.
  assert.doesNotMatch(await trendSource(), /fetch\(|readFile|parseFuelArticle/u);
});

test("the client boundary is the trend component only", async () => {
  const page = await pageSource();
  const trend = await trendSource();

  assert.match(trend, /^"use client";/u);
  assert.doesNotMatch(page, /"use client"/u);
  // Server-rendered values stay in the page component.
  assert.match(page, /current\.effectiveDate/u);
  assert.match(page, /href=\{current\.sourceUrl\}/u);
});

test("no temporal or predictive overclaiming anywhere in the fuel UI", async () => {
  const source = `${await pageSource()}\n${await trendSource()}`;

  for (const forbidden of [
    /\bdanas\b/iu,
    /\bove\s+nedjelje\b/iu,
    /\buživo\b/iu,
    /real[-\s]?time/iu,
    /\bprognoz/iu,
    /\bpredvi[đd]/iu,
  ]) {
    assert.doesNotMatch(source, forbidden, String(forbidden));
  }
});

test("the product tabs and panel form a complete tab pattern", async () => {
  const source = await trendSource();

  assert.match(source, /role="tablist"/u);
  assert.match(source, /aria-selected=\{isSelected\}/u);
  assert.match(source, /tabIndex=\{getRovingTabIndex\(isSelected\)\}/u);
  // The panel names the tab it belongs to and stays keyboard-reachable when it holds no button.
  assert.match(source, /aria-labelledby=\{`\$\{tabsId\}-\$\{productId\}`\}/u);
  assert.match(source, /role="tabpanel"/u);
});

test("every product is offered, in the official display order", async () => {
  const source = await trendSource();

  // The selector is generated from the domain list, so a product can never be silently dropped.
  assert.match(source, /fuelProductIds\.map\(\(candidate\)/u);
  assert.deepEqual(fuelProductIds, ["eurosuper95", "eurosuper98", "eurodiesel", "heatingOil"]);
});

test("only serializable props cross the server-to-client boundary", async () => {
  const page = await pageSource();
  const trend = await trendSource();

  const [, passedProps] = /<FuelPriceTrend([^>]*)\/>/u.exec(page) ?? [];
  assert.ok(passedProps, "the page must render FuelPriceTrend as a self-closing element");
  assert.deepEqual(
    [...passedProps.matchAll(/(\w+)=\{/gu)].map(([, name]) => name).sort(),
    ["calculations", "localeTag"],
  );
  // A callback prop is exactly what crashed the route: functions are not serializable.
  assert.doesNotMatch(page, /formatDay=\{/u);

  const [, declaredProps] = /interface FuelPriceTrendProps \{([\s\S]*?)\n\}/u.exec(trend) ?? [];
  assert.ok(declaredProps, "the trend must declare its props interface");
  // No function type, no Date, no Map/Set: the prop type cannot admit an unserializable value.
  assert.doesNotMatch(declaredProps, /=>|\bDate\b|\bMap<|\bSet</u);
});

test("both sides of the boundary format a day through the same module", async () => {
  const page = await pageSource();
  const trend = await trendSource();

  assert.match(page, /formatFuelDay\(date, getLocaleTag\(locale\)\)/u);
  assert.match(trend, /formatFuelDay\(points\[0\]\.effectiveDate, localeTag\)/u);
  // The chart labels the day the prices took effect, never the day the article was published.
  assert.doesNotMatch(trend, /publishedAt/u);
});

test("a day label states the effective day, not the day before it", () => {
  const label = formatFuelDay("2026-08-04", "sr-Latn-ME");

  // Noon UTC keeps the label inside the Podgorica day; a midnight instant could render the 3rd.
  assert.match(label, /\b4\b/u);
  assert.match(label, /2026/u);
  assert.notEqual(label, "2026-08-04");
  assert.notEqual(label, formatFuelDay("2026-08-03", "sr-Latn-ME"));
});

const flatHistory = [
  calculation("2026-08-04", { eurosuper95: 170 }),
  calculation("2026-07-28", { eurosuper95: 170 }),
];

test("the range selector counts official calculations, not days", async () => {
  const source = await trendSource();

  // Exact public wording; "promjena" here means one ministry price update.
  assert.match(source, /`Posljednjih \$\{recentCalculationCount\} promjena`/u);
  assert.match(source, /const recentCalculationCount = 6;/u);
  // The short view is the last six stored records — a slice of the series, never a date window.
  assert.match(source, /allPoints\.slice\(-recentCalculationCount\)/u);
  // No date arithmetic anywhere: the window is a count of records, never a span of calendar time.
  const code = source.replace(/\/\/[^\n]*/gu, "");
  assert.doesNotMatch(code, /setDate|getTime\(\)|Date\.now|86[_]?400/u);
  assert.match(source, /Sve/u);
});

test("the latest-six view keeps six calculation records, unchanged prices included", () => {
  const sixUpdates = [
    calculation("2026-08-04", { eurosuper95: 175 }),
    calculation("2026-07-28", { eurosuper95: 175 }),
    calculation("2026-07-21", { eurosuper95: 174 }),
    calculation("2026-07-14", { eurosuper95: 174 }),
    calculation("2026-07-07", { eurosuper95: 170 }),
    calculation("2026-06-30", { eurosuper95: 168 }),
    calculation("2026-06-23", { eurosuper95: 165 }),
  ];
  const points = getTrendPoints(sixUpdates, "eurosuper95");
  const shown = points.slice(-6);

  assert.equal(shown.length, 6);
  // Two of the six repeat the previous price; they are still official calculations and still shown.
  assert.equal(shown.filter(({ change }) => change?.direction === "unchanged").length, 2);
  assert.equal(shown[0].effectiveDate, "2026-06-30");
});

test("a point detail reports the selected product's own official price and date", () => {
  const points = getTrendPoints(history, "eurodiesel");
  const details = getTrendPointDetails(points, 2, "Eurodizel");

  assert.equal(details?.effectiveDate, "2026-08-04");
  assert.equal(details?.priceCents, 185);
  assert.equal(details?.productName, "Eurodizel");
  // publishedAt is 2000-01-01 in the fixture: a tooltip built on it would be visibly wrong.
  assert.notEqual(details?.effectiveDate, "2000-01-01");
});

test("a point compares against the previous displayed calculation", () => {
  const points = getTrendPoints(history, "eurosuper95");

  // 177 → 175 against the point before it, with the ministry's own value preferred.
  assert.deepEqual(getTrendPointDetails(points, 2, "Eurosuper 95")?.change, {
    cents: 2,
    direction: "decrease",
    source: "official",
  });
  // 170 → 177 has no official value, so the adjacent difference is used and labelled derived.
  assert.deepEqual(getTrendPointDetails(points, 1, "Eurosuper 95")?.change, {
    cents: 7,
    direction: "increase",
    source: "derived",
  });
});

test("the oldest displayed point invents no comparison", () => {
  const points = getTrendPoints(history, "eurosuper95");

  assert.equal(getTrendPointDetails(points, 0, "Eurosuper 95")?.change, undefined);
  // Even when the series is sliced, the first visible point drops a comparison it cannot show.
  const sliced = points.slice(-2);
  assert.equal(getTrendPointDetails(sliced, 0, "Eurosuper 95")?.change, undefined);
  assert.notEqual(getTrendPointDetails(sliced, 1, "Eurosuper 95")?.change, undefined);
});

test("an unchanged calculation is reported as unchanged", () => {
  const points = getTrendPoints(flatHistory, "eurosuper95");
  const details = getTrendPointDetails(points, 1, "Eurosuper 95");
  assert.ok(details);

  assert.equal(details.change?.direction, "unchanged");
  // And the spoken form says so rather than reading out a zero.
  assert.match(getTrendPointLabel(details, "sr-Latn-ME"), /bez promjene/iu);
});

test("a point label carries date, product and price in words", () => {
  const points = getTrendPoints(history, "eurosuper95");
  const details = getTrendPointDetails(points, 2, "Eurosuper 95");
  assert.ok(details);

  const label = getTrendPointLabel(details, "sr-Latn-ME");

  assert.match(label, /2026/u);
  assert.match(label, /Eurosuper 95/u);
  assert.match(label, /1,75 € \/ L/u);
  assert.match(label, /smanjenje 0,02 eura/u);
  // A screen reader gets the value from the label, never from where the dot sits.
  assert.doesNotMatch(label, /cx|cy|svg/iu);
});

test("chart points respond to hover, focus and tap alike", async () => {
  const source = await trendSource();

  for (const handler of [/onMouseEnter=/u, /onFocus=/u, /onClick=/u, /onBlur=/u]) {
    assert.match(source, handler, `points must handle ${String(handler)}`);
  }
  // Reachable by keyboard and announced as an activatable thing.
  assert.match(source, /tabIndex=\{0\}/u);
  assert.match(source, /role="button"/u);
  // role="img" would make those points presentational in several screen readers. The comment
  // explaining that rule must not be mistaken for a violation of it.
  const markup = source.replace(/\{\/\*[\s\S]*?\*\/\}/gu, "");
  assert.doesNotMatch(markup, /role="img"/u);
  assert.match(markup, /role="group"/u);
  // A finger-sized transparent target, so tapping does not depend on hitting a 3.5px dot.
  assert.match(source, /r=\{16\}/u);
});

test("the tooltip shows the official values and no invented ones", async () => {
  const source = await trendSource();

  assert.match(source, /Promjena u odnosu na prethodni:/u);
  assert.match(source, /Bez promjene/u);
  assert.match(source, /formatFuelDay\(details\.effectiveDate, localeTag\)/u);
  assert.match(source, /details\.productName/u);
  assert.match(source, /formatFuelPrice\(details\.priceCents, localeTag\)/u);
  // The comparison row only exists when there is a comparison to make.
  assert.match(source, /\{details\.change \? \(/u);
});

test("the tooltip is a plain surface, not a new chart library", async () => {
  const source = await trendSource();
  const manifest = JSON.parse(
    await readFile(new URL("../../../../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };

  assert.match(source, /<svg/u);
  for (const forbidden of ["recharts", "chart.js", "d3", "victory", "nivo", "visx", "echarts"]) {
    const message = `${forbidden} must not be a dependency`;
    assert.equal(forbidden in manifest.dependencies, false, message);
  }
});

test("the chart still never reads publishedAt", async () => {
  const source = await trendSource();
  const model = await readFile(new URL("./fuel-price-trend-model.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /publishedAt/u);
  assert.doesNotMatch(model, /publishedAt/u);
});
