# ADR 0005: Use a deterministic Daily Overview over cached city data

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily needs a readable daily city overview without generating or inventing information. The project must remain zero-cost for this capability and must not use external generative services, language models, generative APIs, or any usage-based content-generation service. Visitors must never trigger scraping or provider refreshes while loading a page.

## Decision

Create the `daily-overview` module behind the `dailyOverview` feature flag. Its pure domain generator accepts only a normalized `CityDataSnapshot` and produces two to five localized sentences in Montenegrin Latin or English. It uses explicit rules to prioritize critical alerts, mention unusual temperatures, power or water outages, weather warnings, event counts, and air quality only when those categories are available. When no active alerts are available, it says so plainly.

The generator has no imports from scraping, APIs, databases, providers, React, or Next.js. An application use case reads a `CachedCityDataProvider` and passes the snapshot to the generator. The initial cache provider returns clearly marked mock data; the UI exposes that condition.

Future background collection follows this direction:

```text
Scheduler → Scrapers → Normalization → Cached providers → Daily Overview generator → UI
```

Scheduled provider contracts define the expected cache-refresh intervals: weather every 30 minutes; events and air quality every hour. The deployed CEDIS and VIK Podgorica adapters refresh every 30 minutes through the protected City Alerts refresh route or the Compose scheduler; this is the current bounded cadence for those official sources. Future Open-Meteo, CEDIS, Vodovod, Glavni grad, meteorological-warning, and event-source adapters must write normalized data to the cache. The website reads cached provider data only.

## Consequences

- Daily Overview remains deterministic, auditable, and free of usage-based generation costs.
- The summary cannot invent, guess, or mention unavailable categories because it only evaluates typed available data.
- A future scheduler and cache implementation can be added behind the provider contract without changing the generator or UI.
- The mock cache and its visible demo notice must be replaced before Daily Overview is represented as live city information.
