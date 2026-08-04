import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders City Services as a compact desktop status strip while preserving tabs and links", async () => {
  const source = await readFile(new URL("./city-services-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /flex flex-col lg:flex-row lg:items-stretch/u);
  assert.match(
    source,
    /lg:grid lg:grid-cols-\[minmax\(7\.5rem,0\.8fr\)_minmax\(11rem,1\.35fr\)_auto_minmax\(9\.5rem,1fr\)_auto\]/u,
  );
  assert.match(source, /lg:min-h-9/u);
  assert.match(source, /lg:px-3 lg:py-2/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tabpanel"/u);
  assert.match(source, /<ServiceEmptyState \{\.\.\.emptyState\} \/>/u);
  assert.match(source, /lg:col-span-3/u);
  assert.match(source, /text-xs leading-5 text-muted-foreground/u);
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
