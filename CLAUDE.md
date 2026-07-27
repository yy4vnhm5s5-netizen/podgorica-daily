# CLAUDE.md — Gradom.me Project Memory

This file is the permanent, slow-changing memory for anyone (human or AI) working on the Gradom.me platform. It should stay accurate across many sessions. For fast-changing state, see [CURRENT_STATUS.md](CURRENT_STATUS.md), [TECH_DEBT.md](TECH_DEBT.md), and [ROADMAP.md](ROADMAP.md).

Sources: the repository, `AGENTS.md`, `docs/`, `docs/adr/`, and explicit project-owner corrections given in-session (Railway is production, Budva CEDIS/Cineplexx bug context, operating rules). Nothing here is invented; anything not directly verifiable from the repo is marked as owner-stated or assumption.

---

## 1. Project Overview

**Gradom.me** (the Gradom.me platform) is a production-oriented, multi-city local-information platform for Montenegro. It is not a social network or generic aggregator — it is a trusted, fast, accessible guide to daily city life, built around verified sources, visible freshness/attribution, and deterministic (non-AI) summaries.

- Active cities today: **Podgorica** (main city, full capability set) and **Budva** (weather, going out, electricity).
- Public interface language: Montenegrin Latin (ijekavian). English locale infrastructure exists in the codebase but is not exposed.
- No accounts, no persistence layer, no maps, no unified search — all explicitly out of scope until separately approved (AGENTS.md §34).

## 2. Architecture Overview

Gradom.me is a **modular monolith** (ADR 0001) built on Next.js 15 (App Router) + React 19 + TypeScript, deployed as a single Docker image.

Dependency direction is strict and inward-pointing:

```
presentation → application → domain
infrastructure → application/domain contracts
```

- **Domain** layer owns business types and rules; it must never import Next.js, React, DB clients, or provider SDKs.
- **Application** layer coordinates use cases (e.g. `getCityEvents`, `getCurrentWeather`) and composes read models for presentation.
- **Infrastructure** layer implements provider HTTP clients, parsers, file-cache adapters, and collectors.
- **Presentation** layer is Server-Components-first; client boundaries exist only for real interactivity (e.g. the events filter sheet).

Each module under `src/modules/<name>/` owns its own `domain/`, `application/`, `infrastructure/`, `presentation/` subfolders and may not reach into another module's internals. Cross-module collaboration happens only through typed contracts/read models, never direct calls into another module's cache or persistence.

`src/shared/` is intentionally minimal: typed UI primitives, non-secret shared config (`features.ts`, `site.ts`, `cities.ts`, `locale.ts`, `public-routes.ts`), reusable UI-only hooks, and small framework-neutral helpers (`date.ts`, `cache.ts`, `refresh-lock.ts`). It must never contain business logic or provider calls (AGENTS.md §7).

## 3. Module Overview

| Module | Status | Responsibility |
|---|---|---|
| `city-alerts` | Implemented | CEDIS (power outage, per active city) and VIK Podgorica (water) official cached notices. Largest, most mature module. |
| `events` | Implemented | Normalized city-aware Event/Venue domain; 5 official collectors (KIC, CNP, Glavni Grad Podgorica, Tourism Podgorica, Cineplexx via headless Chromium); deterministic ID + dedup + quality pipeline; public listing/detail UI. |
| `going-out` | Implemented | MonteGigs nightlife listings, deliberately separate from Events; isolated per-city snapshots (Podgorica + Budva). |
| `flights` | Implemented | Podgorica Airport arrivals/departures from the official public flight feed. |
| `transport` | Implemented | ŽPCG railway departures (collected) + BusTicket4.me (link-only, never scraped). |
| `weather` | Implemented | Open-Meteo current conditions — the one module that calls its provider live at request time rather than reading a cache; has a defined safe-failure state instead. |
| `daily-overview` | Implemented | Zero-cost, deterministic (non-AI, rule-based) daily summary generated from other modules' cached read models. |
| `contact` | Implemented | Server-side SMTP delivery of advertising/business inquiries; no storage; in-memory rate limiting (single-instance only). |
| `about`, `legal` | Implemented | Static presentation-only content. |
| `daily-brief` | **Empty scaffold** | Four empty layer directories (`application/domain/infrastructure/presentation`), no files, not wired into any route, flag, or test. No ADR or doc explains its intended scope. Treat as unimplemented; do not assume any behavior. |

## 4. Capability System

Every city in the registry (`src/shared/config/cities.ts`) declares a `capabilities: CityCapability[]` array from the fixed union: `electricity | events | flights | goingOut | railway | water | weather`.

Capabilities gate three independent things that must all agree before a feature is visible for a city:
1. **City registry capability** — does this city declare the capability at all?
2. **Feature flag** (`src/shared/config/features.ts`) — is the feature globally enabled (`ENABLE_*` env vars)?
3. **Route/dashboard composition** (`src/app/city-routing.ts`, `city-dashboard-data.ts`) — combines both to decide what routes exist and what the dashboard fetches.

Podgorica: `electricity, events, flights, goingOut, railway, water, weather` (all capabilities).
Budva: `electricity, weather, goingOut`. Budva has **no** `water` capability — there is currently no supported water-notice provider for Budva; this is an intentional scope gap, not a bug.

## 5. Multi-City Architecture

`CityContext` (`{ city, locale, timezone }`, defined in `src/shared/types/city.ts`) is the object threaded through every module boundary instead of hardcoded assumptions about a single city. It is derived at route boundaries via `resolveActiveCityRoute(slug)` / `createCityContext(cityId, locale)`.

The static city registry (`cityRegistry` in `cities.ts`) is validated at module load time: every city needs a non-empty `id`/`slug`, IDs and slugs must be unique, and there must be exactly one `isMain` city, which must also be `isActive`. Inactive registry entries (`bar`, `niksic`) exist only as planning data — they generate no routes, no collection jobs, no UI exposure.

Events carry one required `cityId` (with legacy `cityIds` retained for backfill compatibility on read). City-prefixed canonical URLs (`/podgorica`, `/budva`, `/podgorica/dogadjaji`, etc.) are the only public surface for city content; `/` is a separate, self-canonical platform homepage that lists active cities (ADR 0023) and does not render a city dashboard itself.

## 6. Collector Architecture

The single most important recurring pattern in this codebase: **collection and reading are strictly separate, and reading is always cache-only.**

```
official source → provider HTTP client (host-allowlisted) → parser/normalizer
  → [Events only: domain quality/dedup pipeline] → shared atomic JSON cache write
```

- A collector is invoked only via a `pnpm run collect:*` CLI script, the VPS shell-loop scheduler process, or an authenticated `POST /api/internal/<provider>/refresh` endpoint (bearer-secret protected, one secret per provider). All three mechanisms exist in the repository; only the CLI-script and refresh-endpoint paths are confirmed active in current (Railway) production — see §9.
- **No visitor request may ever trigger a collector.** This is a hard architectural rule repeated throughout AGENTS.md, ADRs, and docs/ARCHITECTURE.md.
- A file-based refresh lock (`shared/lib/refresh-lock.ts`) prevents overlapping runs of the same collector.
- Collectors retain the prior valid cache snapshot on failure — a failed refresh does not blank out previously-good data.
- Provider HTTP clients validate the target host against an explicit allow-list before making requests.

## 7. Cache & Snapshot Architecture

The shared cache helper (`src/shared/lib/cache.ts`) provides:
- `readJsonCache` / `writeJsonCache` — atomic write via temp-file + rename, so readers never see a partial write.
- `calculateCacheFreshness(fetchedAt, now, maxAgeMinutes)` — returns `fresh | stale | unavailable`.

Each module owns its own snapshot schema and cache file path, resolved under `RUNTIME_DATA_DIR` (default `.runtime` locally; `/app/.runtime` in Railway production per owner correction) plus a per-provider filename, e.g. `cedis-planned-outages.json`, `vikpg-water-alerts.json`, `montegigs-going-out.json`, `podgorica-flights.json`, `zpcg-railway-departures.json`, `events.json`/`kic-events.json`/`cnp-events.json`/`glavni-grad-events.json`/`tourism-events.json`/`cineplexx-events.json`.

**CEDIS is multi-city and its path derivation is not a flat filename — verified directly from `src/modules/city-alerts/infrastructure/cedis-cache.ts` and `cedis-cities.ts`:**
- Podgorica: `<RUNTIME_DATA_DIR>/cache/cedis-planned-outages.json` (the `CEDIS_CACHE_PATH` default).
- Budva: `getCedisCachePath("budva")` resolves to `<RUNTIME_DATA_DIR>/cache/cedis-planned-outages-budva.json` — a sibling file in the same directory, computed as `join(dirname(CEDIS_CACHE_PATH), "cedis-planned-outages-${cityId}.json")`. There is no separate `CEDIS_CACHE_PATH`-style env var for Budva; the Budva path is always derived, not independently configurable.
- Both cities are collected by one process: `runActiveCedisCollectors()` (`collect-cedis.ts`) iterates `getActiveCities()` filtered to active + `electricity` capability + CEDIS-supported (`isCedisSupportedCityId`), and runs `runCedisCollector` sequentially per city over one shared, memoized HTTP client (so the CEDIS listing page is fetched once and parsed per municipality heading — `cedisMunicipalities` in `cedis-cities.ts` matches `"Budva" | "Opština Budva"` for Budva and `"Podgorica" | "Glavni grad Podgorica"` for Podgorica). Each city has its own refresh lock file: `.cedis-refresh-<cityId>.lock`.
- Each per-city collector run **already emits one structured JSON summary line** via `writeOutput(JSON.stringify(summary))` containing `cityId`, `cachePath`, `cacheStatus`, `alertCount`, `status`, `retainedPreviousSnapshot`, `warnings`, and an optional `errorCode`. It does **not** currently include a `collector` name field or a fetched/parsed/rejected count breakdown (CEDIS alerts don't go through the Events quality pipeline, so "rejected" isn't a native concept here — only `parserWarnings` and an overall alert count exist). See CURRENT_STATUS.md's Issue 1 for what this means for the open Budva CEDIS investigation.

This file-cache architecture is **not durable on serverless/ephemeral filesystems** and is **not safe for horizontally scaled/multi-instance deployments** — this is an explicit, documented constraint (docs/DEPLOYMENT.md), not an oversight.

## 8. Deployment Overview

Two deployment topologies are documented in the repository:
- **Self-hosted VPS** (Docker Compose: `app` + `scheduler` containers sharing a named volume, Caddy reverse proxy) — fully documented, but **not the active production environment**.
- **Railway** (single `web` service + persistent volume + external cron-trigger services) — **this is the active production environment** (owner-confirmed).

## 9. Railway Production Notes (owner-confirmed, authoritative)

- Production deployment platform: **Railway**.
- Railway `web` service has a persistent volume mounted at **`/app/.runtime`**.
- Production env var: **`RUNTIME_DATA_DIR=/app/.runtime`**.
- Scheduled refreshes run through **Railway cron trigger services** calling authenticated internal refresh endpoints (`/api/internal/<provider>/refresh`) — **not** the Docker `scheduler` container's shell polling loop, which belongs to the VPS topology.
- The repository's own `railway.toml` only selects the Dockerfile and a health-check path; it does not declare a volume or cron jobs in-repo — that provisioning lives in the Railway dashboard, outside version control, and cannot be verified from the repo alone.
- **Pushing to the tracked branch triggers a Railway deployment.** `docs/DEPLOYMENT_RAILWAY.md` states "Railway auto-deploys the selected GitHub branch." This means, on this project, **push permission and deploy permission are effectively the same permission** — a `git push` to the branch Railway watches is not a purely local/version-control action, it ships to production. This is why the Working Agreement (§14) and Git Workflow (§16) treat "push" as its own explicit approval gate, distinct from "commit": commit is local and reversible, push is not.

This is the single canonical statement of these Railway facts; other documents in this repository (ARCHITECTURE.md, CURRENT_STATUS.md, DECISIONS.md) link here rather than restating them.

## 10. Testing Philosophy

- Node.js's **built-in test runner** is used — no Jest/Vitest/other framework.
- `pnpm run test` runs every `*.test.ts(x)` file found under `src`.
- Provider adapters and parsers are tested against **saved fixtures with injected HTTP clients** — tests must never make live network requests.
- Presentation tests focus on user-visible behavior and accessibility, not implementation detail.
- Every external integration is expected to have deterministic fixtures plus failure/staleness coverage.
- The mandatory pre-PR quality suite is: `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.

## 11. Coding Conventions

- TypeScript is strict; no `any`, `@ts-ignore`, or unchecked casts.
- Use the `@/*` path alias for internal imports; import order is type imports → external packages → absolute internal imports.
- Prefer Server Components; add `"use client"` only for a concrete browser/interaction need.
- Use `formatDateTime` from `@/shared/lib/date` for all date/time formatting — never instantiate `Intl.DateTimeFormat` directly in components. Store/exchange timestamps as ISO 8601 UTC; display in `Europe/Podgorica` by default.
- Use `cn` from `@/shared/lib/utils` for conditional class composition; follow Prettier's Tailwind class ordering.
- Feature flags are typed, camelCase, and centralized in `features.ts`; default to `false` until a module is approved.
- Conventional Commits: `type(scope): imperative summary` (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`).

## 12. Project Terminology

| Term | Meaning |
|---|---|
| **Collector** | A standalone script/process that fetches from an official external source and writes a cache snapshot. Never runs during a visitor request. |
| **Provider** | A module-owned adapter for one specific external data source (e.g. the CEDIS provider, the KIC provider). |
| **Snapshot / cache** | The atomically-written JSON file a collector produces and application queries read. |
| **Freshness** | `fresh | stale | unavailable`, computed from snapshot age vs. a per-provider freshness threshold. |
| **CityContext** | `{ city, locale, timezone }` — the typed object carrying which city a request/query concerns. |
| **Capability** | A named feature a city registry entry declares support for (e.g. `electricity`, `events`). |
| **Refresh endpoint** | An authenticated `POST /api/internal/<provider>/refresh` route that triggers one collector run on demand, used by Railway cron triggers. |
| **Quality pipeline** | The Events-module-only deterministic validation step (accept/warn/reject) that normalized event candidates pass through before dedup and caching. |
| **Read model** | A typed, presentation-facing shape returned by an application-layer query, decoupled from raw provider/cache schema. |

## 13. Important ADR Decisions

| ADR | Decision |
|---|---|
| 0001 | Modular monolith with strict layered dependency direction. |
| 0002 | Shared UI primitives live in `shared/components`, presentation-only. |
| 0003 | Open-Meteo used for current weather (only live-at-request-time provider). |
| 0004 | Locale-prefixed internationalization infrastructure retained but not exposed. |
| 0005 | Daily Overview is a deterministic rule-based summary — no LLM/generative service. |
| 0006 | City Alerts demo/mock CEDIS mode exists only for explicit dev previews. |
| 0007 | CEDIS is a cached, collector-only planned-outages source; page requests never scrape. |
| 0009 | Established the city-aware platform foundation (`CityContext`, registry) — partially superseded by ADR 0022. |
| 0010 | Event Platform foundation: normalized Event/Venue, provider-agnostic contracts. |
| 0011, 0013, 0014, 0015, 0017 | Approved official Event sources (KIC, CNP, Glavni Grad, Tourism, Cineplexx respectively) — one ADR each. |
| 0012 | Deterministic Event quality pipeline — reject/warn thresholds, diagnostics without leaking rejected records publicly. |
| 0016 | VIK Podgorica water notices follow the same collector→cache→application boundary as CEDIS. |
| 0018 | Superseded (Podgorica Airport flight schedule provider, replaced by ADR 0019). |
| 0019 | Podgorica Airport public flight feed is the approved Flights source. |
| 0020 | MonteGigs is the approved Going Out source; per-city isolated snapshots. |
| 0021 | Superseded (root-level public routes; replaced by ADR 0022/0023). |
| 0022 | City-prefixed public routing is canonical. |
| 0023 | `/` is the self-canonical platform homepage, not a duplicate city dashboard — supersedes the root-route/sitemap portions of ADR 0022. |

Full text lives under `docs/adr/`. Do not silently contradict an accepted ADR — propose a superseding ADR first (AGENTS.md §30).

## 14. Working Agreement

These rules apply to every coding session on this repository, by explicit project-owner instruction:

- **Explain the planned scope before making changes.** Do not start editing without stating what will change and why.
- **Prefer minimal, focused changes.** Do not expand scope beyond what was asked.
- **Avoid unnecessary refactoring.** A bug fix does not need surrounding cleanup; do not introduce abstractions the task doesn't require.
- **Never commit without explicit permission.** When a commit is appropriate, propose the exact message and wait.
- **Never push without explicit permission.**
- **Never deploy without explicit permission.**
- **Never execute production actions without explicit permission** — this includes running live collectors against real provider endpoints.
- **Run relevant tests after changes** (module-specific tests at minimum; full quality suite before anything resembling a PR).
- **Do not modify unrelated files.** Stage/change only what the task requires.
- **Preserve architecture consistency** — respect module boundaries, the shared-layer rules, and accepted ADRs; propose a superseding ADR rather than quietly deviating.
- Never expose or commit secrets, local configuration, runtime cache files, build output, coverage output, temporary files, or editor metadata.

## 15. Repository First Rule

Whenever a claim can be verified directly from repository code, ADRs, configuration, or documentation, always verify it from the primary source instead of relying on previous summaries.

Never present inferred information as confirmed fact.

## 16. Git Workflow

This project uses a direct Git workflow.

Standard workflow:

1. Explain the intended scope.
2. Make focused changes.
3. Run relevant tests.
4. Present a summary of the changes.
5. Wait for approval.
6. Commit.
7. Push.
8. Verify deployment if requested.

Do not create feature branches or Pull Requests unless explicitly requested by the owner.

## 17. Session Workflow

Expected workflow for every future coding session on this repository:

1. Read [CURRENT_STATUS.md](CURRENT_STATUS.md) — understand today's state, active bugs, and priorities.
2. Read [TECH_DEBT.md](TECH_DEBT.md) — understand known structural constraints before touching related code.
3. Read [ROADMAP.md](ROADMAP.md) — understand where the project is headed so changes stay aligned.
4. Clarify ambiguous requirements before coding — ask rather than assume when scope, data ownership, or architecture impact is unclear.
5. Explain the planned scope before making changes.
6. Keep changes minimal and focused on the stated task.
7. Run relevant tests (and the full quality suite when the change is broad or pre-PR).
8. Summarize all changes made at the end of the session.
9. Never commit, push, deploy, or execute production actions unless explicitly instructed.

## 18. Documentation & Design Self-Review Rule

Any significant documentation, architectural, or design task must end with a structured self-review before being considered complete — do not assume your own output is correct.

The self-review must, at minimum:
- Re-read the produced output critically, as if encountering it for the first time.
- Check every factual claim against its actual source (repository code, existing docs, or explicit owner statement) rather than against your own prior summary of that source.
- Check for contradictions and redundant restatement across documents; prefer a single canonical location for any fact, with other locations linking to it.
- Identify claims that are unverified, inferred, or reconstructed, and label them explicitly rather than presenting them as confirmed.
- Flag anything likely to go stale (hard counts, snapshot-in-time claims) and remove or soften it.
- List what a new senior engineer would still not know after reading the material.

Do not skip this step for time pressure. A documentation or design task is not done until this review has been performed and its findings either fixed or explicitly deferred with the requester's agreement.
