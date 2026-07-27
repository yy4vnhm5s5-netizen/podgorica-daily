# Current Status — Gradom.me Platform

This file reflects the project's state **as of the most recent project-owner briefing, last updated 2026-07-27** (the session date; individual facts below were not each independently dated by the owner, so treat 2026-07-27 as "documented as of," not as the date every underlying event occurred). Update the date whenever status materially changes.

Status legend used throughout: **Confirmed** (verified in repo and/or explicitly stated by the owner) · **In Progress** (actively being worked, not yet resolved) · **Planned** (intended, not started, possibly unscoped).

## Completed (Confirmed)

- Multi-city foundation: central city registry, `CityContext`, capability system (ADR 0009, 0022, 0023).
- City-prefixed canonical public routing for Podgorica and Budva.
- Platform root homepage (`/`) as a self-canonical city-selection page, distinct from any single city's dashboard (ADR 0023).
- City Alerts: CEDIS (power) and VIK Podgorica (water) cache-backed collectors and presentation.
- Event Platform: normalized Event/Venue domain, deterministic ID/dedup, quality pipeline, and 5 official collectors (KIC, CNP, Glavni Grad Podgorica, Tourism Podgorica, Cineplexx).
- Going Out (MonteGigs) module, isolated per active city.
- Flights (Podgorica Airport) and Transport (ŽPCG railway, BusTicket4.me link) modules.
- Weather (Open-Meteo, live request-time provider with safe-failure state).
- Deterministic, non-AI Daily Overview.
- Contact module (server-side SMTP, no storage, in-memory rate limiting).
- About/legal static pages.
- Railway Docker web deployment configuration (`Dockerfile`, `railway.toml`) and runtime entrypoint handling volume-mount ownership.

## Active Cities & Capabilities (Confirmed)

| City | Active | Capabilities |
|---|---|---|
| Podgorica (main) | Yes | electricity, events, flights, goingOut, railway, water, weather |
| Budva | Yes | electricity, weather, goingOut |
| Bar, Nikšić | No (registry planning entries only) | none |

Budva does not have `water` capability. **This is intentional** — no supported water-notice provider exists for Budva yet. Do not treat this as a bug or attempt to "fix" it without new approved provider scope.

## Current Deployment (Owner-confirmed)

- Production platform: **Railway**.
- Persistent volume mounted at `/app/.runtime` on the Railway `web` service.
- `RUNTIME_DATA_DIR=/app/.runtime` in production.
- Scheduled refreshes: Railway cron trigger services calling authenticated `/api/internal/<provider>/refresh` endpoints.
- The self-hosted VPS + Docker Compose + shell-loop scheduler topology is fully documented in this repo but is **not** the active production environment today.

## Current Production Issues

### Issue 1 — Budva CEDIS data not appearing correctly (Priority 1, In Progress)

- **Symptom (confirmed via production logs):** `"CEDIS: refresh failed (suspicious-empty-result)."`
- **What is confirmed:** production logs show the general/Podgorica-oriented cache path `/app/.runtime/cache/cedis-planned-outages.json`.
- **What is confirmed from the implementation** (verified directly from `src/modules/city-alerts/infrastructure/cedis-cache.ts`, `cedis-cities.ts`, and `collect-cedis.ts` — see [CLAUDE.md §7](CLAUDE.md#7-cache--snapshot-architecture) for the full detail): Budva has its own derived cache path (`cedis-planned-outages-budva.json`, a sibling of the Podgorica file), its own refresh lock, and `runActiveCedisCollectors()` already runs both cities' collections sequentially in one process against one shared, memoized fetch of the CEDIS listing page. The collector **already emits a structured per-city JSON log line** (`cityId`, `cachePath`, `cacheStatus`, `alertCount`, `status`, `retainedPreviousSnapshot`, `warnings`, optional `errorCode`) on every run.
- **What is NOT yet confirmed:** whether that Budva-specific log line, cache write, and lock are actually being produced/observed in Railway production — i.e., whether the code path above genuinely executes there, and if so, what it reports. The `"suspicious-empty-result"` log seen so far does not by itself show which city it was for. Root cause is unproven.
- **Next diagnostic step (planned, not yet implemented):** confirm in Railway's actual logs whether the existing per-city JSON summary line is present for `cityId: "budva"` on each CEDIS refresh, and whether `cedis-planned-outages-budva.json` exists on the mounted volume. If the existing summary line turns out insufficient once inspected, extend it with a `collector` name field and a fetched/parsed/rejected count breakdown (CEDIS alerts don't currently have a "rejected" concept — only `parserWarnings` and a total `alertCount` — so this may require a small logging enhancement, not just reading existing logs more carefully).
- **Do not** assume a fix without this evidence first, and do not assume the absence of visible Budva log lines means no logging exists — the per-city logging mechanism already exists in code; what's unverified is its production behavior.

### Issue 2 — Cineplexx parser rejects all events with `missing-date` (Priority 2, Confirmed, not started)

- Confirmed bug: the Cineplexx programme parser currently rejects all observed events with a `missing-date` quality rejection.
- Independent of Issue 1; address after Issue 1 is resolved.

## Current Priorities (Owner-stated)

1. **Priority 1:** Prove and fix the Budva CEDIS collector and snapshot flow in Railway production.
2. **Priority 2:** Fix the Cineplexx parser's `missing-date` rejection.
3. **Priority 3:** Continue responsive and visual polish.

## Known Limitations (Confirmed, by design)

- No database — all persisted state is module-owned JSON file snapshots (docs/DATABASE.md; Sprint 0 deferred decision, not yet revisited).
- File-cache architecture is not durable on serverless/ephemeral filesystems and is not safe for horizontally scaled/multi-instance deployment (explicitly documented constraint).
- No accounts/authentication, no maps, no unified search — explicitly out of scope until separately approved.
- `daily-brief` module is an empty four-directory scaffold with no implementation, no ADR, and no wiring into any route or flag.
- English locale/translation infrastructure exists but is not exposed publicly.
- Contact-form rate limiting is in-memory and single-instance only; would need a shared adapter before any multi-instance deployment.

## In Progress

- Confirming, against real Railway production logs and the mounted volume, whether the per-city CEDIS logging and cache-write path that already exists in code (see Issue 1 above) is actually executing for Budva — **not yet verified**. Any logging enhancement (e.g. adding a `collector` name field or fetched/parsed/rejected counts) is secondary to this verification step and should not be built before the existing log output has actually been inspected.

## Planned / Future Work

- **UI direction (unscoped):** homepage city cards should eventually adopt the same dashboard-card visual language as city summary cards, becoming compact city dashboards. No design, ADR, or implementation plan exists yet — this is a stated future direction only.
- Continued responsive/visual polish (Priority 3, ongoing, no fixed scope given).

## Recent Changes

> Maintain this section chronologically as work completes. Entries below reflect the state established by the time this documentation set was authored; add new entries above older ones as milestones land.

- Multi-city architecture completed (city registry, `CityContext`, capability system).
- Platform root homepage redesigned as a dedicated city-selection dashboard, separate from any single city's page (ADR 0023, superseding the relevant part of ADR 0022).
- Budva added as a second active city with weather, going out, and electricity capabilities.
- Budva CEDIS refresh and capability-based city-alerts services work landed (commit `e65bbbb`, "fix: enable Budva CEDIS refresh and capability-based services") — this is the change area directly implicated in the current Priority 1 production issue.
- Event Platform expanded with five official collectors (KIC, CNP, Glavni Grad Podgorica, Tourism Podgorica, Cineplexx) and a deterministic quality pipeline.
- Going Out (MonteGigs) module introduced as a deliberately separate module from Events, with per-city isolated caches.
- Railway Docker web deployment path introduced, including the root-run entrypoint that repairs volume ownership at container start.
