# Technical Debt — Gradom.me Platform

This document tracks **structural, architectural, maintainability, and scalability concerns only**. It intentionally excludes active production bugs — those live in [CURRENT_STATUS.md](CURRENT_STATUS.md) under "Current Production Issues." A "Known Bugs" pointer is provided at the end for discoverability, not duplication.

Nothing is added here speculatively. Every item is either directly observable in the repository or explicitly documented as a constraint by the project's own docs/ADRs. Items that are documented, intentional design decisions (e.g. Budva lacking a water provider) are **not** technical debt and are not listed here.

## Critical

### 1. File-cache architecture is not durable or horizontally-shareable
**What:** All provider data is a JSON file on local disk (`.runtime/cache/*`, or `RUNTIME_DATA_DIR` in production). There is no database or shared object store.
**Why this belongs here:** This is explicitly documented as unsafe for serverless or multi-instance deployment (docs/DEPLOYMENT.md, docs/DEPLOYMENT_RAILWAY.md "Long-term Railway option" section). It caps the platform to a single web instance/process for now, and any future horizontal scaling requires a genuine architecture change (a durable storage adapter), not a config tweak. This is a structural constraint on the whole system's growth path, which is why it's Critical rather than Medium.
**Not a bug:** this was a deliberate, documented Sprint-0 decision (docs/DATABASE.md) — it is debt only in the sense that it constrains future scaling, not that it was done wrong.

### 2. Collector logging lacks a `collector` name field and fetched/parsed/rejected count granularity, and its production visibility is unverified
**What:** Verified directly from `cedis-cache.ts`/`collect-cedis.ts`: the CEDIS collector already logs one structured per-city JSON line (`cityId`, `cachePath`, `cacheStatus`, `alertCount`, `status`, `retainedPreviousSnapshot`, `warnings`, optional `errorCode`) on every run — this is not a total absence of structured logging, as earlier drafts of this document implied. What's actually missing is (a) a `collector` name field, (b) a fetched/parsed/rejected count breakdown (CEDIS alerts have no native "rejected" concept today, unlike Events), and (c) confirmation that this per-city line is actually visible and correct in Railway's production logs.
**Why this belongs here:** This is a structural gap in the collector/refresh architecture's logging granularity, not a one-off bug — it is what's blocking root-cause diagnosis of the current Budva CEDIS production issue (see [CURRENT_STATUS.md](CURRENT_STATUS.md) Issue 1 for the full, current diagnostic status and field list) and would limit diagnosis of the *next* per-city collector problem for any provider. Treat CURRENT_STATUS.md as the canonical, up-to-date source for this investigation's specific field list — it is not repeated here.

## Medium

### 3. Empty `daily-brief` module scaffold
**What:** `src/modules/daily-brief/` contains four empty layer directories (`application/`, `domain/`, `infrastructure/`, `presentation/`) with zero files, no route, no feature flag, and no ADR explaining its purpose.
**Why this belongs here:** Ambiguous, unexplained scaffolding in the module tree is a maintainability hazard — a future contributor cannot tell whether this is intentionally reserved, abandoned, or a mistake, and AGENTS.md explicitly discourages "empty templates, vague placeholders" (§29). Resolving this (either documenting its intended scope via ADR, or removing it) is low-effort but currently unowned.

### 4. Legacy aggregate refresh endpoints/secrets retained for compatibility
**What:** `POST /api/internal/events/refresh` and `POST /api/internal/city-alerts/refresh`, with `EVENT_REFRESH_SECRET` and `CITY_ALERTS_REFRESH_SECRET`, remain in the codebase and env schema alongside the newer per-provider endpoints/secrets, explicitly documented as "not the recommended recurring jobs because they cannot independently schedule Cineplexx, CEDIS, or VIK" (docs/DEPLOYMENT_RAILWAY.md).
**Why this belongs here:** Two overlapping refresh-trigger surfaces for overlapping providers increase the chance of misconfiguration (e.g. a stale cron still pointed at an aggregate endpoint) and increase the secret-management surface unnecessarily. This is intentional compatibility debt, not a bug — but it should have an explicit removal plan once nothing depends on it.

### 5. Legacy event `cityIds` field retained alongside required `cityId`
**What:** Event records have one required `cityId`, but `cityIds` is retained "for existing cross-city contracts," and legacy cache snapshots are backfilled from `cityIds` on read.
**Why this belongs here:** Dual representation of the same concept in the domain model is classic migration debt — it's justified today for backward compatibility with existing cache snapshots, but it is a permanent complexity tax on the Event domain type and every piece of code that touches `cityId`/`cityIds` until a deliberate migration/cleanup removes the legacy field.

## Low

### 6. Possible committed runtime cache seed file
**What:** `.runtime/cache/cedis-planned-outages.json` appears to be checked into the repository (observed during initial repo scan), even though `.runtime/cache/*` is generated collector output.
**Why this belongs here:** Committing generated cache artifacts risks the repo silently diverging from `.gitignore` intent, or a stale/misleading snapshot being mistaken for real data by a new contributor running the app locally. This needs owner confirmation of intent (deliberate local-dev seed vs. accidental commit) before any action — it is flagged here, not assumed to be wrong.

## Nice to Have

### 7. No Content Security Policy configured yet
**What:** docs/DEPLOYMENT.md explicitly states a CSP "is intentionally not configured until the production source/image policy is finalized; introduce it with report-only validation first."
**Why this belongs here:** This is a deliberately deferred hardening step with a stated rollout plan already in the docs — it's real future work, but explicitly not urgent by the project's own documentation, so it belongs in "nice to have" rather than a more urgent bucket.

## Explicitly Not Technical Debt

These are sometimes mistaken for debt but are documented, intentional decisions:

- **Budva lacks `water` capability.** No supported water-notice provider exists for Budva; this is a scope gap awaiting new provider approval, not an architectural flaw.
- **Weather is the only live-at-request-time provider (no cache/collector).** This is an approved, documented exception (ADR 0003) with its own defined failure state — not an inconsistency to "fix" by forcing it into the collector pattern.
- **No database.** A deliberate, documented Sprint-0 deferral pending approved data-ownership/retention/backup review (docs/DATABASE.md), not an oversight.

## Known Bugs

Active production bugs (Budva CEDIS `suspicious-empty-result`, Cineplexx `missing-date` rejection) are tracked in [CURRENT_STATUS.md](CURRENT_STATUS.md) under "Current Production Issues," not duplicated here.
