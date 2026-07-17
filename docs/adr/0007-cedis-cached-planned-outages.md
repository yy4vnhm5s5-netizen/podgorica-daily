# ADR 0007: Collect CEDIS planned outages into a cache-backed City Alerts source

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily needs official planned power-outage information without making visitor requests scrape the CEDIS website. CEDIS service-information pages are HTML, may vary in structure, and can contain multiple municipalities, dates, and time ranges. Source outages must remain available when collection fails, while malformed or suspicious empty parses must never erase a valid snapshot.

## Decision

Use the official CEDIS service-information listing as the sole source. A CEDIS infrastructure adapter discovers allowed `https://cedis.me` planned-work articles, fetches them with the `PodgoricaDaily` user agent, a configurable 10-second timeout, and one bounded retry. It rejects arbitrary hosts before fetching.

The isolated parser normalizes Podgorica planned outages into the City Alerts domain contract. Collection is invoked only by `pnpm run collect:cedis`, never by a page request. The refresh workflow classifies results as trustworthy non-empty, trustworthy empty, structurally suspicious, or failed. Only trustworthy results replace `.runtime/cache/cedis-planned-outages.json`; writes use a temporary file and atomic rename. A suspicious/failed refresh retains the previous snapshot as stale when one exists. Automated tests use local HTML fixtures only.

The City Alerts application reads this cache in `live` mode and exposes fresh, stale, or unavailable metadata. `CEDIS_PROVIDER_MODE` defaults to `live`; `mock` is explicit development-only configuration and is rejected in production; `disabled` reports the source as unavailable. Live CEDIS and mock alerts are never silently combined.

The Daily Overview receives only generic normalized alert read-model data. It does not import CEDIS infrastructure, parse HTML, read the cache, or fetch a source.

## Operations and deployment

The initial recommended collection interval is 60 minutes. Run locally with:

```bash
pnpm run collect:cedis
```

The command writes one JSON summary. It exits zero for a successful refresh or a failure that retained a usable prior snapshot; it exits non-zero when no usable snapshot exists.

Zero-cost scheduling options are a local cron job, a GitHub Actions scheduled workflow, or Vercel Cron where deployment and persistence support it. No scheduler is enabled by this decision. The file-backed cache is durable in local development and on a traditional server/VPS with persistent storage. It is not a durable serverless cache: on Vercel, the runtime filesystem can be ephemeral or read-only, and collection and rendering may not share state. A future durable cache adapter may use repository-generated data, a free storage/database tier, or an external key-value service without changing the provider contract.

## Consequences

- Live CEDIS cards show official attribution, source links, source status, and last successful update time.
- Stale CEDIS records remain readable with an explicit stale notice; unavailable data does not break unrelated dashboard content.
- Parsing remains intentionally conservative: missing or malformed times retain raw source text rather than invented timestamps.
- Operating a live source requires responsible scheduling, monitoring, terms/robots review, and a durable cache decision before serverless production deployment.
