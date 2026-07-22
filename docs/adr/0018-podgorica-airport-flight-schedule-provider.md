# ADR 0018: Podgorica Airport flight-schedule provider

- Status: Accepted
- Date: 2026-07-22

## Context

Gradom needs a cache-backed public view of the next arrivals and departures at Aerodrom Podgorica. Visitor requests must not fetch an upstream flight source, and the implementation must not rely on an undocumented API.

## Decision

Use the official Airports of Montenegro Podgorica schedule page at `https://montenegroairports.com/aerodrom-podgorica/destinacije/`. No documented public API was available during source evaluation, so the provider makes bounded server-side HTML requests for the current and following Podgorica-local timetable dates.

The provider accepts only HTTPS URLs on `montenegroairports.com` and `www.montenegroairports.com`, uses a ten-second timeout, one transient retry, an explicit Gradom user agent, HTML/content-size validation, and a semantic table-header parser. It normalizes arrivals and departures into the module-owned `Flight` model, preserves missing optional fields, sorts by the timezone-aware scheduled instant, and deduplicates by direction, scheduled time, location, and flight number.

`pnpm run collect:podgorica-flights` writes `.runtime/cache/podgorica-flights.json` atomically. The collector retains a prior valid snapshot if fetching or parsing fails. The homepage and `/me/letovi` read only that cache. The bundled scheduler refreshes it every 30 minutes; application requests never collect schedule data.

## Consequences

- The source remains official and the public UI stays available from a retained, potentially stale snapshot when the airport source is unavailable.
- Fixture-based tests use saved official-style HTML and injected HTTP only; they never access the live airport website.
- The page may change its table headings or markup. A missing recognizable arrivals/departures table is treated as a parser failure rather than an empty timetable, preserving the prior cache.
- The schedule is not a live operational feed. Displayed times and statuses are only as current as the official page and the latest successful collection.
