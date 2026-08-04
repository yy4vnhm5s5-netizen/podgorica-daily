import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import { getEventSummary, maximumEventSummaryLength } from "./event-summary.ts";
import {
  createEventBreadcrumbStructuredData,
  createEventStructuredData,
  getEventSchemaStatus,
  getEventStructuredDataEligibility,
  serializeStructuredData,
} from "./event-structured-data.ts";
import { getCity } from "@/shared/config/cities";

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

test("does not invent time for a date-only event that does have a venue", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({ address: undefined, startDate: "2026-08-14", startsAt: undefined }),
  );

  assert.equal(structuredData?.startDate, "2026-08-14");
  // No end-of-day, no midnight, no duplicate of startDate.
  assert.equal(structuredData?.endDate, undefined);
});

test("adds verified locality and country only to an address the source provided", () => {
  const withAddress = createEventStructuredData(podgoricaEvent({ address: "Njegoševa 1" }));

  assert.equal(withAddress?.location.address.addressLocality, "Podgorica");
  assert.equal(withAddress?.location.address.addressCountry, "ME");
  assert.equal(withAddress?.location.address.streetAddress, "Njegoševa 1");
});

// Policy change driven by the Search Console "Missing field location" error. Google requires
// location.address, and previously a venue-only event (i.e. every event we hold, since no
// collector supplies a street address) emitted a Place with no address at all. The city a named
// venue sits in is a verified registry fact, so it is asserted; the street is not invented.
test("gives a named venue the verified city as its address, without inventing a street", () => {
  const venueOnly = createEventStructuredData(
    podgoricaEvent({ address: undefined, venueName: "KIC Budo Tomović" }),
  );

  assert.deepEqual(venueOnly?.location, {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: "ME",
      addressLocality: "Podgorica",
    },
    name: "KIC Budo Tomović",
  });
  assert.equal("streetAddress" in (venueOnly?.location.address ?? {}), false);
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

test("emits no Event markup for an event whose source named no venue", () => {
  // Tourism Tivat supplies no venue at all, so there is no truthful Place to build. Withholding
  // the markup is the deliberate choice — the alternative is an Event without the location Google
  // requires, which is exactly the Search Console error being fixed.
  for (const venueName of [undefined, "", "   "]) {
    const structuredData = createEventStructuredData(
      podgoricaEvent({ address: undefined, venueName }),
    );

    assert.equal(structuredData, undefined, JSON.stringify(venueName));
    assert.deepEqual(
      getEventStructuredDataEligibility(podgoricaEvent({ venueName })),
      { eligible: false, reason: "missing-location" },
    );
  }
});

test("withholding Event markup leaves the page and its breadcrumb untouched", async () => {
  const city = getCity("podgorica");
  assert.ok(city);
  const event = podgoricaEvent({ venueName: undefined });
  const route = await readFile(
    new URL("../../../app/[city]/dogadjaji/[eventId]/page.tsx", import.meta.url),
    "utf8",
  );

  // BreadcrumbList is built independently and is not gated on the Event object.
  assert.equal(createEventStructuredData(event), undefined);
  assert.equal(createEventBreadcrumbStructuredData(city, event).itemListElement.length, 4);
  assert.match(route, /\{structuredData \? \(/u);
  assert.match(route, /const breadcrumbStructuredData = createEventBreadcrumbStructuredData\(/u);
  // The page still resolves, stays canonical and is never noindexed because markup was withheld.
  assert.match(route, /canonical: getEventDetailPath\(context\.city, event\.id\),/u);
  assert.doesNotMatch(route, /noindex/u);
});

test("location.name is always the venue, never the event title or the city", () => {
  const structuredData = createEventStructuredData(
    podgoricaEvent({ title: "Ljetnji koncert", venueName: "KIC Budo Tomović" }),
  );

  assert.equal(structuredData?.location.name, "KIC Budo Tomović");
  assert.notEqual(structuredData?.location.name, "Ljetnji koncert");
  assert.notEqual(structuredData?.location.name, "Podgorica");
});

test("maps only the two provider-asserted states, and never invents a completed status", () => {
  assert.equal(getEventSchemaStatus("cancelled"), "https://schema.org/EventCancelled");
  assert.equal(getEventSchemaStatus("postponed"), "https://schema.org/EventPostponed");
  for (const status of ["scheduled", "active", "completed"] as const) {
    assert.equal(getEventSchemaStatus(status), "https://schema.org/EventScheduled", status);
  }
  // A past event that simply happened keeps EventScheduled — schema.org defines no completed
  // state, so there is nothing truthful to say beyond "it was scheduled and not called off".
  const expired = createEventStructuredData(
    podgoricaEvent({ startsAt: "2020-01-01T18:00:00.000Z", status: "completed" }),
  );
  assert.equal(expired?.eventStatus, "https://schema.org/EventScheduled");
  assert.doesNotMatch(JSON.stringify(expired), /EventCompleted/u);
});

test("emits endDate only from a provider-supplied end", () => {
  const withEnd = createEventStructuredData(
    podgoricaEvent({ endsAt: "2026-07-17T20:00:00.000Z", startsAt: "2026-07-17T18:00:00.000Z" }),
  );
  const withoutEnd = createEventStructuredData(podgoricaEvent({ endsAt: undefined }));

  assert.equal(withEnd?.endDate, "2026-07-17T20:00:00.000Z");
  assert.equal(withoutEnd?.endDate, undefined);
  assert.notEqual(withoutEnd?.endDate, withoutEnd?.startDate);
});

test("emits organizer only when the source states one, and never names Gradom.me", () => {
  const withOrganizer = createEventStructuredData(podgoricaEvent({ organizer: "KIC" }));
  const withoutOrganizer = createEventStructuredData(podgoricaEvent({ organizer: undefined }));

  assert.deepEqual(withOrganizer?.organizer, { "@type": "Organization", name: "KIC" });
  assert.equal(withoutOrganizer?.organizer, undefined);
  assert.doesNotMatch(JSON.stringify(withoutOrganizer), /Gradom/u);
});

test("omits performer and offers, which no provider can currently substantiate", () => {
  // CNP normalizes priceAmount/currency/isFree but exposes no ticket URL, so an Offer would be
  // incomplete; no provider exposes a performer field at all. Both stay absent rather than fake.
  const priced = createEventStructuredData(
    podgoricaEvent({ currency: "EUR", isFree: false, priceAmount: 10 }),
  );
  const free = createEventStructuredData(podgoricaEvent({ isFree: true }));

  for (const structuredData of [priced, free]) {
    const serialized = JSON.stringify(structuredData);
    assert.doesNotMatch(serialized, /performer/u);
    assert.doesNotMatch(serialized, /offers|Offer|priceCurrency/u);
  }
});

// FULL vs PARTIAL location. Both are truthful and both satisfy Google's required
// location/location.name/location.address; only CNP-staged events can currently carry the
// "detailed street address" the documentation asks for.
test("emits a full street address when the provider verified one", () => {
  const full = createEventStructuredData(
    podgoricaEvent({
      address: "Stanka Dragojevića bb, Podgorica",
      venueName: "Crnogorsko narodno pozorište",
    }),
  );

  assert.deepEqual(full?.location, {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: "ME",
      addressLocality: "Podgorica",
      streetAddress: "Stanka Dragojevića bb, Podgorica",
    },
    name: "Crnogorsko narodno pozorište",
  });
});

test("degrades to city-level precision rather than inventing a street", () => {
  const partial = createEventStructuredData(
    podgoricaEvent({ address: undefined, venueName: "Trg nezavisnosti" }),
  );

  assert.equal(partial?.location.address.streetAddress, undefined);
  assert.equal(partial?.location.address.addressLocality, "Podgorica");
  // The venue name still identifies the place; nothing about the street is asserted.
  assert.equal(partial?.location.name, "Trg nezavisnosti");
});
