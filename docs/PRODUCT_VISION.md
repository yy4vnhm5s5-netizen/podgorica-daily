# Product vision

> **Authoritative guidance:** Future product, city-expansion, provider, and UX plans must read this document together with [UX architecture](UX_ARCHITECTURE.md). Technical implementation choices remain documented in [ARCHITECTURE.md](ARCHITECTURE.md) and the ADRs.

## What Gradom.me is

Gradom.me is a platform for useful local information in cities across Montenegro. Its purpose is to make trustworthy, everyday information easier to find while keeping sources, freshness, and limitations visible.

The root route (`/`) is the Gradom.me platform homepage. It helps people choose a supported city and explains the service. Each city route is a separate local product with its own canonical page, sources, capabilities, and useful information. A city page is not a themed copy of another city page.

## Mission and principles

- **Local usefulness before coverage:** Solve repeatable local needs; do not add a module merely because another city has one.
- **Trust is part of the product:** Prefer approved public sources, preserve attribution, and explain unavailable or stale data honestly.
- **Fewer strong modules are better:** A small set of reliable, locally useful modules is more valuable than a wide list of weak or speculative integrations.
- **City capability is explicit:** A city exposes only capabilities for which it has an approved source, a safe cache-backed read path, and a clear presentation state.
- **Public value and maintainability:** New work must provide clear resident value without creating an operationally fragile source dependency.
- **Privacy-light by default:** Gradom.me does not require accounts for public information. A local last-city preference is not an identity or analytics system.

## Adding cities and capabilities

A new city is added to the registry first and remains inactive until its public route, metadata, source coverage, and unavailable states are ready. A city becomes public only when it has enough useful, verified capabilities to stand on its own.

Before a provider or module is approved, it needs:

1. a stable and publicly appropriate source or documented permission;
2. a typed, cache-backed collector boundary with timeouts, retention, and fixture tests;
3. clear ownership, attribution, freshness, empty, stale, and unavailable behaviour;
4. evidence that the information is useful for the particular city; and
5. a small, maintainable operational schedule.

Product roadmap ideas are not committed scope. A capability appears publicly only after these requirements are implemented and reviewed.

## Current city direction

The active registry currently includes Bar, Budva, Kotor, Podgorica, and Tivat. Each city exposes
only the capabilities supported by its approved source coverage.

### Bar

Bar is active with an intentionally small initial local product. Its canonical route is `/bar`.

- **Weather:** available through the generic weather flow.
- **CEDIS:** available through the approved Bar municipality mapping and isolated city snapshot.
- **Water, Going Out, beach quality, standard events, cinema, flights, and railway:** not supported
  for Bar in this initial release.

### Podgorica

Podgorica is an active city. Its local product currently combines weather, selected transport data, city alerts, events, cinema programme data, Going Out listings, and the supporting daily overview. Its canonical route is `/podgorica`; the platform homepage is not a duplicate Podgorica dashboard.

### Budva

Budva is an active city with a deliberately smaller initial local product. Its canonical route is `/budva`; it is listed on the platform homepage and indexed only through the routes supported by its declared capabilities.

- **Weather:** available through the generic weather flow.
- **Going Out / MonteGigs:** available through the explicit Budva source mapping and isolated city snapshot.
- **CEDIS:** available through the approved Budva municipality mapping and isolated city snapshot.
- **Beach quality:** suitable for a later release after source approval and contract validation.
- **TO Budva Events:** optional only if distinct local value is demonstrated.
- **Vodovod:** not currently a viable MVP source.
- **Municipal announcements:** not currently required.
- **Flights, railway, and cinema:** not supported for Budva.

Future city expansion follows the same principle: local source quality determines the product, rather than a fixed feature checklist.

## Remote-media direction

Remote provider images are a future platform concern, not an immediate requirement. The intended long-term direction is collector-time ingestion, internal immutable media references, fixed transformed variants, and object storage/CDN only when operationally justified. Gradom.me must not become a public unrestricted image proxy.
