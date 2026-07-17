# Roadmap

## Sprint 0 — Specification

Create and review the project documentation and GitHub issues. No application code is introduced.

## Foundation — Complete (v0.1.0-foundation)

Bootstrapped the runtime, quality gates, UI system, environment validation, container build, delivery pipeline, architecture decision records, application shell, feature flags, and engineering handbook. Product modules remain intentionally unimplemented.

## Trusted local data

Current weather for Podgorica is delivered through an isolated Open-Meteo adapter with attribution, freshness, and safe loading, empty, and error states. Transport and events remain future independently deployable increments; each requires provenance, stale-data behaviour, monitoring, and accessible states.

City Alerts reads cached official CEDIS planned power outages when a collector snapshot is available. It exposes fresh, stale, and unavailable states with source attribution. Mock alerts remain an explicit development-only provider mode; further sources still require their own approved provider contracts, attribution, freshness, outage handling, and monitoring.

Cached AMSCG road-condition publications provide the first traffic source for road works, closures, alternating traffic, restrictions, and important warnings. Real-time traffic, route planning, and transport remain separate future scopes.

## Event platform foundation

The disabled Event Platform defines city-aware event and venue contracts, deterministic candidate normalization, cache-backed provider reads, IDs, deduplication, recurrence limits, query semantics, and Daily Overview event-summary input. KIC Budo Tomović, CNP, Glavni Grad Podgorica, and Turistička organizacija Podgorice collectors/providers are implemented internally; no public Events route or UI is implemented. Before exposing Events, approve source operations, localized presentation, stale/unavailable states, and visible source/freshness attribution.

KIC Budo Tomović is the first approved event source. Its cache-backed provider and collector are implemented but remain disabled by default; visible Events presentation and additional source rollout remain separate scope.

Crnogorsko narodno pozorište (CNP) is the second approved event source. Its cache-backed `cnp` provider reads the official repertoire through `pnpm run collect:cnp-events`, writes `.runtime/cache/cnp-events.json`, and remains disabled until `ENABLE_EVENTS=true` with `EVENT_PROVIDER_MODE=live`. CNP parsing, refresh diagnostics, and application integration are fixture-tested with no live test requests. See ADR 0013.

Glavni Grad Podgorica is the third approved Event source. Its Podgorica-only provider reads the official `Aktuelni događaji` listing through `pnpm run collect:glavni-grad-events`, writes `.runtime/cache/glavni-grad-events.json`, and remains disabled until `ENABLE_EVENTS=true` with `EVENT_PROVIDER_MODE=live`. Parsing is deterministic and fixture-tested; absent schedule fields remain unavailable. No public Events UI exists. See ADR 0014.

Turistička organizacija Podgorice is the fourth approved Event source. Its Podgorica-only provider reads the official calendar through `pnpm run collect:tourism-events`, writes `.runtime/cache/tourism-events.json`, and remains disabled until `ENABLE_EVENTS=true` with `EVENT_PROVIDER_MODE=live`. Listing and detail parsing are deterministic, use fixture-only tests with injected HTTP, and preserve unavailable schedule fields rather than inferring them. No public Events UI exists. See ADR 0015.

Event quality validation now protects cache writes with deterministic acceptance, warning, rejection, score, and count-drop diagnostics. Future provider rollout must preserve this pipeline.

The Event Quality Layer is complete: policy is validated from environment configuration, provider health is deterministic, and cache/application diagnostics are available for future operational UI.

## Platform expansion foundation

The city registry, `CityContext`, provider registry, generic cache helpers, and future city-route helpers are in place. Podgorica remains the only enabled city and public experience. Before enabling another city, approve source coverage, cache durability, city-specific alert filtering, routing/selector UX, localized metadata, and operational ownership.

## Discovery and operations

Add maps, unified search, secure identity, and editorial administration. Introduce the smallest data model and operational workflow required by approved content sources.

## Deterministic daily overview and hardening

Daily Overview is a zero-cost, deterministic summary generated from normalized cached city data. It can consume generic normalized CEDIS power-outage read-model data without depending on CEDIS infrastructure. Add durable cache persistence, scheduled collection operations, provenance review, monitoring, and further approved source contracts before broad production rollout.
