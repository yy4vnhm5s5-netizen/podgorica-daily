import assert from "node:assert/strict";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  createGoingOutDetailMetadataDescription,
  createGoingOutDetailMetadataTitle,
  maximumGoingOutDetailMetadataDescriptionLength,
  maximumGoingOutDetailMetadataTitleLength,
} from "./going-out-detail-metadata.ts";
import { createCityContext } from "@/shared/config/cities";

const city = createCityContext("kotor").city;

function event(overrides: Partial<GoingOutEvent> = {}): GoingOutEvent {
  return {
    city: "kotor",
    description: "Koncert na otvorenom uz lokalne izvođače.",
    id: "fixture",
    sourceEventId: "7465",
    sourceName: "MonteGigs",
    sourceUrl: "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru",
    startDate: "2026-08-12",
    title: "Koncert u Kotoru",
    venue: "Pjaca od kina",
    ...overrides,
  };
}

test("keeps normal Going Out metadata titles intact with city and Gradom.me context", () => {
  assert.equal(
    createGoingOutDetailMetadataTitle({ city, event: event({ title: "Koncert u Kotoru" }) }),
    "Koncert u Kotoru | Gradom.me",
  );
});

test("bounds only a long imported title while the visible event title stays full", () => {
  const title =
    "Završni koncerti XV Ljetnjeg kampa za kamernu muziku uz gostujuće izvođače u Kotoru";
  const metadataTitle = createGoingOutDetailMetadataTitle({ city, event: event({ title }) });

  assert.ok(metadataTitle.length <= maximumGoingOutDetailMetadataTitleLength);
  assert.match(metadataTitle, /… — Kotor \| Gradom\.me$/u);
  assert.equal(title.includes(metadataTitle), false);
  assert.equal(event({ title }).title, title);
});

test("builds a concise normalized description without needing every optional field", () => {
  const description = createGoingOutDetailMetadataDescription({
    cityLocative: "Kotoru",
    event: event({
      description: "\n<p>Program&nbsp;sa <strong>više</strong> izvođača &amp; gostima.</p>\n",
      venue: undefined,
    }),
    schedule: "12. 8. 2026. · 20:30",
  });

  assert.equal(
    description,
    "Događaj Koncert u Kotoru u Kotoru, 12. 8. 2026. · 20:30. Program sa više izvođača & gostima.",
  );
  assert.doesNotMatch(description, /<[^>]+>|&nbsp;|\n/u);
});

test("caps a long source description at a word boundary", () => {
  const sourceDescription = `${"Detaljan opis programa za posjetioce ".repeat(12)}završetak`;
  const description = createGoingOutDetailMetadataDescription({
    cityLocative: "Kotoru",
    event: event({ description: sourceDescription }),
  });

  assert.ok(description.length <= maximumGoingOutDetailMetadataDescriptionLength);
  assert.match(description, /…$/u);
  assert.equal(sourceDescription.includes(description), false);
});
