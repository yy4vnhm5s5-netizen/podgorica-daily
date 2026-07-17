# ADR 0014: Collect Glavni Grad Podgorica public events through a cache-backed provider

- Status: Accepted
- Date: 2026-07-17

## Context

Glavni Grad publishes scheduled public events on its official `Aktuelni događaji` category. The Event Platform requires a first-party city source that remains isolated from visitor requests.

## Decision

Use provider `glavni-grad-podgorica` with the official `https://podgorica.me/category/aktuelni-dogadjaji/` listing. Collection accepts only HTTPS `podgorica.me` URLs, discovers same-host detail pages, uses a 10-second timeout, one retry, the Podgorica Daily user agent, typed failures, and injected HTTP tests.

The provider supports Podgorica only. It parses explicit title, description, date, time, image, status wording, category hints, and venue text without inventing absent values. The collector normalizes records through Event Quality and shared deduplication, then atomically writes `.runtime/cache/glavni-grad-events.json`. It runs only through `pnpm run collect:glavni-grad-events` at an intended 60-minute cadence.

Application reads require `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`, read caches only, and never call a collector or HTTP client. CNP, KIC, and Glavni Grad failures stay isolated; shared exact/strong deduplication preserves provenance and separate performances. Tests use local fixtures only.

## Consequences

- No Events route or UI is introduced.
- Changing markup or incomplete schedule prose can limit extraction; missing fields remain unavailable with warnings.
- The local file cache is not durable shared storage on serverless deployments.
