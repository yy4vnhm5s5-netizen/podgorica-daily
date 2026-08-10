import assert from "node:assert/strict";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  createGoingOutDetailBreadcrumbStructuredData,
  createGoingOutDetailStructuredData,
  getGoingOutDetailBreadcrumbTrail,
  isReliablyMusicEvent,
} from "./going-out-detail-structured-data.ts";
import { createCityContext } from "@/shared/config/cities";

const city = createCityContext("kotor").city;

function event(overrides: Partial<GoingOutEvent> = {}): GoingOutEvent {
  return {
    address: "Stari grad, Kotor",
    city: "kotor",
    description: "Koncert na otvorenom uz lokalne izvođače.",
    eventType: "Concert",
    id: "fixture",
    informationUrl: "https://example.org/program",
    isFree: true,
    organizer: "Kulturni centar Kotor",
    performers: ["Izvođač"],
    priceLabel: "30-40",
    sourceEventId: "7465",
    sourceName: "MonteGigs",
    sourceUrl: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    startDate: "2026-08-12",
    startsAt: "2026-08-12T18:30:00.000Z",
    title: "Koncert u Kotoru",
    venue: "Pjaca od kina",
    ...overrides,
  };
}

test("emits conservative source-backed MusicEvent structured data", () => {
  const data = createGoingOutDetailStructuredData(event(), city);
  assert.deepEqual(data, {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    description: "Koncert na otvorenom uz lokalne izvođače.",
    isAccessibleForFree: true,
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ME",
        addressLocality: "Kotor",
        streetAddress: "Stari grad, Kotor",
      },
      name: "Pjaca od kina",
    },
    name: "Koncert u Kotoru",
    organizer: { "@type": "Organization", name: "Kulturni centar Kotor" },
    performer: [{ "@type": "PerformingGroup", name: "Izvođač" }],
    sameAs: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    startDate: "2026-08-12T18:30:00.000Z",
    url: "https://gradom.me/kotor/izlasci/montegigs-7465",
  });
  assert.doesNotMatch(JSON.stringify(data), /offers|Offer|priceCurrency|30-40/u);
});

test("uses generic Event unless the source event type is explicitly music semantics", () => {
  assert.equal(isReliablyMusicEvent(event({ eventType: "Nightlife" })), false);
  assert.equal(
    createGoingOutDetailStructuredData(event({ eventType: "Nightlife" }), city)?.["@type"],
    "Event",
  );
});

test("withholds Event markup when the provider did not name a venue or source-backed address", () => {
  assert.equal(createGoingOutDetailStructuredData(event({ venue: undefined }), city), undefined);
  assert.equal(createGoingOutDetailStructuredData(event({ address: undefined }), city), undefined);
});

test("keeps BreadcrumbList available when Event markup is withheld for a missing address", () => {
  const withoutAddress = event({ address: undefined });

  assert.equal(createGoingOutDetailStructuredData(withoutAddress, city), undefined);
  assert.deepEqual(
    createGoingOutDetailBreadcrumbStructuredData(city, withoutAddress).itemListElement.map(
      ({ item, name, position }) => ({ item, name, position }),
    ),
    [
      { item: "https://gradom.me/kotor", name: "Kotor", position: 1 },
      { item: "https://gradom.me/kotor/izlasci", name: "Izlasci", position: 2 },
      {
        item: "https://gradom.me/kotor/izlasci/montegigs-7465",
        name: "Koncert u Kotoru",
        position: 3,
      },
    ],
  );
});

test("uses one breadcrumb trail for visible navigation and BreadcrumbList", () => {
  const trail = getGoingOutDetailBreadcrumbTrail(city, event());
  const structuredData = createGoingOutDetailBreadcrumbStructuredData(city, event());

  assert.deepEqual(
    trail.map(({ href, name }) => ({ href, name })),
    [
      { href: "/kotor", name: "Kotor" },
      { href: "/kotor/izlasci", name: "Izlasci" },
      { href: "/kotor/izlasci/montegigs-7465", name: "Koncert u Kotoru" },
    ],
  );
  assert.deepEqual(
    structuredData.itemListElement.map(({ item, name, position }) => ({ item, name, position })),
    trail.map(({ name, url }, index) => ({ item: url, name, position: index + 1 })),
  );
});
