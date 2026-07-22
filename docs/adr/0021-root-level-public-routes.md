# ADR 0021: Use root-level canonical public routes

- Status: Accepted
- Date: 2026-07-22

## Context

Gradom currently exposes one production language. Locale prefixes no longer help visitors, make shareable URLs longer, and duplicate public route shapes while English remains intentionally unavailable.

## Decision

Use root-level Montenegrin canonical routes: `/`, `/dogadjaji`, `/izlasci`, `/letovi`, `/kontakt`, `/struja`, and legal pages. Keep translation dictionaries and the `Locale` type in the codebase for a future language rollout, but remove `[locale]` from public routing. Redirect every legacy `/me/*` and `/en/*` request permanently to its corresponding root route. Redirect the historic `/events` path to `/dogadjaji`.

Sitemaps, canonical metadata, internal links, and structured event URLs use only the root canonical paths.

## Consequences

- Public URLs are shorter and have one canonical shape.
- Existing indexed locale URLs retain a permanent migration path.
- A future language rollout requires a new public-routing decision rather than exposing an incomplete locale layer.
