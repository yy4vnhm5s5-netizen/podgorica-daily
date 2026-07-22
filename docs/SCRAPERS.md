# Scrapers

## Policy

Scraping is a last resort. Prefer official APIs, open-data feeds, licensed datasets, direct partnerships, and editor-provided sources. No source is ingested until its legal basis, terms of use, attribution, update cadence, and operational owner are recorded.

## Safety requirements

- Respect robots directives, rate limits, access controls, and source terms.
- Do not bypass paywalls, authentication, technical protections, or explicit restrictions.
- Minimize requests; use conditional fetching, caching, bounded concurrency, and exponential backoff.
- Treat remote content as untrusted input and isolate parsing from application execution.
- Store provenance, retrieval time, parser version, and content hash for each accepted record.

## Operations

Each collector has a named owner, monitoring for failure and staleness, alert thresholds, and a documented disable switch. Parsers must tolerate source changes, quarantine malformed records, and avoid replacing verified editorial content automatically.

## CEDIS planned outages

CEDIS is the currently approved HTML collection source for planned Podgorica power outages. The collector uses only `https://cedis.me/servisne-informacije/` and validated official article URLs, with a clear product user agent, a 10-second timeout, one retry, and low request volume. It is manually invoked with `pnpm run collect:cedis`; pages only read its cache.

The bundled VPS scheduler refreshes CEDIS every 30 minutes. It uses local fixtures for automated tests and preserves a valid cached snapshot when the source, network, or markup is suspicious. The local cache is appropriate for development and persistent servers, but not as durable shared storage in serverless deployments. See ADR 0007 for configuration, classification, and scheduling constraints.

## VIK Podgorica water-service notices

VIK Podgorica is the approved official water-service source at `https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html`. That legacy URL currently redirects to an official first-party page containing service entries and unrelated content. `pnpm run collect:vikpg` accepts only validated HTTPS VIK hosts, uses the established user agent, ten-second timeout, one transient retry, low request volume, and an on-disk refresh lock. It reads and atomically writes `.runtime/cache/vikpg-water-alerts.json`; visitor requests only read the cache.

The parser uses local fixtures and injected HTTP in tests. It retains a valid snapshot on fetch failure, malformed content, or suspicious empty parses. Explicit end times determine expiry; restoration notices and notices older than one local day after publication are conservatively hidden. See ADR 0016.

## ŽPCG railway departures

ŽPCG is the approved official source for departures from Podgorica at `https://zpcg.me/red-voznje/ukupno`. `pnpm run collect:zpcg-railway` requests only that HTTPS host, validates HTML and response size, finds the semantic “Polasci iz stanice Podgorica” section, normalizes departures, and atomically writes `.runtime/cache/zpcg-railway-departures.json`. Homepage reads never request ŽPCG. The bundled VPS scheduler runs the collector at approximately 06:45 and 18:45 host-local time. Tests use saved official-style HTML and injected HTTP only.

## Podgorica Airport flights

Podgorica Airport flights are collected only from the public first-party feed used by the official Airports of Montenegro [Podgorica Airport status page](https://montenegroairports.com/en/podgorica-airport/): `https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg`. The browser frontend requests this endpoint with a public `GET` and renders its `value` array into the arrivals and departures tables. `pnpm run collect:podgorica-flights` requests only this validated HTTPS URL, applies a ten-second timeout, one transient retry, an explicit user agent, response-size validation, and Zod validation of the JSON payload before normalization. It writes `.runtime/cache/podgorica-flights.json` atomically and retains a valid snapshot if the source or parser fails. Homepage and `/podgorica/letovi` reads never request the airport source. The bundled VPS scheduler runs it every 30 minutes. Tests use saved public-feed fixtures and injected HTTP only. See ADR 0019.

## MonteGigs going out

MonteGigs is the approved source for the separate Podgorica `Izlasci` module, not an Event Platform provider. `pnpm run collect:montegigs-going-out` requests only `https://staging.montegigs.me/me/events/podgorica`, through an allow-listed HTTPS client with a ten-second timeout, one transient retry, a 1.5 MB response limit, and a clear product user agent. It parses public event links and only preserves future Podgorica records, writes `.runtime/cache/montegigs-going-out.json` atomically, and retains the prior valid snapshot if the listing or parser fails. Tests use a minimal saved listing fixture and injected HTTP only. The public listing provides dates but may omit times; Gradom leaves those times unavailable. Automated access terms and robots rules were not discoverable during implementation, so source permission and any published policy must be rechecked with MonteGigs before production rollout. Visitor requests never fetch MonteGigs. See ADR 0020.

## Events

KIC Budo Tomović is an approved event collector. It reads only the official `https://kic.podgorica.me/novosti` listing and validated same-host programme articles, using the established timeout, one-retry, user-agent, and cache-first policy. It is invoked by `pnpm run collect:kic-events`; pages read `.runtime/cache/kic-events.json` only. The initial cadence is 60 minutes. Parsing is fixture-tested and preserves missing fields rather than inferring them. See ADR 0011.

Crnogorsko narodno pozorište (CNP) is an approved Event collector. It reads only `https://cnp.me/repertoar/` and validated `https://cnp.me` detail pages. `pnpm run collect:cnp-events` uses the established product user agent, a 10-second timeout, one retry, typed HTTP failures, and a low request volume; application reads only `.runtime/cache/cnp-events.json`. The initial cadence is 60 minutes. Listing/detail parsing and refresh tests use deterministic local fixtures only and never call the live CNP site. Missing fields remain unavailable rather than inferred. See ADR 0013.

Glavni Grad Podgorica is an approved Event collector. It reads only `https://podgorica.me/category/aktuelni-dogadjaji/` and validated `podgorica.me` detail pages. `pnpm run collect:glavni-grad-events` uses the established timeout, one retry, cache-first, and local-fixture test policy; application reads only `.runtime/cache/glavni-grad-events.json`. See ADR 0014.

Turistička organizacija Podgorice is an approved Event collector. It reads only `https://podgorica.travel/dogadjaji-kalendar/` and validated HTTPS pages on `podgorica.travel` or `www.podgorica.travel`. `pnpm run collect:tourism-events` uses the established bounded timeout, one transient retry, typed HTTP failures, explicit user agent, and cache-first policy; application reads only `.runtime/cache/tourism-events.json`. Listing/detail, HTTP, and refresh tests use deterministic local fixtures and injected HTTP only, never the live source. See ADR 0015.

Cineplexx Podgorica is an approved rendered Event collector. Its official page at `https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/` publishes the repertoire only after JavaScript renders; no hidden or undocumented API is used. `pnpm run collect:cineplexx-events` launches a bounded headless Chromium process against that one HTTPS page, accepts output only after programme and official booking markers are present, normalizes each distinct screening, and atomically writes `.runtime/cache/cineplexx-events.json`. Application reads remain cache-only. The shared scheduler runs it at approximately 05:00 and 17:00; tests parse saved rendered HTML and inject renderer failures without live access. See ADR 0017.

Before cache writes, all normalized events pass deterministic quality validation. Invalid core records are rejected, optional omissions become typed warnings, and zero-result/count-drop protection is recorded in cache diagnostics. See ADR 0012.

Quality policy is server configuration; availability and quality health are separate operational signals. Visitors never trigger event collection, quality evaluation, or provider HTTP requests.

Future event sources require their own official-source, legal, attribution, cache, fixture, and disable-switch review before registration or activation.

## Privacy

Collectors must not gather personal data unless a documented lawful purpose, retention policy, access control, and deletion process are approved. Credentials and raw restricted content never appear in logs or test fixtures.
