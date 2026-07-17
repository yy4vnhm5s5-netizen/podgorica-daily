# ADR 0006: Use a provider-neutral mock for City Alerts

- Status: Superseded by ADR 0007
- Date: 2026-07-17

## Context

City Alerts will eventually communicate active disruptions from several organisations, including CEDIS, Vodovod, Glavni grad, AMSCG, and official meteorological-warning sources. Provider contracts, provenance, availability expectations, licensing, and operational ownership have not yet been approved. The interface must be validated without presenting mock content as live public-safety information.

## Decision

Create the `city-alerts` module behind the `cityAlerts` feature flag. Its domain defines a provider interface and normalized alert contract for supported types, severity, areas, time bounds, and source attribution. The initial infrastructure adapter is a mock provider whose content is typed as demo content. The application layer filters resolved alerts before the presentation layer receives them. The presentation layer localizes demo content, makes severity visible through a text badge and colour accent, and labels the section and source data as `Demo`.

At the time of this decision, no live provider, ingestion, scraping, persistence, API route, or external request was introduced. ADR 0007 supersedes this limitation for cached CEDIS planned power outages. Future Vodovod, Glavni grad, AMSCG, and meteorological adapters must map their validated source payloads to the module-owned contract and preserve source, freshness, attribution, timeout, retry, cache, stale-data, and monitoring policies.

## Consequences

- The dashboard can evaluate active-alert hierarchy, responsive density, and safe state handling without fabricating live disruptions.
- Provider adapters can be replaced or added in infrastructure without changing presentation components.
- The original mock implementation remains available only as an explicit development-mode provider. CEDIS live-data behaviour is defined by ADR 0007.
