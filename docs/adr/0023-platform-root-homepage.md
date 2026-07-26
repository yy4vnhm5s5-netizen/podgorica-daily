# ADR 0023: Use the root route as the Gradom.me platform homepage

- Status: Accepted
- Date: 2026-07-26
- Supersedes: the root-route and sitemap portions of ADR 0022

## Context

Gradom.me is expanding from a single city toward a city-aware platform. Rendering the Podgorica dashboard at `/` creates a second crawlable presentation of the same city and makes the platform itself invisible.

## Decision

Use `/` as the self-canonical Gradom.me platform homepage. It introduces the platform, lists only active registry cities, and links into their canonical city routes. It is not a redirect and does not render a city dashboard.

Active city pages remain canonical beneath their city slugs. Podgorica remains available at `/podgorica` with self-referencing metadata. Inactive cities remain absent from routing, static generation, sitemap entries, platform cards, and platform structured data.

The root sitemap entry is retained because it is now a canonical, indexable 200 response. Platform-specific metadata and `WebSite`/active-city `ItemList` structured data are distinct from city-page metadata.

## Consequences

- The platform can add active cities without turning `/` into a clone of any one city.
- City-specific source capability and cache boundaries remain unchanged.
- Product and UX decisions for the platform homepage are documented in `docs/PRODUCT_VISION.md` and `docs/UX_ARCHITECTURE.md`.
- Contact and legal pages remain global root routes.
