import assert from "node:assert/strict";
import test from "node:test";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import {
  createGoingOutDetailIdentity,
  isGoingOutEventDetailEligible,
  parseGoingOutDetailKey,
  resolvePublicGoingOutDetail,
} from "./going-out-public-detail.ts";
import { createCityContext } from "@/shared/config/cities";

const kotor = createCityContext("kotor");
const now = new Date("2026-08-10T10:00:00.000Z");

function event(overrides: Partial<GoingOutEvent> = {}): GoingOutEvent {
  return {
    city: "kotor",
    description: "Koncert na otvorenom uz lokalne izvođače.",
    id: "fixture|2026-08-12|20:30|koncert-u-kotoru",
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

test("derives and parses the stable provider-prefixed public identity", () => {
  assert.deepEqual(createGoingOutDetailIdentity(event()), {
    provider: "montegigs",
    sourceEventId: "7465",
  });
  assert.deepEqual(parseGoingOutDetailKey("montegigs-7465"), {
    provider: "montegigs",
    sourceEventId: "7465",
  });
  for (const value of ["7465", "montegigs-x", "other-7465", "montegigs-7465-slug"]) {
    assert.equal(parseGoingOutDetailKey(value), undefined, value);
  }
});

test("uses one deterministic quality and lifecycle gate for public details", () => {
  assert.equal(isGoingOutEventDetailEligible(event(), kotor.city, now), true);
  assert.equal(
    isGoingOutEventDetailEligible(event({ description: undefined }), kotor.city, now),
    false,
  );
  assert.equal(
    isGoingOutEventDetailEligible(event({ organizer: undefined }), kotor.city, now),
    true,
  );
  assert.equal(isGoingOutEventDetailEligible(event({ address: undefined }), kotor.city, now), true);
  assert.equal(
    isGoingOutEventDetailEligible(event({ performers: undefined }), kotor.city, now),
    true,
  );
  assert.equal(
    isGoingOutEventDetailEligible(event({ informationUrl: undefined }), kotor.city, now),
    true,
  );
  assert.equal(
    isGoingOutEventDetailEligible(event({ startDate: "2026-08-09" }), kotor.city, now),
    false,
  );
  assert.equal(
    isGoingOutEventDetailEligible(event(), { ...kotor.city, isActive: false }, now),
    false,
  );
  assert.equal(
    isGoingOutEventDetailEligible(event(), { ...kotor.city, capabilities: [] }, now),
    false,
  );
});

test("resolves only a current normal public-snapshot event for its own city", () => {
  const resolved = resolvePublicGoingOutDetail({
    context: kotor,
    eventKey: "montegigs-7465",
    events: [event()],
    now,
    state: "fresh",
  });
  assert.equal(resolved?.title, "Koncert u Kotoru");

  assert.equal(
    resolvePublicGoingOutDetail({
      context: kotor,
      eventKey: "montegigs-7465",
      events: [event({ city: "budva" })],
      now,
      state: "fresh",
    }),
    undefined,
  );
  assert.equal(
    resolvePublicGoingOutDetail({
      context: kotor,
      eventKey: "montegigs-7465",
      events: [event()],
      now,
      state: "unavailable",
    }),
    undefined,
  );
});

test("old snapshots remain readable while incomplete events simply have no internal detail", () => {
  const oldEvent = event({ description: undefined });
  assert.equal(isGoingOutEventDetailEligible(oldEvent, kotor.city, now), false);
  assert.equal(
    resolvePublicGoingOutDetail({
      context: kotor,
      eventKey: "montegigs-7465",
      events: [oldEvent],
      now,
      state: "stale",
    }),
    undefined,
  );
});
