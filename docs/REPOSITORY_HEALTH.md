# Repository Health Report

- Assessment date: 2026-07-20
- Scope: public-beta stabilization

## Current assessment

Gradom is a production-oriented modular monolith for Podgorica. It ships cache-backed Weather, City Alerts, Events, Cineplexx programme data, a BusTicket4.me station link, and ŽPCG railway departures. Visitor routes do not collect external data: collectors write atomic local snapshots and presentation reads those snapshots only.

| Area                  | Score | Assessment                                                                                                                                                                                                                                                  |
| --------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality          |   4/5 | Strict TypeScript, ESLint, Prettier, and fixture-backed tests are configured and passing.                                                                                                                                                                   |
| Maintainability       |   4/5 | Module ownership and cache/provider boundaries are explicit; some legacy compatibility configuration remains.                                                                                                                                               |
| Accessibility         |   4/5 | Server-first routes, semantic shell landmarks, keyboard filter dialog, and localized content are established. Automated browser accessibility testing is not installed.                                                                                     |
| SEO readiness         |   4/5 | Locale canonical URLs, hreflang alternatives, sitemap, robots, favicon/manifest, Open Graph, Twitter metadata, and Event JSON-LD are present. Production Search Console/Bing verification remains an operator task.                                         |
| Security              |   4/5 | Provider hosts are allow-listed, refresh endpoints are bearer-secret protected, runtime validation is centralized, and baseline security headers are emitted. A strict CSP needs report-only rollout after the final production source policy is confirmed. |
| Operational readiness |   3/5 | Docker runtime, health/readiness endpoints, cache retention, and scheduler conventions exist. Persistent-volume, secret, scheduler, monitoring, and backup ownership still require operator confirmation.                                                   |

## Validation baseline

Run the required release suite before every deployment:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
git diff --check
```

Tests use fixtures and injected HTTP/browser dependencies; they must never make live provider requests.

## Operational limits

- The local JSON cache is suitable only for one persistent host or one Railway web service with its own Volume. It is not shared storage for horizontally scaled or independent scheduler services.
- The bundled VPS scheduler refreshes CEDIS, VIK, Events, Cineplexx, and ŽPCG. AMSCG has a working collector but requires an explicit external schedule until it is added to the bundled scheduler by an approved operational change.
- `EVENT_MAX_QUERY_RANGE_DAYS` and `EVENT_MAX_RECURRENCE_OCCURRENCES` remain validated compatibility settings but are not consumed by the current public query layer. Keep them stable until a versioned configuration cleanup is approved.
- No database, user accounts, maps, unified search, editorial administration, or multi-city public routing is implemented.

## Release checklist

1. Set `NEXT_PUBLIC_SITE_URL=https://gradom.me` and verify canonical, sitemap, Open Graph, and manifest URLs on the deployed domain.
2. Configure persistent cache storage, both refresh secrets, and authenticated scheduler triggers; verify a successful cache write and retained-cache failure path.
3. Configure backups for the persistent cache and test restoration.
4. Add production monitoring/alerting for health, readiness, collector failure, and stale cache state.
5. Roll out CSP in report-only mode, then enforce it after confirming required Next.js, image, and source policies.
6. Verify robots and sitemap in Search Console and Bing Webmaster Tools after DNS and HTTPS are live.
