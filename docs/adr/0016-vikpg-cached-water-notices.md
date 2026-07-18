# ADR 0016: Collect VIK Podgorica water-service notices through a cache-backed City Alerts provider

- Status: accepted
- Date: 2026-07-19

## Context

Residents need timely, attributable water-service interruption information without visitor requests scraping the VIK Podgorica website. The official VIK service-information URL currently redirects to a first-party page that embeds service notices alongside unrelated corporate content. Notice markup and dates are inconsistent, and old notices must not remain visible indefinitely.

## Decision

Add the Podgorica-only `vikpg` City Alerts provider. `pnpm run collect:vikpg` fetches only HTTPS pages on `vikpg.me` or `www.vikpg.me`, using the established Podgorica Daily user agent, a ten-second timeout, and one bounded transient retry. It discovers official water-service notice links, fetches only those same-host pages, normalizes relevant interruptions into the existing `CityAlert` water-outage contract, and atomically writes `.runtime/cache/vikpg-water-alerts.json`.

Visitor requests read the VIK snapshot only. `ENABLE_VIKPG=true` and `VIKPG_PROVIDER_MODE=live` are required to expose cached live data; disabling the provider makes Water unavailable without mock fallback. A filesystem refresh lock prevents overlapping collector runs in a persistent-cache deployment.

The parser preserves source text, article URL, publication date, affected area when explicit, and expected restoration time when confidently parsed. Notices with an explicit end in the past are expired. Restoration notices without a new end time are expired. A notice without an end time remains active only through the end of the following local Europe/Podgorica day; this prevents stale incidents from lingering without inventing a restoration time. Future notices remain scheduled.

The refresh process replaces a cache with a valid empty result only when the service-information listing is confidently recognized and all inspected notices parse without warnings. Network failures, malformed content, and suspicious empty results retain the prior cache as stale. Fixture-backed tests use injected HTTP only.

## Consequences

- The existing Water tab can show verified VIK outages, official-source attribution, publication context, or the localized successful-empty state.
- Daily Overview continues to consume generic normalized `waterOutage` alerts and remains independent of VIK infrastructure.
- The file cache requires the existing persistent runtime mount; it is not shared between independent Railway services.
- VIK does not publish a stable structured feed. Source markup changes, redirects, ambiguous dates, and notices without explicit end times can reduce precision and are handled as warnings or conservative expiry rather than guessed data.
