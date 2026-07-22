# ADR 0019: Podgorica Airport public flight feed

- Status: Accepted
- Date: 2026-07-22
- Supersedes: ADR 0018

## Context

The original official schedule-page collector could receive a verification document instead of the timetable HTML. The official Podgorica Airport page itself renders daily arrivals and departures after a public frontend request to a first-party feed. A cache-backed collector needs a source that is usable without browser automation or an anti-bot workaround.

## Decision

Use the public first-party feed requested by the official Podgorica Airport page:

`https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg`

The page's public JavaScript requests this URL with `GET`, declares `dataType: 'json'`, and renders `value` records using `FlightType`, `ScheduledDateTime`, `EstimatedDateTime`, `Airport`, `FlightNumberIATA`, and `StatusID`. Gradom requests only this exact HTTPS host, path, and `airport=pg` parameter. It does not use browser automation, CAPTCHA handling, session tokens, or the third-party FlightRadar24 links included in the airport UI.

The adapter validates the JSON structure with Zod, maps only explicit fields into the module-owned `Flight` model, and treats a malformed payload or a non-empty payload with no valid records as a parser failure. It retains the last valid atomic cache snapshot on any fetch, parsing, or cache-write failure. Visitor reads remain cache-only.

## Consequences

- The collector remains attributed to the official Airports of Montenegro frontend and is resilient to schedule-page HTML changes and verification documents.
- The feed currently does not expose an airline field; the optional airline field remains unavailable rather than inferred.
- A response with a JSON-compatible but incorrect content type is accepted only if its body passes the strict JSON schema; challenge HTML cannot replace the cache.
- Fixture tests use representative public-feed JSON and injected HTTP. They never access the live source.
- The source is public frontend infrastructure rather than a separately documented public API. If Airports of Montenegro changes, removes, or restricts the feed, the safe failure mode is a retained stale cache and an unavailable state after cache expiry.
