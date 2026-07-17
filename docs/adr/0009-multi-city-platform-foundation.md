# ADR 0009: Establish a city-aware platform foundation

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily is currently deployed for one city, but its provider, cache, and overview boundaries must evolve without a later platform rewrite. Public behaviour must remain Podgorica-only until a city rollout is explicitly approved.

## Decision

Introduce a central city registry and `CityContext` containing the selected city, locale, and time zone. `DEFAULT_CITY` selects the current city and validates against the registry. Podgorica is the only enabled city; Bar and Nikšić are present only as disabled registry entries.

City-aware models use `cityIds: CityId[]`, allowing one normalized record to be relevant to more than one city. Providers receive `CityContext`, while provider metadata is registered centrally with official source, refresh interval, cache path, enabled state, and multi-city capability. CEDIS, AMSCG, and Weather are registered today.

Use shared generic JSON-cache helpers for freshness calculation and atomic file writes. CEDIS and AMSCG retain module-owned snapshot contracts and collector boundaries while sharing this mechanism. Feature flags `ENABLE_CEDIS`, `ENABLE_AMSCG`, and `ENABLE_WEATHER` default to enabled to preserve behaviour. Future city URL helpers can construct `/{city-slug}`, but no city routes or selector are exposed yet.

Daily Overview receives `CityContext`, generic city-aware snapshots, and generic alert read models. It derives city naming from context rather than assuming Podgorica.

## Consequences

- Current routes, branding, locale behaviour, and Podgorica output remain unchanged.
- A future city rollout needs only an enabled registry entry, provider coverage review, cache strategy, and approved routing/UI scope.
- Disabled registry entries must not cause collection, routing, or UI exposure.
- City-aware persistence, events, and air-quality models are deferred until those modules exist; no speculative feature models are added.
