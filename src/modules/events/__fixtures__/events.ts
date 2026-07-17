import type { CityEvent } from "../domain/event.ts";

const podgoricaEvent = (overrides: Partial<CityEvent> = {}): CityEvent => ({
  category: "concert",
  cityIds: ["podgorica"],
  id: "event_fixture",
  language: "me",
  sourceId: "fixture-source",
  sourceName: "Fixture Source",
  sourceReferences: [
    {
      sourceId: "fixture-source",
      sourceName: "Fixture Source",
      sourceUrl: "https://events.example.test/fixture",
    },
  ],
  sourceUrl: "https://events.example.test/fixture",
  startsAt: "2026-07-17T18:00:00.000Z",
  status: "scheduled",
  tags: [],
  timezone: "Europe/Podgorica",
  title: "Ljetnji koncert",
  venueName: "KIC Budo Tomović",
  ...overrides,
});

export { podgoricaEvent };
