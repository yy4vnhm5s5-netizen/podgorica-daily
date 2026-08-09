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

CEDIS is the approved national HTML collection source for planned electricity outages. The collector uses only `https://cedis.me/servisne-informacije/` and validated official article URLs, with a clear product user agent, a 10-second timeout, one retry, and low request volume. One article can contain municipality sections for several cities; Gradom derives only explicitly allowlisted municipality read models (`Bar`, `Podgorica`/`Glavni grad Podgorica`, `Budva`/`Opština Budva`, `Kotor`, and `Tivat`/`Opština Tivat`) from that source.

`pnpm run collect:cedis` fetches each CEDIS document at most once per run, then sequentially processes every active city with the electricity capability and an approved municipality mapping. It selects the nearest scheduled daily notice for the current Podgorica-local day or a later published day; an older notice is never merged into the current schedule. Each city keeps an isolated atomic snapshot and lock; the established Podgorica snapshot path remains compatible. When an otherwise parseable selected notice has no section for a city, that city receives a successful empty snapshot. Malformed, ambiguous, or structurally unrecognized source content retains only that city's previous valid snapshot. Inactive cities are not scheduled. Pages only read their city snapshot.

The bundled VPS scheduler refreshes CEDIS every six hours. It uses local fixtures for automated tests and preserves a valid cached snapshot when the source, network, or markup is suspicious. The local cache is appropriate for development and persistent servers, but not as durable shared storage in serverless deployments. See ADR 0007 for configuration, classification, and scheduling constraints.

## VIK Podgorica water-service notices

VIK Podgorica is the approved official water-service source at `https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html`. That legacy URL currently redirects to an official first-party page containing service entries and unrelated content. `pnpm run collect:vikpg` accepts only validated HTTPS VIK hosts, uses the established user agent, ten-second timeout, one transient retry, low request volume, and an on-disk refresh lock. It reads and atomically writes `.runtime/cache/vikpg-water-alerts.json`; visitor requests only read the cache.

## Vodovod Kotor service information

Vodovod i kanalizacija Kotor is the approved official source for Kotor water-service information at `https://vodovodkotor.com/servisne-informacije/`. The collector follows only validated HTTPS detail pages on the same official host, applies a 10-second timeout and 1 MB response bound, and stores a provider-specific atomic snapshot at `.runtime/cache/vodovod-kotor-water-alerts.json`. It distinguishes planned interruptions, water-tanker schedules, and drinking-water notices; schedules and notices are never presented as outages. An unavailable, malformed, or zero-valid-record refresh retains the previous valid snapshot. A local cache-write error remains an explicit failed refresh. `pnpm run collect:vodovod-kotor` runs only while Kotor is active and has the water capability; the local scheduler invokes it every two hours, staggered from VIK. Set `ENABLE_VODOVOD_KOTOR=true` to expose the live provider in Kotor's City Alerts read path. Visitor requests only read the cache.

The parser uses local fixtures and injected HTTP in tests. It retains a valid snapshot on fetch failure, malformed content, or suspicious empty parses. Explicit end times determine expiry; restoration notices and notices older than one local day after publication are conservatively hidden. See ADR 0016.

## ŽPCG railway departures

ŽPCG is the approved official source for departures from Podgorica at `https://zpcg.me/red-voznje/ukupno`. `pnpm run collect:zpcg-railway` requests only that HTTPS host, validates HTML and response size, finds the semantic “Polasci iz stanice Podgorica” section, normalizes departures, and atomically writes `.runtime/cache/zpcg-railway-departures.json`. Homepage reads never request ŽPCG. The bundled VPS scheduler runs the collector at approximately 06:45 and 18:45 host-local time. Tests use saved official-style HTML and injected HTTP only.

## Podgorica Airport flights

Podgorica Airport flights are collected only from the public first-party feed used by the official Airports of Montenegro [Podgorica Airport status page](https://montenegroairports.com/en/podgorica-airport/): `https://montenegroairports.com/aerodromixs/cache-flights.php?airport=pg`. The browser frontend requests this endpoint with a public `GET` and renders its `value` array into the arrivals and departures tables. `pnpm run collect:podgorica-flights` requests only this validated HTTPS URL, applies a ten-second timeout, up to four bounded transient retries (five attempts total), an explicit user agent, response-size validation, and Zod validation of the JSON payload before normalization. It writes `.runtime/cache/podgorica-flights.json` atomically and retains a valid snapshot if the source or parser fails. Homepage and `/podgorica/letovi` reads never request the airport source. The bundled VPS scheduler runs it every 15 minutes. Tests use saved public-feed fixtures and injected HTTP only. See ADR 0019.

## MonteGigs going out

MonteGigs is the approved source for the separate `Izlasci` module, not an Event Platform provider. Its explicitly allow-listed listings currently cover Bar, Budva, Kotor, Podgorica, Tivat and Ulcinj; no arbitrary city slug or source URL is accepted. `pnpm run collect:montegigs-going-out` requests a city-specific listing through an allow-listed HTTPS client with a ten-second timeout, one transient retry, a 1.5 MB response limit, and a clear product user agent. Each city has an isolated atomic snapshot and lock; the established Podgorica path remains `.runtime/cache/montegigs-going-out.json`, while other approved cities use a separate module-owned cache file. The collector retains that city's prior valid snapshot if its listing or parser fails. Tests use minimal saved fixtures and injected HTTP only. The rendered listing markup remains the primary source and provides dates but never prints a clock time. The same HTML response embeds the page's own hydration payload, which carries the source's `time` field; the parser reads that field only, joined to a listing entry by the numeric MonteGigs event id in the URL, and consumes no other payload value. A stated `00:00` is treated as the source's unset placeholder and discarded.

For upcoming listing records only, the collector maintains a private, city-isolated detail-enrichment cache at `.runtime/cache/montegigs-going-out-<city>-detail-enrichment.json`. It is keyed by the numeric MonteGigs `sourceEventId`, with the source URL retained to validate that identity. Fresh cache entries are reused for 12 hours; stale entries are eligible for revalidation, and a failed or budget-deferred revalidation may use a cached detail for no more than 72 hours while the current listing remains authoritative for event identity and Phase 1A fields. The cache is not a public snapshot or permanent event archive: entries absent from current listings are retained only for a 14-day grace period.

Cache hits do not consume the network budget. The collector requests at most 12 distinct same-host event details per city refresh, ordered deterministically with unseen events before stale entries and sooner events first, with at most three logical requests in flight. This allows successive refreshes to fill coverage without repeatedly requesting already-enriched records. Detail pages contribute only explicit description, address, organizer and source-labelled external information URL fields; JSON-LD is preferred when it matches the requested source event, while labelled page sections are a fail-open fallback. A missing, malformed, unreadable, or unwritable detail cache never prevents an otherwise valid listing snapshot from being written. A failed, redirected, malformed or mismatched detail never removes its listing record or replaces the entire snapshot. Visitor requests never fetch MonteGigs or read this private detail cache. See ADR 0020.

## Events

KIC Budo Tomović collection code and fixtures are retained, but the provider is intentionally excluded from the active public registry and every recurring refresh plan because its upstream TLS certificate is expired. Do not schedule `pnpm run collect:kic-events` until the official source is again reliable and the provider is explicitly re-enabled.

Crnogorsko narodno pozorište (CNP) is an approved Event collector. It reads only `https://cnp.me/repertoar/` and validated `https://cnp.me` detail pages. `pnpm run collect:cnp-events` uses the established product user agent, a 10-second timeout, one retry, typed HTTP failures, and a low request volume; application reads only `.runtime/cache/cnp-events.json`. CNP, Glavni Grad Podgorica, and the Tourism providers run together in the standard Events refresh every three hours. Listing/detail parsing and refresh tests use deterministic local fixtures only and never call the live CNP site. Missing fields remain unavailable rather than inferred. See ADR 0013.

Glavni Grad Podgorica is an approved Event collector. It reads only `https://podgorica.me/category/aktuelni-dogadjaji/` and validated `podgorica.me` detail pages. `pnpm run collect:glavni-grad-events` uses the established timeout, one retry, cache-first, and local-fixture test policy; application reads only `.runtime/cache/glavni-grad-events.json`. See ADR 0014.

Turistička organizacija Podgorice is an approved Event collector. It reads only `https://podgorica.travel/dogadjaji-kalendar/` and validated HTTPS pages on `podgorica.travel` or `www.podgorica.travel`. `pnpm run collect:tourism-events` uses the established bounded timeout, one transient retry, typed HTTP failures, explicit user agent, and cache-first policy; application reads only `.runtime/cache/tourism-events.json`. Listing/detail, HTTP, and refresh tests use deterministic local fixtures and injected HTTP only, never the live source. See ADR 0015.

Cineplexx Podgorica is an approved rendered Event collector. Its official page at `https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/` publishes the repertoire only after JavaScript renders; no hidden or undocumented API is used. `pnpm run collect:cineplexx-events` launches a bounded headless Chromium process against that one HTTPS page, accepts output only after programme and official booking markers are present, normalizes each distinct screening, and atomically writes `.runtime/cache/cineplexx-events.json`. Application reads remain cache-only. The scheduler runs it daily; Railway uses its separately configured 04:00 UTC trigger. Tests parse saved rendered HTML and inject renderer failures without live access. See ADR 0017.

Before cache writes, all normalized events pass deterministic quality validation. Invalid core records are rejected, optional omissions become typed warnings, and zero-result/count-drop protection is recorded in cache diagnostics. See ADR 0012.

Quality policy is server configuration; availability and quality health are separate operational signals. Visitors never trigger event collection, quality evaluation, or provider HTTP requests.

Future event sources require their own official-source, legal, attribution, cache, fixture, and disable-switch review before registration or activation.

## JPMD sea-water-quality monitoring

Javno preduzeće za upravljanje morskim dobrom Crne Gore (JPMD) is the approved official source for beach water-quality monitoring. The collector uses only the public monitoring calendar and `crtajMapu` endpoints on `monitoring.morskodobro.me`, requests an explicitly mapped municipality and current calendar round, and performs no collection during visitor requests. Current summaries and bounded, per-city seasonal history snapshots are atomically written separately. History is keyed by the official monitoring location id within the configured municipality; the first observed clean public slug is retained across later display-name changes, and repeating the same source round replaces that round's measurement rather than duplicating it. Public beach listing, detail metadata, sitemap generation, and detail pages read these local snapshots only. Full raw official round fixtures are retained only as parser/identity evidence and are never served publicly.

## Privacy

Collectors must not gather personal data unless a documented lawful purpose, retention policy, access control, and deletion process are approved. Credentials and raw restricted content never appear in logs or test fixtures.
