# Podgorica Daily

Podgorica Daily is a production-oriented local information platform for Podgorica. It currently provides server-rendered current weather, a deterministic Daily Overview, and City Alerts backed by cached CEDIS planned power-outage data when a collector snapshot is available. Transport, event listings, maps, search, and editorial workflows are not yet implemented.

Daily Overview is a zero-cost deterministic summary generated from normalized cached city data. It does not use generative services, language models, or visitor-triggered data collection.

## CEDIS planned outages

CEDIS data is collected only by the cache-backed command below; dashboard requests never scrape CEDIS. The default provider mode is `live`, which reads a local cached snapshot and reports the source as unavailable until one exists. Set `CEDIS_PROVIDER_MODE=mock` only for explicit development previews; production rejects mock mode.

```bash
pnpm run collect:cedis
```

Refresh every 60 minutes with a local cron job, GitHub Actions scheduling, or Vercel Cron where a durable cache is available. The file cache at `.runtime/cache/cedis-planned-outages.json` persists locally and on a VPS, but is not durable on serverless/Vercel filesystems. See [ADR 0007](docs/adr/0007-cedis-cached-planned-outages.md) for collection, cache, and exit-code behaviour.

AMSCG road conditions use the same cache-first boundary and can be collected manually with `pnpm run collect:amscg`. Its source is the official [AMSCG road-conditions page](https://amscg.org/stanje-na-putevima/); see [ADR 0008](docs/adr/0008-amscg-cached-road-conditions.md).

The default language is Montenegrin Latin, ijekavian (`/me`). English is available at `/en`; the root route redirects to `/me`.

## City-aware foundation

Podgorica is the only enabled city and the public experience remains unchanged. Internally, providers receive a city context and normalized records carry `cityIds`, preparing future city-specific routes without exposing them today. `DEFAULT_CITY=podgorica` is validated against the central registry. See [ADR 0009](docs/adr/0009-multi-city-platform-foundation.md).

## Event platform foundation

The repository includes a disabled, city-aware Event Platform foundation: normalized event and venue contracts, cache and provider boundaries, deterministic IDs and deduplication, recurrence limits, timezone-aware query rules, and a provider-agnostic Daily Overview contract. It has no source adapter, collector, route, or visible UI. `ENABLE_EVENTS=false` and `EVENT_PROVIDER_MODE=disabled` preserve the current public behaviour. See [ADR 0010](docs/adr/0010-event-platform-foundation.md).

KIC Budo Tomović is the first approved official event source. Its collector reads the official KIC news feed and individual programme articles into a cache; visitor requests read only that cache. It remains inactive until `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` are explicitly configured.

```bash
pnpm run collect:kic-events
```

## Architecture

The project is a modular monolith. Presentation, application, domain, and infrastructure concerns remain separated, and future features own their code beneath `src/modules`. Shared components and utilities are deliberately restricted to cross-cutting concerns.

The project specifications in [`docs/`](docs/) are the source of truth for product scope, architecture, data, UI, API, and source-ingestion decisions.

## Development

Use Node.js 22 or newer.

```bash
pnpm install
pnpm run dev
```

Run the quality suite before opening a pull request:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Container runtime

Build and run the production image locally:

```bash
docker compose up --build
```

The service listens on `http://localhost:3000`.
