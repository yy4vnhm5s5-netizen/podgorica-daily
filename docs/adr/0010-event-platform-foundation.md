# ADR 0010: Establish the Event Platform foundation

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily needs an event capability that can combine official and trusted sources without coupling the public application to scraping, a single provider, or non-deterministic matching. No event source, legal review, or presentation scope is approved yet.

## Decision

Create a disabled `events` module with city-aware Event and Venue domains. Events carry `cityIds`, source attribution and provenance, an explicit status, a timezone, and either an ISO timestamp or a date-only value; date-only data never receives an invented time. Source adapters produce incomplete-safe candidates with raw source text and parser warnings before deterministic normalization.

Future providers receive `CityContext`, expose shared `ProviderMetadata`, and separate collection from cache reads. Event cache snapshots use the shared atomic JSON cache mechanism and record schema version, provider metadata, events, venues, fetch and source-update times, parser warnings, and safe refresh errors. The runtime cache remains ignored by Git. There is no registered production event source, collector, or UI; `ENABLE_EVENTS=false` and `EVENT_PROVIDER_MODE=disabled` are the defaults. Mock mode is explicit and prohibited in production.

Event IDs are a stable SHA-256-derived value from source, city, normalized title, known start value, and normalized venue. Deduplication merges only exact or strong deterministic matches: same source reference, or same city overlap, normalized title, start value, and normalized venue. It does not merge uncertain matches. Merges preserve all source references, prefer higher-priority sources where priorities are supplied, retain the richest description, and let cancelled or postponed status supersede scheduled copies. No AI, embeddings, or fuzzy matching service is used.

All time and query boundaries use the city timezone. Timed local values convert with the IANA timezone rather than fixed offsets. Query rules cover city, date ranges, today, tomorrow, current Monday–Sunday week, Friday after 18:00 only when an explicit start time exists, Saturday, and Sunday. Recurrence representation is deliberately small (one-time, daily, weekly, custom text) and expansion is bounded by caller-provided range and maximum count.

Daily Overview may consume only generic normalized event summaries. It must not import event infrastructure, query caches, or identify individual source websites. Event tests are deterministic and local; no live request is made.

## Consequences

- The current public experience stays unchanged.
- A real source needs an individual provider adapter, fixture set, provenance and legal review, cache refresh policy, priority decision, operational owner, and accessible UI scope before activation.
- The file cache is for development or persistent hosts only; a durable adapter is required before serverless event collection.
