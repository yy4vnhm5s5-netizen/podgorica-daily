import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders user-facing beach history without exposing the raw JPMD source round", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Kvalitet vode/u);
  assert.match(source, /Datum uzorkovanja/u);
  assert.match(source, /measurement\.samplingDateTime \?\? measurement\.samplingDate \?\? "—"/u);
  assert.doesNotMatch(source, />\s*Krug monitoringa\s*</u);
  assert.doesNotMatch(source, /\{measurement\.sourceRound\}<\/td>/u);
});

test("offers contextual same-city navigation without linking back to the beach listing", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /import \{ ExploreCityLinks \} from "@\/shared\/components\/explore-city-links";/u,
  );
  assert.match(source, /<ExploreCityLinks city=\{city\} exclude=\{\["seaWaterQuality"\]\} \/>/u);
});

test("renders the visible breadcrumb from the same trail as the structured data", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getSeaWaterQualityLocationBreadcrumbTrail\(\{/u);
  assert.match(source, /<nav aria-label="Putanja"/u);
  assert.match(source, /aria-current="page"/u);
  // Non-terminal crumbs must be crawlable links, not plain text.
  assert.match(source, /href=\{step\.href\}/u);
  assert.doesNotMatch(source, /onClick/u);
});

test("shows the wider JPMD beach name as secondary context without touching the H1", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // H1 still identifies the monitoring location this canonical URL represents.
  assert.match(
    source,
    /title=\{`\$\{location\.displayName\}, \$\{city\.name\} — kvalitet mora`\}/u,
  );
  assert.match(source, /const beachName = getDistinctBeachName\(location\);/u);
  assert.match(source, /\{beachName \? \(/u);
  assert.match(source, /Plaža: /u);
});

test("uses the compact linked JPMD source attribution", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<p className="text-sm italic text-muted-foreground">/u);
  assert.match(source, /Izvor:/u);
  assert.match(source, />\s*JPMD\s*</u);
  assert.match(source, /href=\{sourceUrl\}/u);
  assert.match(source, /rel="noopener noreferrer"/u);
  assert.match(source, /target="_blank"/u);
});

test("adds the measurement summary without disturbing the existing page structure", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // New block, rendered only when the derivation produced something.
  assert.match(source, /const summary = getSeaWaterQualityLocationSummary\(location\);/u);
  assert.match(source, /\{summary \? \(/u);
  assert.match(source, /Sažetak mjerenja/u);
  // Everything that was already on the page stays exactly as it was.
  assert.match(
    source,
    /title=\{`\$\{location\.displayName\}, \$\{city\.name\} — kvalitet mora`\}/u,
  );
  assert.match(source, /const beachName = getDistinctBeachName\(location\);/u);
  assert.match(source, /getSeaWaterQualityLocationBreadcrumbTrail\(\{/u);
  assert.match(source, /Istorija uzorkovanja/u);
  assert.match(source, /Najnoviji rezultat/u);
  assert.match(source, /<ExploreCityLinks city=\{city\} exclude=\{\["seaWaterQuality"\]\} \/>/u);
});

test("keeps the summary free of safety, cleanliness or compliance claims", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  for (const banned of [
    "bezbjed",
    "sigurn",
    "preporuč",
    "zagađ",
    "zdrav",
    "rizik",
    "najbolj",
    "propisan",
    "kriterijum",
  ]) {
    assert.doesNotMatch(source, new RegExp(banned, "iu"), banned);
  }
  // Grade wording is JPMD's own, taken from the shared label map rather than reworded.
  assert.match(source, /\{gradeLabels\[grade\]\}/u);
});

test("the measurement logic lives in the ui model, not in the component", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // The page formats and sequences; it never counts, sorts or ranks measurements itself. (It does
  // reference measurement.sourceRound as a React key in the pre-existing history table, which is
  // not measurement logic.)
  assert.doesNotMatch(source, /gradeOrder/u);
  assert.doesNotMatch(source, /\.sort\(/u);
  assert.doesNotMatch(source, /indexOf/u);
  assert.doesNotMatch(source, /measurementCount \?\?|\.reduce\(/u);
});

test("renders the grade distribution as non-interactive chips reusing the shared grade styling", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );
  const summaryBlock = /\{summary \? \(([\s\S]*?)\n {6}\) : null\}/u.exec(source)?.[1];
  assert.ok(summaryBlock);

  // A list of spans — nothing that reads or behaves as a control.
  assert.match(summaryBlock, /<ul className="flex flex-wrap gap-2">/u);
  assert.match(summaryBlock, /<span className=\{getGradeBadgeClassName\(grade\)\}>/u);
  for (const interactive of [/onClick/u, /<button/u, /<a\b/u, /href=/u, /cursor-pointer/u]) {
    assert.doesNotMatch(summaryBlock, interactive, String(interactive));
  }
  // One grade colour mapping in the codebase — the summary must not declare its own.
  assert.doesNotMatch(summaryBlock, /bg-(green|lime|amber|red)-/u);
});

test("compacts a uniform history into one chip and shows only grades actually observed", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // "5/5 Odlična" for a uniform history, "3× Odlična" otherwise — and the list is driven by
  // summary.breakdown, which only ever contains observed grades.
  assert.match(
    source,
    /summary\.uniformGrade \? `\$\{count\}\/\$\{summary\.measurementCount\}` : `\$\{count\}×`/u,
  );
  assert.match(source, /summary\.breakdown\.map\(\(\{ count, grade \}\)/u);
  assert.doesNotMatch(source, /gradeOrder\.map/u);
});

test("gives each trend its own wording plus a directional icon, never colour alone", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /improved: "Bolja ocjena nego prethodno mjerenje"/u);
  assert.match(source, /unchanged: "Ista ocjena kao prethodno mjerenje"/u);
  assert.match(source, /worsened: "Slabija ocjena nego prethodno mjerenje"/u);
  assert.match(
    source,
    /trend === "improved" \? ArrowUp : trend === "worsened" \? ArrowDown : ArrowRight/u,
  );
  // The icon is decorative; the sentence carries the meaning.
  assert.match(source, /<Icon aria-hidden="true"/u);
  assert.doesNotMatch(source, /text-(green|red)-\d+.*trend|trend.*text-(green|red)-\d+/u);
});

test("labels the previous measurement and shows its date only when one exists", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Prethodno:/u);
  assert.match(
    source,
    /<span className=\{getGradeBadgeClassName\(summary\.comparison\.previous\.grade\)\}>/u,
  );
  // No date in the data means no date rendered — never a fabricated or placeholder one.
  assert.match(
    source,
    /\{formatMeasurementDate\(summary\.comparison\.previous, locale\) \? \(/u,
  );
  assert.doesNotMatch(source, /Prethodno:[\s\S]{0,200}"—"/u);
});

test("omits the comparison row entirely for a single-measurement history", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );

  // The row is gated on summary.comparison, which the derivation leaves undefined below two
  // measurements — so one reading renders the count and its chip and nothing more.
  assert.match(source, /\{summary\.comparison \? \(/u);
});

test("does not repeat the latest-result card inside the summary", async () => {
  const source = await readFile(
    new URL("./sea-water-quality-location-page.tsx", import.meta.url),
    "utf8",
  );
  const summaryBlock = /\{summary \? \(([\s\S]*?)\n {6}\) : null\}/u.exec(source)?.[1];
  assert.ok(summaryBlock);

  // The summary is about the history; the latest grade already has its own card above it.
  assert.doesNotMatch(summaryBlock, /summary\.latest/u);
  assert.doesNotMatch(summaryBlock, /Najnoviji rezultat/u);
});
