# Scrapers

## Policy

Scraping is a last resort. Prefer official APIs, open-data feeds, licensed datasets, direct partnerships, and editor-provided sources. No source is ingested until its legal basis, terms, attribution, update cadence, and owner are recorded.

## Safety

- Respect robots directives, rate limits, access controls, and source terms.
- Do not bypass paywalls, authentication, technical protections, or explicit restrictions.
- Use conditional fetching, caching, bounded concurrency, and exponential backoff.
- Treat remote content as untrusted input and isolate parsing from application execution.
- Record provenance, retrieval time, parser version, and content hash for accepted records.

Each collector has an owner, staleness/failure monitoring, alert thresholds, and a disable switch. Parsers quarantine malformed records and never replace verified editorial content automatically. Personal data requires approved lawful purpose, retention, access controls, and deletion procedures.
