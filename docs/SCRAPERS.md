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

CEDIS is the currently approved HTML collection source for planned Podgorica power outages. The collector uses only `https://cedis.me/servisne-informacije/` and validated official article URLs, with a clear Podgorica Daily user agent, a 10-second timeout, one retry, and low request volume. It is manually invoked with `pnpm run collect:cedis`; pages only read its cache.

The collector recommends a 60-minute cadence. It uses local fixtures for automated tests and preserves a valid cached snapshot when the source, network, or markup is suspicious. The local cache is appropriate for development and persistent servers, but not as durable shared storage in serverless deployments. See ADR 0007 for configuration, classification, and scheduling constraints.

## AMSCG road conditions

AMSCG is the approved official source for road-condition notices at `https://amscg.org/stanje-na-putevima/`. `pnpm run collect:amscg` fetches only the allowed AMSCG host through the same timeout, retry, cache-first, and fixture-test policy as CEDIS. It normalizes road works, closures, alternating traffic, restrictions, and important warnings. Visitor requests read only `.runtime/cache/amscg-road-conditions.json`. See ADR 0008.

## Privacy

Collectors must not gather personal data unless a documented lawful purpose, retention policy, access control, and deletion process are approved. Credentials and raw restricted content never appear in logs or test fixtures.
