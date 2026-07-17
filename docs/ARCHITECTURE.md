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

Event records are city-aware (`cityIds`) and preserve all trusted source references after exact or strong deterministic matches merge. Date-only events remain date-only; timed events use timezone-aware `Europe/Podgorica` conversion. The query layer applies city-local boundaries for today, tomorrow, the current Monday–Sunday week, and the weekend (Friday 18:00 or later only when a time is explicit, Saturday, and Sunday). No public Events UI or source adapter exists in this milestone. See ADR 0010.

## Reliability and security

External integrations require timeouts, bounded retries, structured errors, cache policy, rate limits, and health signals. Authentication and authorization are enforced on the server. Configuration is validated at process start. Logs use structured, privacy-safe fields and carry correlation identifiers.

## CEDIS collection boundary

The City Alerts CEDIS adapter is the first approved collector. Its dependency direction is `collector → CEDIS HTTP adapter → parser/normalizer → file cache → City Alerts application → presentation`. Page requests stop at the cache boundary; they never invoke collection. The Daily Overview receives a generic City Alerts read model rather than CEDIS infrastructure. The file-backed cache is suitable for local development and persistent servers, but a durable adapter is required for serverless deployments. See ADR 0007.
