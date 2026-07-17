# ADR 0008: Collect AMSCG road conditions through a cache-backed traffic provider

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily needs official road-condition notices without visitor-triggered collection. AMSCG publishes road conditions at `https://amscg.org/stanje-na-putevima/`, where one publication can contain road works, closures, alternating traffic, restrictions, and warnings.

## Decision

Create an isolated AMSCG infrastructure adapter that fetches only the allowed `https://amscg.org` host using the same bounded HTTP policy as CEDIS: Podgorica Daily user agent, configurable ten-second timeout, and one retry. The deterministic parser converts recognized publication entries into module-owned `RoadAlert` values, preserving source URLs and raw descriptions. The City Alerts provider maps these values to the existing normalized `CityAlert` read model; Daily Overview receives only the generic read model.

Collection is run by `pnpm run collect:amscg` and writes `.runtime/cache/amscg-road-conditions.json`. Page requests only read the cache. The cache uses atomic temporary-file writes and retains a stale prior snapshot when refresh fails. Automated tests are fixture-backed and do not call AMSCG.

## Consequences

- Road notices can appear alongside CEDIS outages without merging provider infrastructure or visitor-time scraping.
- `AMSCG_PROVIDER_MODE=live` is the default; `disabled` leaves the provider unavailable without mock traffic data.
- The file cache has the same local/VPS suitability and serverless durability limitation documented in ADR 0007.
