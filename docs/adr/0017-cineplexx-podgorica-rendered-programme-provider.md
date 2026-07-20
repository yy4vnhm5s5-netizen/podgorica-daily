# ADR 0017: Collect Cineplexx Podgorica programme through a rendered, cache-backed Event provider

- Status: accepted
- Date: 2026-07-20

## Context

Cineplexx Montenegro publishes the Podgorica repertoire on its official public website, but the server response is a JavaScript application shell. The programme, movie detail links, posters, session times, halls, formats, and booking links are available only after the official page renders in a browser. No undocumented endpoint is used.

## Decision

Add the Podgorica-only `cineplexx-podgorica` Event provider. It renders only `https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/` with a bounded headless Chromium process and accepts the output only after both programme items and official booking links are present. The renderer allows only HTTPS `cineplexx.me` and `www.cineplexx.me` URLs, has a 30-second process timeout, limits output size, and does not execute visitor-request code.

The parser consumes saved rendered HTML fixtures. It creates one normalized `movie` event per screening, preserving the movie detail URL, official booking URL, poster, local date/time, hall, format, genre, duration, and available subtitle/dubbing markers. A screening identity includes its local start time and venue text with hall and format, so separate sessions remain distinct. Missing optional fields remain absent; an invalid entry is isolated.

The collector writes `.runtime/cache/cineplexx-events.json` atomically through the shared Event cache contract. It runs through the existing Event refresh runner and retains the previous valid snapshot when browser rendering, parsing, or quality validation fails. Cache reads remain the only application read path. `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` are required.

The existing scheduler invokes `pnpm run collect:cineplexx-events` at approximately 05:00 and 17:00 host-local time. `CINEPLEXX_CACHE_FRESHNESS_MINUTES=780` keeps a successful programme fresh for thirteen hours, matching the cadence while allowing a bounded delay. It uses the same scheduler service and persistent cache volume as other collectors; no additional cron service is introduced.

## Consequences

- The homepage can render a distinct, cache-backed `U bioskopu` programme card without page-request scraping.
- The runtime and scheduler images include system Chromium, increasing image size and requiring a working headless-browser sandbox configuration.
- Source markup changes or slow client-side rendering can temporarily make Cineplexx unavailable, but cannot hide other Event providers or remove a usable cached programme.
- Fixture tests do not call Cineplexx or start Chromium.
