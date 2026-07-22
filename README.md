# Gradom

Gradom is a production-oriented local information platform for Podgorica. It provides current weather, a deterministic Daily Overview, City Alerts backed by cached official CEDIS planned power-outage, AMSCG road-condition, and VIK Podgorica water-service snapshots, a cache-backed public Events experience, a Cineplexx programme card, cache-backed Aerodrom Podgorica flights and ŽPCG railway departures, and a BusTicket4.me external link. Maps, unified search, accounts, and editorial workflows are not implemented.

Daily Overview is a zero-cost deterministic summary generated from normalized cached city data. It does not use generative services, language models, or visitor-triggered data collection.

## CEDIS planned outages

CEDIS data is collected only by the cache-backed command below; dashboard requests never scrape CEDIS. The default provider mode is `live`, which reads a local cached snapshot and reports the source as unavailable until one exists. Set `CEDIS_PROVIDER_MODE=mock` only for explicit development previews; production rejects mock mode.

```bash
pnpm run collect:cedis
```

The bundled VPS scheduler refreshes CEDIS every 30 minutes. The file cache at `.runtime/cache/cedis-planned-outages.json` persists locally and on a VPS, but is not durable on serverless/Vercel filesystems. See [ADR 0007](docs/adr/0007-cedis-cached-planned-outages.md) for collection, cache, and exit-code behaviour.

AMSCG road conditions use the same cache-first boundary and can be collected manually with `pnpm run collect:amscg`. Its source is the official [AMSCG road-conditions page](https://amscg.org/stanje-na-putevima/); see [ADR 0008](docs/adr/0008-amscg-cached-road-conditions.md).

## VIK Podgorica water notices

VIK Podgorica water-service notices are collected only through `pnpm run collect:vikpg`. The collector fetches the official service-information page and validated first-party notice links, then atomically writes `.runtime/cache/vikpg-water-alerts.json`. Dashboard requests read that cache only. `ENABLE_VIKPG=true` and `VIKPG_PROVIDER_MODE=live` are required to expose live cached data; no mock water notices are used. Tests use local fixtures and injected HTTP, never live VIK requests. See [ADR 0016](docs/adr/0016-vikpg-cached-water-notices.md).

The public interface currently exposes Montenegrin Latin, ijekavian (`/me`); the root route redirects to `/me`. English translations and locale infrastructure remain in the repository for a future rollout. Legacy `/en/*` URLs receive permanent redirects to their primary equivalents.

## Transport

The BusTicket4.me link remains external only; Gradom does not collect or republish bus departures. The ŽPCG railway card reads a cache generated solely from the official [ŽPCG timetable](https://zpcg.me/red-voznje/ukupno). Run `pnpm run collect:zpcg-railway` to write `.runtime/cache/zpcg-railway-departures.json`; homepage requests never fetch ŽPCG directly. The bundled VPS scheduler refreshes it at approximately 06:45 and 18:45 host-local time.

The Aerodrom Podgorica card and `/me/letovi` read arrivals and departures only from `.runtime/cache/podgorica-flights.json`. `pnpm run collect:podgorica-flights` fetches the official [Airports of Montenegro Podgorica schedule](https://montenegroairports.com/aerodrom-podgorica/destinacije/) for the current and following local date. It uses bounded HTML collection and retains a valid cache if the source is unavailable; no page request fetches the airport website. See [ADR 0018](docs/adr/0018-podgorica-airport-flight-schedule-provider.md).

## Contact

Gradom’s public contact page is available at `/me/kontakt` for advertising and business inquiries. It validates requests on the server, rejects a hidden honeypot field, and uses a small in-memory limit of five requests per client address per 15 minutes on the current single-instance deployment. Inquiries are not stored by Gradom; a successful response is returned only after SMTP accepts delivery.

Configure `CONTACT_EMAIL`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and, when required by the SMTP server, `SMTP_USERNAME` and `SMTP_PASSWORD` as server-only values. Until that complete configuration exists, the form safely reports that delivery is unavailable rather than claiming an inquiry was sent.

## City-aware foundation

Podgorica is the only enabled city and the public experience remains unchanged. Internally, providers receive a city context and normalized records carry `cityIds`, preparing future city-specific routes without exposing them today. `DEFAULT_CITY=podgorica` is validated against the central registry. See [ADR 0009](docs/adr/0009-multi-city-platform-foundation.md).

## Event platform and official collectors

The repository includes a city-aware Event Platform: normalized event and venue contracts, cache and provider boundaries, deterministic IDs and deduplication, recurrence limits, timezone-aware query rules, and a provider-agnostic Daily Overview contract. The mobile-first public Events experience is available at `/me/events` (with `/events` redirecting to the default locale); live provider content remains available only when `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`. See [ADR 0010](docs/adr/0010-event-platform-foundation.md).

KIC Budo Tomović, Crnogorsko narodno pozorište (CNP), Glavni Grad Podgorica, Turistička organizacija Podgorice, and Cineplexx Podgorica are approved official event sources. Their collectors read only official source pages into separate caches; Cineplexx renders its public JavaScript programme page through a bounded server-side browser process because no public server-rendered repertoire is available. Application reads use caches only. Providers remain inactive until `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` are explicitly configured. Mock mode never enables live providers and is rejected in production.

Event collection applies deterministic quality validation before caching. It preserves valid date-only and incomplete events with warnings, rejects invalid core records, and records collector diagnostics without exposing rejected data. See [ADR 0012](docs/adr/0012-event-quality-layer.md).

Quality policy and provider-health thresholds are validated server configuration; see `.env.example`. Event reads remain cache-only and provide non-public provider-status diagnostics for future operations tooling.

```bash
pnpm run collect:kic-events
pnpm run collect:cnp-events
pnpm run collect:glavni-grad-events
pnpm run collect:tourism-events
pnpm run collect:cineplexx-events
```

CNP uses the official [CNP repertoire](https://cnp.me/repertoar/) and writes `.runtime/cache/cnp-events.json`. Its collector uses fixture-only automated tests; tests make no live network calls. See [ADR 0013](docs/adr/0013-cnp-event-provider.md).

Glavni Grad uses the official [Aktuelni događaji](https://podgorica.me/category/aktuelni-dogadjaji/) listing and writes `.runtime/cache/glavni-grad-events.json`. See [ADR 0014](docs/adr/0014-glavni-grad-podgorica-event-provider.md).

Turistička organizacija Podgorice uses the official [calendar](https://podgorica.travel/dogadjaji-kalendar/) and writes `.runtime/cache/tourism-events.json`. Its listing/detail parsing, HTTP behaviour, refresh flow, and cache-backed reads are fixture-tested with injected HTTP only; automated tests never call the live source. See [ADR 0015](docs/adr/0015-tourism-podgorica-event-provider.md).

The Events UI groups accepted cached events by day and supports shareable URL filters for text, date, source, category, and sort order. Event detail pages preserve official attribution and link to the original source. Neither the listing nor detail route fetches provider websites; unavailable providers do not hide events from other usable caches.

## Architecture

Deployment preparation is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The recommended first production target is a single VPS with Docker Compose and a persistent shared cache volume; deployment itself remains an operator task.

Railway preparation is documented in [docs/DEPLOYMENT_RAILWAY.md](docs/DEPLOYMENT_RAILWAY.md). Railway is a managed, portable first target; Podgorica is the current rollout, while platform infrastructure remains city-neutral.

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
