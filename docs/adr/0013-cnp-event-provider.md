# ADR 0013: Collect Crnogorsko narodno pozorište events through a cache-backed provider

- Status: Accepted
- Date: 2026-07-17

## Context

The Event Platform needs a second official Podgorica source without coupling visitor requests or the Event domain to CNP page markup. The provider must preserve the existing cache-first collection, Event Quality, provenance, and failure-isolation boundaries.

## Decision

Register the `cnp` provider for Crnogorsko narodno pozorište. Its only official source is `https://cnp.me/repertoar/`; all collection URLs must resolve to the allowed `cnp.me` HTTPS host. CNP currently supports Podgorica only.

`pnpm run collect:cnp-events` fetches the repertoire listing, discovers validated same-host detail pages, and parses only fields present in CNP content. The parser extracts titles, descriptions, dates, start times, explicit cancellation or postponement wording, image and price information, category hints, and venue text. It keeps missing values missing and records parser warnings. Recognized CNP stages normalize to the CNP venue; unrecognized venue text is retained without guessing. Known programme wording maps deterministically to Event categories; unknown values map to `other`.

The injected HTTP adapter uses the established Podgorica Daily user agent, a 10-second timeout, one retry, typed failures, and no page-script execution. Deterministic local HTML fixtures cover listing discovery, detail variations, dates, times, prices, cancellation, postponement, venue handling, and malformed content. Automated tests never call CNP or any live network endpoint.

Collection writes `.runtime/cache/cnp-events.json` atomically. The initial intended cadence is 60 minutes. Normalized records pass through Event Quality before cache writes; accepted and accepted-with-warning events remain available, rejected event identifiers remain excluded from public cached reads, and diagnostics retain warning/rejection counts, score distribution, count-drop state, and prior-successful count. A zero-valid-result refresh retains a valid prior snapshot. The collector reports typed diagnostics and distinguishes a fresh write, retained cache, and unavailable result.

The provider is available only when `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live`. Application reads only cached provider snapshots; neither a visitor request nor the Event application service invokes the CNP collector or HTTP client. CNP and KIC reads fail independently. Cross-provider results use shared exact/strong deterministic deduplication, preserve both official source references, retain separate dates and start times, and apply existing status precedence.

## Consequences

- CNP events are internally available through the generic Event application service when a cache exists and Events are explicitly enabled; no Events UI or route is introduced.
- CNP page markup and prose can change or omit fields. The parser does not infer missing dates, times, prices, category, or venue information.
- The local file cache is appropriate for development and persistent servers, not durable shared storage on serverless filesystems. A durable cache and scheduled runtime require separate approval.
