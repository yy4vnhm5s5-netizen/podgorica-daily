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

## Privacy

Collectors must not gather personal data unless a documented lawful purpose, retention policy, access control, and deletion process are approved. Credentials and raw restricted content never appear in logs or test fixtures.
