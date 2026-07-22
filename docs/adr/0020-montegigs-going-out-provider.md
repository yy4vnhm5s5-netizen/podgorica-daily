# ADR 0020: MonteGigs Podgorica going-out provider

- Status: Accepted
- Date: 2026-07-22

## Context

Gradom needs a compact nightlife and music surface that remains separate from the established official-source Event Platform. MonteGigs publicly renders a Podgorica listing with event URLs, titles, posters, and dates. Its listing may omit a start time.

## Decision

Create a module-owned `going-out` boundary. Its collector requests only `https://staging.montegigs.me/me/events/podgorica` with an allow-listed HTTPS client, ten-second timeout, one transient retry, response-size limit, and product user agent. It parses public Podgorica event URLs, normalizes only explicit fields, filters past local calendar days in `Europe/Podgorica`, and writes `.runtime/cache/montegigs-going-out.json` atomically.

The dashboard and `/podgorica/izlasci` read only the normalized cache. A failed request or unrecognized document retains the most recent valid snapshot; an explicitly recognized listing with no future events may write a confirmed empty snapshot. The bundled scheduler runs `pnpm run collect:montegigs-going-out` hourly. The feature is controlled by `ENABLE_GOING_OUT`.

## Consequences

- This is intentionally not a provider inside `src/modules/events`; its limited model and lifecycle are independent.
- Event posters remain source-attributed links to MonteGigs. Missing time is displayed as unavailable rather than invented.
- Parser and refresh tests use local fixtures and injected HTTP; page reads never make live requests.
- The source is a public staging listing, not an official public API. No terms or robots policy was discoverable during implementation; an operator must confirm permission and published policy with MonteGigs before enabling production collection.
