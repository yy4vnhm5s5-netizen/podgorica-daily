import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders City Services as a compact desktop status strip while preserving tabs and links", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /flex flex-col lg:flex-row lg:items-stretch/u);
  assert.match(
    source,
    /lg:grid lg:grid-cols-\[minmax\(7\.5rem,1fr\)_minmax\(11rem,1\.35fr\)_minmax\(9\.5rem,1fr\)_auto\]/u,
  );
  assert.match(source, /lg:min-h-9/u);
  assert.match(source, /lg:px-3 lg:py-2/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tabpanel"/u);
  assert.match(
    source,
    /<ServiceEmptyState icon=\{serviceIcons\[activeServiceId\]\} primary=\{emptyState\.primary\} \/>/u,
  );
  assert.match(source, /lg:col-start-1 lg:col-span-2/u);
  assert.match(source, /formatAdditionalAffectedAreas\(service\.additionalLocationCount\)/u);
  assert.match(source, /icon=\{MapPin\}[\s\S]*?iconClassName="text-rose-500"/u);
  assert.match(source, /text-rose-500/u);
  assert.match(source, /icon=\{Clock3\}/u);
  assert.match(source, /\+\{service\.additionalLocationCount\}/u);
  assert.match(source, /href=\{service\.detailsHref\}/u);
  assert.match(source, /href=\{service\.sourceUrl\}/u);
  assert.doesNotMatch(source, /<CardContent/u);
});

// The "+3" badge counts affected areas beyond the one shown, so it belongs to the location — it
// used to occupy its own grid column between the time and the refresh age, reading as
// "Dučići. | 08:00–17:00 | +3 | Ažurirano prije 21 minut".
test("renders the additional-area badge inside the location group, not as its own column", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const locationDetail = /<ServiceStripDetail\n\s+className="lg:col-start-1[\s\S]*?\/>/u.exec(
    source,
  )?.[0];
  assert.ok(locationDetail);

  // The badge is now a `trailing` adornment of the location value.
  assert.match(locationDetail, /trailing=\{/u);
  assert.match(locationDetail, /\+\{service\.additionalLocationCount\}/u);
  assert.match(locationDetail, /icon=\{MapPin\}/u);
  assert.match(locationDetail, /value=\{primaryArea\}/u);
  // It no longer sits between the time and the refresh age.
  assert.doesNotMatch(source, /lg:col-start-3["\s][\s\S]{0,120}additionalLocationCount/u);
});

test("keeps the time, refresh age and links as their own separate groups", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /<ServiceStripDetail className="lg:col-start-2" icon=\{Clock3\} value=\{service\.time\} \/>/u,
  );
  assert.match(
    source,
    /<ServiceStripDetail className="lg:col-start-3" label=\{service\.freshnessLabel\} \/>/u,
  );
  assert.match(source, /\{translations\.officialSource\}/u);
  assert.match(source, /\{service\.detailsLabel\}/u);
  assert.match(source, /href=\{service\.detailsHref\}/u);
});

test("drops the badge's vacated grid column so no empty gap remains", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const template = /lg:grid-cols-\[([^\]]*)\]/u.exec(source)?.[1];
  assert.ok(template);

  // Four columns now: location, time, freshness, links.
  assert.equal(template.split("_").length, 4);
  assert.doesNotMatch(source, /lg:col-start-5/u);
});

test("lets a long location wrap with its badge instead of overflowing", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  // Value and trailing adornment share one wrapping group; the badge itself never shrinks.
  assert.match(source, /<div className="flex min-w-0 flex-wrap items-center gap-x-1\.5 gap-y-1">/u);
  assert.match(source, /className="shrink-0 border-amber-200\/80/u);
  assert.match(source, /"flex min-w-0 items-center gap-1\.5 text-sm/u);
});

test("the badge stays non-interactive and keeps its accessible label", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const badge = /<Badge\n[\s\S]*?<\/Badge>/u.exec(source)?.[0];
  assert.ok(badge);

  assert.match(
    badge,
    /aria-label=\{formatAdditionalAffectedAreas\(service\.additionalLocationCount\)\}/u,
  );
  assert.doesNotMatch(badge, /onClick|href=|role="button"|tabIndex/u);
});

test("renders the badge only when the model reports additional areas", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  // Water reaches the same component but supplies no additionalLocationCount, so it renders
  // nothing extra — no service-specific branch exists.
  assert.match(source, /service\.additionalLocationCount \? \(/u);
  assert.doesNotMatch(source, /serviceId === "power" \? [\s\S]{0,80}additionalLocationCount/u);
});

// The dashboard strip is a one-line-per-cell layout. The empty state used to stack a short label
// over a long explanatory sentence, which made an empty service visibly taller than a populated
// one — and, after the strip went from five columns to four, its lg:col-span-3 also overlapped
// the freshness column.
test("renders the empty service as a single-line strip cell, like a populated one", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const emptyState = /function ServiceEmptyState[\s\S]*?\n\}/u.exec(source)?.[0];
  assert.ok(emptyState);

  // Reuses the same primitive the populated cells use, so height and alignment match.
  assert.match(emptyState, /<ServiceStripDetail/u);
  assert.match(emptyState, /value=\{primary\}/u);
  // The stacked two-paragraph block is gone.
  assert.doesNotMatch(emptyState, /<p className="mt-0\.5/u);
  assert.doesNotMatch(emptyState, /secondary/u);
});

test("omits the long explanatory sentence from the compact strip", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  // Only the short label is passed through; the sentence stays on /[city]/struja.
  assert.match(source, /primary=\{emptyState\.primary\}/u);
  assert.doesNotMatch(source, /emptyState\.secondary/u);
  assert.doesNotMatch(source, /\{\.\.\.emptyState\}/u);
});

test("keeps freshness and details in their own columns beside the empty state", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const template = /lg:grid-cols-\[([^\]]*)\]/u.exec(source)?.[1];
  assert.ok(template);

  // Four columns: the empty cell covers 1-2 (location + time), leaving 3 and 4 free.
  assert.equal(template.split("_").length, 4);
  assert.match(source, /lg:col-start-1 lg:col-span-2/u);
  assert.match(
    source,
    /<ServiceStripDetail className="lg:col-start-3" label=\{service\.freshnessLabel\} \/>/u,
  );
  assert.match(source, /lg:col-start-4 lg:justify-self-end/u);
  // No leftover span that would reach into the freshness column.
  assert.doesNotMatch(source, /lg:col-span-3/u);
});

test("uses the service's own icon so the empty state is not text-only", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  // Same Zap/Droplets mapping the tabs use — no new visual system, and the label is still text.
  assert.match(source, /icon=\{serviceIcons\[activeServiceId\]\}/u);
  assert.match(source, /const serviceIcons = \{ power: Zap, water: Droplets \}/u);
});

test("water reaches the same empty implementation with no electricity-specific branch", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /cityServicesEmptyStateCopy\[activeServiceId\]/u);
  assert.doesNotMatch(source, /activeServiceId === "power" \?[\s\S]{0,80}emptyState/u);
});

test("the dedicated /[city]/struja empty state is untouched by this change", async () => {
  const page = await readFile(
    new URL("../../../modules/city-alerts/presentation/power-outages-page.tsx", import.meta.url),
    "utf8",
  );

  // Its richer copy, its own heading, its checked-at line and its stale warning all remain.
  assert.match(page, /title=\{translations\.emptyTitle\}/u);
  assert.match(page, /description=\{translations\.empty\}/u);
  assert.match(page, /\{translations\.checkedAt\}/u);
  assert.match(page, /<Timestamp locale=\{localeTag\} value=\{result\.lastSuccessfulUpdate\} \/>/u);
  assert.match(
    page,
    /\{result\.status !== "unavailable" && result\.freshnessStatus === "stale" \? \(/u,
  );
});

// `publicationContext` used to build "Objavljeno: <publishedAt>" for every alert, but nothing ever
// rendered it — and for CEDIS that value is the scheduled outage day, not a publication time. It
// was dead plumbing whose only future was to reintroduce a false label.
test("carries no publication-context field for anything to render", async () => {
  const panel = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const section = await readFile(new URL("./city-alerts-section.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(panel, /publicationContext/u);
  assert.doesNotMatch(section, /publicationContext/u);
  // Nothing replaced it, and the panel reads no alert publication timestamp of its own.
  assert.doesNotMatch(panel, /publishedAt/u);
});

test("every field the panel reads is still declared, and the strip is unchanged", async () => {
  const panel = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");
  const declared = /interface CityServiceInfo \{([\s\S]*?)\n\}/u.exec(panel)?.[1];
  assert.ok(declared);

  for (const field of [
    "additionalLocationCount",
    "area",
    "detailsHref",
    "detailsLabel",
    "freshnessLabel",
    "locations",
    "sourceUrl",
    "state",
    "time",
  ]) {
    assert.match(declared, new RegExp(`\\b${field}\\??:`, "u"), field);
    assert.match(panel, new RegExp(`service\\.${field}\\b`, "u"), field);
  }
});
