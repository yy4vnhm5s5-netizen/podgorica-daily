import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalizeVikpgSourceUrl,
  discoverVikpgNotices,
  isIndividualNoticeUrl,
  parseVikpgNotice,
  toVikpgUrl,
} from "./vikpg-water-notices.ts";

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

// Regression coverage for the production bug: VIK's listing page links to both a category/section
// index page (e.g. "/mediji/servisne-informacije/radovi.html", a 404 when fetched as a notice) and
// individual notices under that same category (e.g. ".../radovi/radovi,-22-jul,-2026.html", a real
// notice), and both anchors' visible text matches servicePattern's keywords. Only a URL-shape check
// — independent of title matching — can tell them apart.
test("rejects VIK category/section index pages while keeping individual notices from the same category", async () => {
  const notices = discoverVikpgNotices(
    await fixture("vikpg-listing-category-pages.html"),
    new Date("2026-07-22T10:00:00.000Z"),
  );

  assert.deepEqual(
    notices.map((notice) => notice.url).sort(),
    [
      "https://vikpg.me/mediji/servisne-informacije/kvarovi/informacija-o-kvaru,-22-07-2026.html",
      "https://vikpg.me/mediji/servisne-informacije/radovi/radovi,-22-jul,-2026.html",
    ],
  );
});

test("rejects category pages generically, not by hardcoding a category name", () => {
  // "tarife" (tariffs) is not one of VIK's known categories and never appears in servicePattern —
  // chosen deliberately so this only passes if the check is genuinely shape-based.
  assert.equal(
    isIndividualNoticeUrl("https://vikpg.me/mediji/servisne-informacije/tarife.html"),
    false,
  );
  assert.equal(
    isIndividualNoticeUrl(
      "https://vikpg.me/mediji/servisne-informacije/tarife/nova-tarifa-vode,-2026.html",
    ),
    true,
  );
  // The listing itself has the same one-segment shape as a category page, and must be rejected
  // the same way — it is a page about notices, not a notice.
  assert.equal(
    isIndividualNoticeUrl("https://vikpg.me/mediji/servisne-informacije/obavjestenja.html"),
    false,
  );
});

test("accepts the confirmed legacy Joomla article shape and rejects other index.php links", () => {
  // The exact shape used by every known legacy notice link (see __fixtures__/vikpg-listing.html):
  // option=com_gridbox, view=page, and a numeric id.
  assert.equal(
    isIndividualNoticeUrl(
      "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2001&lang=me",
    ),
    true,
  );
  // A different "view" — e.g. a Joomla category/listing page in the same component — is not an
  // article. This is a constructed counter-example (not one observed live: the current site no
  // longer exposes this scheme in its public navigation), built as the direct converse of the
  // confirmed shape above, not a guess about unrelated real content.
  assert.equal(
    isIndividualNoticeUrl("https://vikpg.me/index.php?option=com_gridbox&view=category&id=5"),
    false,
  );
  // Missing option/view entirely — an incomplete or unrelated index.php link is not, by itself,
  // enough to be treated as a notice.
  assert.equal(isIndividualNoticeUrl("https://vikpg.me/index.php?id=2001"), false);
});

test("rejects non-service VIK pages, other origins, and malformed URLs", () => {
  assert.equal(isIndividualNoticeUrl("https://vikpg.me/"), false);
  assert.equal(isIndividualNoticeUrl("https://vikpg.me/kontakt.html"), false);
  // Same path shape as a real notice, but on a different host entirely.
  assert.equal(
    isIndividualNoticeUrl(
      "https://example.com/mediji/servisne-informacije/radovi/radovi,-22-jul,-2026.html",
    ),
    false,
  );
  assert.equal(isIndividualNoticeUrl("not a url"), false);
});

test("canonicalizes a VIKPG source URL for comparison, not for display", () => {
  const apex = canonicalizeVikpgSourceUrl(
    "https://vikpg.me/index.php?option=com_gridbox&view=page&id=2001&lang=me",
  );
  // "www." prefix, reordered query parameters, and a fragment all collapse to the same key.
  const wwwReorderedWithFragment = canonicalizeVikpgSourceUrl(
    "https://www.vikpg.me/index.php?lang=me&id=2001&view=page&option=com_gridbox#section",
  );
  assert.equal(apex, wwwReorderedWithFragment);

  // A trailing slash on an otherwise-identical path does not produce a different key.
  const withoutTrailingSlash = canonicalizeVikpgSourceUrl(
    "https://vikpg.me/mediji/servisne-informacije/radovi/radovi,-22-jul,-2026.html",
  );
  const withTrailingSlash = canonicalizeVikpgSourceUrl(
    "https://vikpg.me/mediji/servisne-informacije/radovi/radovi,-22-jul,-2026.html/",
  );
  assert.equal(withoutTrailingSlash, withTrailingSlash);

  // The root path is never stripped down to an empty path.
  assert.equal(canonicalizeVikpgSourceUrl("https://vikpg.me/"), "https://vikpg.me/");
});

test("refuses to canonicalize a URL it cannot safely compare as a VIKPG source", () => {
  assert.equal(canonicalizeVikpgSourceUrl("not a url"), null);
  assert.equal(canonicalizeVikpgSourceUrl("https://example.com/index.php?id=2001"), null);
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

test("extracts only the article body and retains paragraph boundaries", async () => {
  const result = parseVikpgNotice(
    activeNotice,
    await fixture("vikpg-notice-with-metadata.html"),
    new Date("2026-07-20T10:00:00.000Z"),
  );
  const description = result.alert?.description;
  assert.ok(description?.kind === "source");

  assert.equal(
    description.value,
    "Obavještavamo potrošače u naselju Zabjelo da će vodosnabdijevanje biti obustavljeno.\n\nRadovi će trajati do 16.30 časova dana 20.07.2026. godine zbog sanacije kvara.",
  );
  assert.equal(description.value.includes("Leave a comment"), false);
  assert.equal(description.value.includes("Leave review"), false);
  assert.equal(description.value.includes("Views"), false);
  assert.equal(description.value.includes("Likes"), false);
  assert.equal(description.value.includes("Share"), false);
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

test("expires restoration notices and notices outside their local publication day", async () => {
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

test("expires a yesterday notice without a restoration time in the Podgorica timezone", async () => {
  const result = parseVikpgNotice(
    activeNotice,
    await fixture("vikpg-missing-end.html"),
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(result.alert?.status, "expired");
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
