# ADR 0011: Collect KIC Budo Tomović programme articles through a cache-backed provider

- Status: Accepted
- Date: 2026-07-17

## Context

The Event Platform requires its first real official source without exposing visitor requests to scraping or coupling the event domain to KIC markup.

## Decision

Use KIC Budo Tomović’s official `https://kic.podgorica.me/novosti` listing and its same-host programme article pages. This first-party publication feed was selected over third-party calendars because it gives KIC-owned source URLs, article-level attribution, and programme text without relying on social media.

The collector validates the KIC host, uses a 10-second timeout, one retry, and a clear Podgorica Daily user agent. It discovers article URLs, parses source candidates, deterministically maps known programme terms to event categories, normalizes candidates through the Event domain, and atomically writes the generic event cache at `.runtime/cache/kic-events.json`. The intended refresh interval is 60 minutes. Page requests use the KIC provider’s cached snapshot only.

The parser extracts only values it can find: title, description, image, dates, times, explicit cancellation language, free or euro price text, language, KIC venue information, and article URL. Missing end times or images remain missing. Category mapping covers concerts, theatre, exhibitions, films, workshops, and literature; all other values become `other`. Fixture tests cover concert, theatre, exhibition, cancelled, free, paid, missing end-time, and missing-image cases.

The provider is registered but returns `disabled` unless both `ENABLE_EVENTS=true` and `EVENT_PROVIDER_MODE=live` are explicitly set. No mock event data is added or mixed with KIC data.

## Consequences

- KIC events become available through the generic Event service when collection and flags are enabled, with no route or visible UI change.
- KIC article markup and ambiguous prose can limit field extraction; parsers must retain warnings and never invent data.
- The local file cache is unsuitable for shared serverless collection until a durable cache adapter is approved.
