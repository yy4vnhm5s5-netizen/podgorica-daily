# ADR 0024: Configure Airports of Montenegro flight feeds per airport

- Status: Accepted
- Date: 2026-08-10
- Supersedes: ADR 0019

## Context

Gradom.me needs cache-backed arrivals and departures for both officially supported airport cities without turning each airport into a separate provider subsystem. The official Airports of Montenegro pages use one first-party endpoint with airport-specific selectors, but Podgorica and Tivat return distinct documented frontend payload shapes.

## Decision

Keep one Flights module and one authenticated `POST /api/internal/flights/refresh` flow. Configure Podgorica (`airport=pg`) and Tivat (`airport=tv`) explicitly in the module. Each configured source selects its own strict parser: Podgorica accepts its `{ value: [] }` payload, while Tivat accepts its array payload with `TipLeta`, `Datum`, and `Planirano` fields.

Podgorica keeps the legacy `.runtime/cache/podgorica-flights.json` path. Tivat writes `.runtime/cache/tivat-flights.json`. Refresh locks, snapshots, retained-cache behavior, and startup initialization are city-specific. Public reads use only the matching local snapshot; they never call the upstream feed.

## Consequences

- One existing Flights cron and `FLIGHTS_REFRESH_SECRET` cover all active configured airport cities.
- A failure or stale snapshot for one airport does not overwrite or prevent reads for another.
- Adding another airport requires verified official selector and payload evidence before extending the small configuration and parser set.
- The legacy `collect:podgorica-flights` command remains an alias for operational compatibility; `collect:airport-flights` is the canonical multi-airport command.
