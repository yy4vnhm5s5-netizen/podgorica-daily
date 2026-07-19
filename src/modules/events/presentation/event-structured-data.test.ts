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
      address: { "@type": "PostalAddress", streetAddress: "Njegoševa 1" },
      name: "KIC Budo Tomović",
    },
    name: "Ljetnji koncert",
    organizer: { "@type": "Organization", name: "KIC" },
    sameAs: "https://events.example.test/fixture",
    startDate: "2026-07-17T18:00:00.000Z",
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

test("keeps event summaries concise without inventing source content", () => {
  const description = `${"Opis događaja ".repeat(60)}završetak`;
  const summary = getEventSummary(description);

  assert.ok(summary);
  assert.ok(summary.length <= maximumEventSummaryLength + 1);
  assert.match(summary, /…$/);
});
