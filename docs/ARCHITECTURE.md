# Architecture

## Direction

The application will use a modular monolith with explicit domain boundaries. This keeps initial operations simple while preventing feature code from becoming a shared, unowned dependency graph.

## Layers

1. **Presentation** renders routes, components, loading states, and accessibility behaviour.
2. **Application** coordinates use cases and authorization without knowing provider-specific details.
3. **Domain** owns business concepts, validation rules, and interfaces.
4. **Infrastructure** implements provider adapters, persistence, queues, caches, and observability.

Dependencies point inward: presentation and infrastructure depend on application/domain contracts; domain code depends on neither framework nor vendor SDKs.

## Modules

Future modules include weather, transport, events, maps, search, identity, editorial administration, and deterministic daily overviews. Modules communicate through typed contracts or events, never through direct access to another module's persistence implementation.

## City-aware platform boundary

The central city registry supplies a `CityContext` with city, locale, and timezone to providers and application use cases. Podgorica is the only enabled city; disabled city entries are planning data only and do not create routes or collection work. Normalized records carry `cityIds` arrays so one source record can be associated with multiple cities. The public application remains on its current Podgorica routes until an explicit routing rollout.

Provider metadata is centrally registered for Weather, CEDIS, and AMSCG. It records ownership-facing source and cache details without moving module implementation into shared code. The shared cache abstraction owns atomic JSON persistence and freshness calculation; each module owns its snapshot schema and stale-data policy.

## Event platform boundary

`src/modules/events` owns the normalized Event and Venue domains, provider contracts, candidate normalization, deterministic ID and deduplication logic, query semantics, and event cache schema. Collection and cache reading are intentionally separate: any future collector writes a module-owned snapshot using shared atomic JSON helpers, while application reads combine only enabled cached providers. No visitor request may invoke collection.

Event records are city-aware (`cityIds`) and preserve all trusted source references after exact or strong deterministic matches merge. KIC, CNP, `glavni-grad-podgorica`, and `tourism-podgorica` are registered cache-backed official providers. The public, mobile-first presentation routes are `src/app/[locale]/events/page.tsx` and `src/app/[locale]/events/[eventId]/page.tsx`; locale-less `/events` paths redirect to the default locale. Each live provider requires `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`; mock and disabled modes do not expose a live provider. Provider failures remain isolated.

Event collectors run normalized records through the module-owned quality pipeline before deduplication and cache writes. Typed reports and cache diagnostics make rejection, warning, score, and count-drop state available without leaking rejected records to public reads. See ADR 0012.

The Event application service composes availability with a separate deterministic quality-health status and exposes a typed non-public provider status read model. Legacy cache snapshots without diagnostics receive safe zero-value defaults.

The CNP provider reads only `.runtime/cache/cnp-events.json` when `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`. Collection is isolated behind `pnpm run collect:cnp-events`; it validates the `cnp.me` HTTPS host, parses listing/detail pages through an injected HTTP client, and writes atomically. CNP and KIC cache reads remain independent, while the application uses shared deterministic sorting, deduplication, provenance retention, rejected-event filtering, and provider-health mapping. No application read path invokes HTTP or a collector. See ADR 0013.

The Tourism Organization Podgorica provider is Podgorica-only. `pnpm run collect:tourism-events` fetches the official `podgorica.travel` calendar and validated same-host event pages through the shared bounded HTTP conventions, runs normalized candidates through Event Quality, and atomically writes `.runtime/cache/tourism-events.json`. Application reads consume that cache only; fixture-based tests use injected HTTP and never access the live source. See ADR 0015.

Events presentation is module-owned under `src/modules/events/presentation`. It applies URL-backed search, date, source, category, and sort filters only to the accepted cached application read model, groups results by local day, and preserves cancellation/postponement text and provenance. The filter sheet is the small client boundary; listing and detail rendering remain server-first. No browser or visitor request calls an event provider, collector, or source website.

## Reliability and security

The first production deployment model is a single VPS with Docker Compose, where the application and staggered collector scheduler share a persistent file-cache volume. This preserves atomic local cache writes and cache-only reads. Serverless or multi-instance deployment is not currently supported because its filesystem is not a durable shared cache. See [DEPLOYMENT.md](DEPLOYMENT.md).

External integrations require timeouts, bounded retries, structured errors, cache policy, rate limits, and health signals. Authentication and authorization are enforced on the server. Configuration is validated at process start. Logs use structured, privacy-safe fields and carry correlation identifiers.

## CEDIS collection boundary

The City Alerts CEDIS adapter is the first approved collector. Its dependency direction is `collector → CEDIS HTTP adapter → parser/normalizer → file cache → City Alerts application → presentation`. Page requests stop at the cache boundary; they never invoke collection. The Daily Overview receives a generic City Alerts read model rather than CEDIS infrastructure. The file-backed cache is suitable for local development and persistent servers, but a durable adapter is required for serverless deployments. See ADR 0007.
