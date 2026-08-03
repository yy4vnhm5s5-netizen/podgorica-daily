import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { getEventSummary, maximumEventSummaryLength } from "./event-summary.ts";
import { createEventStructuredData, serializeStructuredData } from "./event-structured-data.ts";

test("builds Event structured data from known event fields only", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({
      address: "Njegoševa 1",
      description: "Program <strong>večeri</strong>.",
      organizer: "KIC",
      status: "cancelled",
    }),
  );

  assert.deepEqual(structuredData, {
    "@context": "https://schema.org",
    "@type": "Event",
    description: "Program <strong>večeri</strong>.",
    eventStatus: "https://schema.org/EventCancelled",
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ME",
        addressLocality: "Podgorica",
        streetAddress: "Njegoševa 1",
      },
      name: "KIC Budo Tomović",
    },
    name: "Ljetnji koncert",
    organizer: { "@type": "Organization", name: "KIC" },
    sameAs: "https://events.example.test/fixture",
    startDate: "2026-07-17T18:00:00.000Z",
    url: "https://gradom.me/podgorica/dogadjaji/event_fixture",
  });
  assert.doesNotMatch(serializeStructuredData(structuredData!), /<strong>/);
});

test("does not invent time or location for date-only events", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({
      address: undefined,
      startDate: "2026-08-14",
      startsAt: undefined,
      venueName: undefined,
    }),
  );

  assert.equal(structuredData?.startDate, "2026-08-14");
  assert.equal(structuredData?.location, undefined);
});

test("adds verified locality and country only to an address the source provided", () => {
  const withAddress = createEventStructuredData(podgoricaEvent({ address: "Njegoševa 1" }));

  assert.equal(withAddress?.location?.address?.addressLocality, "Podgorica");
  assert.equal(withAddress?.location?.address?.addressCountry, "ME");
  assert.equal(withAddress?.location?.address?.streetAddress, "Njegoševa 1");
});

test("never manufactures a PostalAddress from the city when no street address exists", () => {
  const venueOnly = createEventStructuredData(
    podgoricaEvent({ address: undefined, venueName: "KIC Budo Tomović" }),
  );

  // The venue is still a Place, but with no address object at all — the city alone is not an
  // address, and inventing one would be fabricated structured data.
  assert.equal(venueOnly?.location?.name, "KIC Budo Tomović");
  assert.equal(venueOnly?.location?.address, undefined);
});

test("falls back to a valid startDate when startsAt is malformed instead of embedding it as-is", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({ startDate: "2026-08-14", startsAt: "not-a-real-timestamp" }),
  );

  assert.equal(structuredData?.startDate, "2026-08-14");
});

test("omits structured data entirely when neither date field is valid", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({ startDate: undefined, startsAt: "not-a-real-timestamp" }),
  );

  assert.equal(structuredData, undefined);
});

test("omits a malformed endDate instead of embedding it as-is", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({ endsAt: "not-a-real-timestamp" }),
  );

  assert.equal(structuredData?.endDate, undefined);
});

test("keeps event summaries concise without inventing source content", () => {
  const description = `${"Opis događaja ".repeat(60)}završetak`;
  const summary = getEventSummary(description);

  assert.ok(summary);
  assert.ok(summary.length <= maximumEventSummaryLength + 1);
  assert.match(summary, /…$/);
});
