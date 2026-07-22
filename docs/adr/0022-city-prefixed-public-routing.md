# ADR 0022: Use city-prefixed canonical public routes

- Status: Accepted
- Date: 2026-07-22
- Supersedes: ADR 0021

## Context

Gradom is preparing for multiple cities while Podgorica remains the only active city. Root-level content routes make the current city implicit and would require a public URL migration when another city is activated.

## Decision

Keep a static central city registry with separate `id` and URL `slug`, plus `name`, `isMain`, and `isActive`. Routes resolve an active city into a `CityContext` at the page boundary and pass that context to city-owned presentation and application queries.

Publish city content only beneath active city slugs. Podgorica therefore uses `/podgorica`, `/podgorica/dogadjaji`, `/podgorica/izlasci`, `/podgorica/letovi`, and `/podgorica/struja`. The root `/` renders the main city without a redirect and has `/podgorica` as its canonical URL. Global contact and legal pages remain root routes.

Every normalized event has one required `cityId`. Readers filter by that field before public presentation. Legacy cache snapshots that only contain `cityIds` are backfilled on read when the first cached ID is a registered city; invalid legacy entries are not exposed.

Sitemaps publish active city canonical URLs only, never root as a duplicate city landing page. Page canonical and Open Graph URLs use the resolved city route. No old route redirects or compatibility layer are retained because these routes are not indexed or launched.

## Consequences

- Adding an active city requires a registry entry, approved city data coverage, and records written with that city's `cityId`; generic city routes and metadata already exist.
- Inactive or unknown city slugs resolve through the normal not-found path and do not appear in static parameters or the sitemap.
- Provider-specific Podgorica collectors remain scoped to Podgorica until separate source coverage is approved.
- ADR 0021's root-level canonical routing and legacy redirect policy no longer apply.
