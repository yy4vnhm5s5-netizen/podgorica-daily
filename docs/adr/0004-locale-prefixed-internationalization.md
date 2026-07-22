# ADR 0004: Use locale-prefixed routes for Montenegrin and English

- Status: Superseded by ADR 0021
- Date: 2026-07-17

## Context

Podgorica Daily serves a local audience whose default language is Montenegrin Latin, ijekavian, while English remains important for visitors. Visible content, accessibility labels, metadata, and local date and time presentation must be available consistently in both languages without leaking translated provider labels into the Weather domain.

## Decision

Use the explicit locale routes `/me` and `/en`. Redirect `/` to `/me`; do not infer or persist a visitor language automatically. Keep the locale set typed and limited to these two values in `src/shared/config/locale.ts`. Put cross-cutting shell, dashboard, metadata, and accessibility copy in `src/shared/lib/translations.ts`; modules own their feature-specific dictionaries. Weather maps WMO codes to stable semantic keys in its domain and translates those keys only in its presentation layer. Dates and times use the active locale with the existing `Europe/Podgorica` display policy.

## Consequences

- Every public screen has a stable, shareable language URL and locale-aware metadata.
- Montenegrin Latin is the predictable default without adding browser detection, cookies, or a client-side i18n runtime.
- Shared copy remains centralized while modules preserve ownership of their vocabulary.
- Adding a language is a deliberate product and content-maintenance decision, not a configuration-only change.
