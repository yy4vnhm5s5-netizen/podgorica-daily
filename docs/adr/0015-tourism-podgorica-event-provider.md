# ADR 0015: Collect Tourism Organization Podgorica calendar events through a cache-backed provider

- Status: Accepted
- Date: 2026-07-17

## Context

The Event Platform already provides provider registration, bounded HTTP conventions, deterministic candidate normalization, Event Quality, atomic cache persistence, and cache-only application reads. Turistička organizacija Podgorice publishes an official calendar suitable for a fourth Podgorica-only provider, but its live markup and schedule prose remain an untrusted external boundary.

## Decision

Use `tourism-podgorica` with the official `https://podgorica.travel/dogadjaji-kalendar/` calendar. Requests are limited to HTTPS `podgorica.travel` and `www.podgorica.travel`, with a 10-second timeout, one bounded transient retry, typed failures, and a Podgorica Daily user agent.

The parser resolves only same-host details and extracts explicit fields without inventing missing data. Refresh normalizes through Event Quality, retains diagnostics and rejected IDs, atomically writes `.runtime/cache/tourism-events.json`, and preserves a usable prior cache on zero-valid or full-refresh failure. `pnpm run collect:tourism-events` is the only collection entry point. Application reads are cache-only and require `ENABLE_EVENTS=true` with `EVENT_PROVIDER_MODE=live`; tests use fixtures and injected HTTP only.

## Consequences

- No public Events UI or route is introduced.
- Changing markup, load-more behavior, and incomplete schedule prose can limit extraction.
- The file cache is not durable shared storage for serverless deployment.
