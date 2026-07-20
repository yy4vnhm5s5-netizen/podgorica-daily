import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { discoverVikpgNotices, parseVikpgNotice, toVikpgUrl } from "./vikpg-water-notices.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const activeNotice = {
  title: "Informacija o kvaru, 20.07.2026.",
  url: "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2001&lang=me",
};

test("discovers only unique official water-service links", async () => {
  const notices = discoverVikpgNotices(
    await fixture("vikpg-listing.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  assert.equal(notices.length, 3);
  assert.ok(notices.every((notice) => notice.url.startsWith("https://vikpg.me/")));
});

test("retains the publication date rendered separately from a service-notice title", async () => {
  const notices = discoverVikpgNotices(
    await fixture("vikpg-listing-separated-publication-date.html"),
    new Date("2025-11-11T10:00:00.000Z"),
  );

  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.publishedAt?.toISOString(), "2025-11-11T12:00:00.000Z");
});

test("uses the listing publication date when the detail page title has no date", async () => {
  const notice = discoverVikpgNotices(
    await fixture("vikpg-listing-separated-publication-date.html"),
    new Date("2025-11-11T10:00:00.000Z"),
  )[0];
  assert.ok(notice);

  const result = parseVikpgNotice(
    notice,
    await fixture("vikpg-notice-separated-publication-date.html"),
    new Date("2025-11-11T10:00:00.000Z"),
  );

  assert.equal(result.alert?.publishedAt?.toISOString(), "2025-11-11T12:00:00.000Z");
  assert.deepEqual(result.warnings, []);
});

test("resolves approved relative links and rejects off-domain links", () => {
  assert.equal(toVikpgUrl("/index.php?id=2001"), "https://vikpg.me/index.php?id=2001");
  assert.equal(toVikpgUrl("https://example.com/notice"), null);
});

test("normalizes an active interruption with area and expected restoration time", async () => {
  const result = parseVikpgNotice(
    activeNotice,
    await fixture("vikpg-active-outage.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  assert.equal(result.alert?.status, "active");
  assert.equal(result.alert?.type, "waterOutage");
  assert.deepEqual(result.alert?.affectedArea, { kind: "source", value: "Zabjelo" });
  assert.equal(result.alert?.expectedEndAt?.toISOString(), "2026-07-20T14:30:00.000Z");
  assert.equal(result.alert?.dataMode, "live");
});

test("keeps future planned interruptions as scheduled", async () => {
  const result = parseVikpgNotice(
    {
      title: "Planirani radovi na vodovodnoj mreži, 21.07.2026.",
      url: "https://vikpg.me/index.php?id=2002",
    },
    await fixture("vikpg-planned-interruption.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  assert.equal(result.alert?.status, "scheduled");
  assert.equal(result.alert?.startsAt?.toISOString(), "2026-07-21T06:00:00.000Z");
  assert.equal(result.alert?.expectedEndAt?.toISOString(), "2026-07-21T12:00:00.000Z");
});

test("expires restoration notices and notices older than the one-day fallback window", async () => {
  const restored = parseVikpgNotice(
    {
      title: "Otklonjen kvar u naselju Konik, 18.07.2026.",
      url: "https://vikpg.me/index.php?id=2003",
    },
    await fixture("vikpg-restored.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  const missingEnd = parseVikpgNotice(
    activeNotice,
    await fixture("vikpg-missing-end.html"),
    new Date("2026-07-22T10:00:00.000Z"),
  );
  assert.equal(restored.alert?.status, "expired");
  assert.equal(missingEnd.alert?.status, "expired");
});

test("keeps a current notice with a missing restoration time active and warns on unknown area", async () => {
  const result = parseVikpgNotice(
    activeNotice,
    await fixture("vikpg-missing-end.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  assert.equal(result.alert?.status, "active");
  assert.equal(result.alert?.expectedEndAt, undefined);
  assert.deepEqual(result.warnings, []);
});

test("handles malformed article markup without throwing", async () => {
  const result = parseVikpgNotice(activeNotice, await fixture("vikpg-malformed.html"));
  assert.equal(result.alert, null);
  assert.equal(result.contentRecognized, true);
  assert.ok(result.warnings.includes("publication-date-unrecognized"));
});
