# Contributing — Gradom.me Platform

This document explains how to work on this repository day to day. Read it alongside [CLAUDE.md](CLAUDE.md) (project memory and working agreement), [ARCHITECTURE.md](ARCHITECTURE.md) (system design), and `AGENTS.md` (the full engineering handbook, which remains the authoritative source for detailed standards — this document summarizes and cross-references it, it does not replace it).

## Before You Start

1. Read `AGENTS.md` in full — it is the binding engineering handbook (product principles, module boundaries, UI/accessibility/performance/TypeScript/React/Next.js standards, testing/logging/feature-flag/date-time/environment/security policy, git workflow, and the full "must never do" list).
2. Read [CLAUDE.md](CLAUDE.md), [CURRENT_STATUS.md](CURRENT_STATUS.md), [TECH_DEBT.md](TECH_DEBT.md), and [ROADMAP.md](ROADMAP.md) for current project state and priorities.
3. Read the relevant ADRs under `docs/adr/` for any area you're about to touch. Do not silently contradict an accepted ADR — propose a superseding ADR first.

## Development Workflow

```bash
pnpm install
pnpm run dev
```

Before opening a pull request, run the full mandatory quality suite:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

All five must pass. Treat build warnings as work to resolve, not acceptable noise (AGENTS.md §10).

## Git Workflow

This project intentionally uses a **direct Git workflow**, not a feature-branch/pull-request workflow by default. The full, canonical statement of this workflow lives in [CLAUDE.md §16](CLAUDE.md#16-git-workflow); it is summarized here, not restated in full — refer to CLAUDE.md as the source of truth if this summary and that section ever appear to diverge.

Standard workflow: explain the intended scope → make focused changes → run relevant tests → summarize the changes → wait for owner approval → commit → push → verify deployment if requested.

Do not create feature branches or pull requests as the default way of working. Only use them when the project owner explicitly requests that workflow for a specific piece of work.

Because pushing to the tracked branch triggers a Railway deployment (see [CLAUDE.md §9](CLAUDE.md#9-railway-production-notes-owner-confirmed-authoritative)), commit and push remain two distinct, separately-gated steps — never combine them or push automatically after committing.

The repository's CI (`.github/workflows/ci.yml`) still runs quality checks on every pull request and on pushes to `main`; this remains relevant only for the exception case where a branch/PR workflow is explicitly requested.

## Testing

- Use Node's built-in test runner. `pnpm run test` runs every `*.test.ts(x)` under `src`; narrower scripts exist for some modules (e.g. `pnpm run test:flights`, `pnpm run test:going-out`).
- Tests must never make live network requests — provider/collector tests use saved fixtures (`__fixtures__/`) with injected HTTP clients.
- Extend the smallest existing testing approach that covers a change's risk; do not introduce a new test framework without an approved need (AGENTS.md §24).
- Every new external integration needs deterministic fixtures plus explicit failure/staleness coverage.

## Code Style

- TypeScript strict mode; no `any`, `@ts-ignore`, or unchecked casts.
- `@/*` import alias for internal source; import order: type imports → external packages → absolute internal imports.
- Prettier + ESLint are enforced by `pnpm run format:check` / `pnpm run lint`, plus a `lint-staged` pre-commit hook. Don't hand-sort Tailwind classes against the Prettier plugin.
- Function components with typed props; prefer Server Components; avoid effects for derived state.
- Use `formatDateTime` from `@/shared/lib/date` for all date/time display — never call `Intl.DateTimeFormat` directly in components.

## Architecture Rules

- Respect the dependency direction: presentation → application → domain; infrastructure → application/domain contracts. Domain code never imports Next.js, React, DB clients, or provider SDKs.
- A module owns its domain types, use cases, validation, provider adapters, and tests. It must not import another module's internals, provider client, or persistence implementation directly — use a typed contract, read model, or event.
- `src/shared` is for genuinely cross-cutting, non-business-logic code only, promoted there only after at least two independent consumers need it.
- Keep route files thin — compose presentation and invoke module use cases; don't put domain rules or provider integrations in routes.

## What Not To Do

Directly from AGENTS.md §34 (read the full list there) — most relevant highlights:

- Never implement transport, maps, search, identity, administration, scraping, or persistence outside explicitly approved scope. The approved collector list (ŽPCG, Podgorica Airport, CEDIS, VIK Podgorica, KIC, CNP, Glavni Grad, Tourism, Cineplexx, MonteGigs) is the only exception, within its documented source/cache boundary.
- Never call a new external API, add a provider SDK, fabricate mock backend data, or invent live-data behavior without approved, documented scope.
- Never put business logic, provider calls, or module state in `src/shared`.
- Never bypass TypeScript, validation, authentication, authorization, or feature-flag requirements to make something demo-able.
- Never commit secrets, expose server-only env vars to the client, log sensitive data, or weaken security controls for convenience.
- Never make destructive git operations or publish changes without explicit authorization.
- Never claim a capability, test, or operational control exists unless it is implemented and verified.

Plus the project-owner operating rules (see CLAUDE.md §14): never commit, push, deploy, or run live production collectors without explicit instruction; explain scope before coding; keep changes minimal and focused; don't touch unrelated files.

## Debugging Philosophy

- **Reproduce before fixing.** Don't patch code in response to a symptom you haven't actually observed happening the way you think it is — confirm the failure first (locally with fixtures, or via real logs/evidence from the reporter).
- **Collect evidence before making assumptions.** When production behavior is ambiguous (e.g. "is the Budva-specific collector path even running?"), add the logging/instrumentation needed to get a real answer before changing logic. Evidence beats inference, especially across a collector → cache → application boundary you can't directly observe from the code alone.
- **Prefer logging over guessing.** Structured, targeted diagnostic logging (module-owned, one JSON-per-log-call, per AGENTS.md §18) is the sanctioned way to close an evidence gap — not speculative refactors "just in case."
- **Isolate root cause before changing architecture.** A bug in one collector's cache path does not justify restructuring the shared cache mechanism unless the evidence shows the shared mechanism itself is at fault. Fix at the narrowest layer the evidence points to.
- **Remove temporary debugging code afterwards.** Diagnostic logging added to investigate an issue should be reviewed once the issue is resolved — keep it only if it has lasting operational value; otherwise remove it so it doesn't become permanent noise.
- **Keep production behavior stable while investigating.** Prefer read-only diagnostics and additive logging over speculative production changes. Never run a live collector against real provider endpoints as an experiment without explicit instruction (see Working Agreement).

## How to Safely Introduce a New Module

1. Do not create the module until its scope, ownership, data source, failure behavior, and feature flag are approved (AGENTS.md §6).
2. Add a typed, lowercase camelCase feature flag in `src/shared/config/features.ts`, defaulting to `false`.
3. Scaffold `src/modules/<name>/{domain,application,infrastructure,presentation}` and keep all module-specific files colocated there.
4. If the module involves a new external data source, persistence, or another material architectural choice, write an ADR under `docs/adr/` first.
5. Wire the module in only at composition boundaries (routes, nav, dashboard fan-out) — never deep in domain logic.
6. Add fixture-based tests before/alongside implementation for anything touching an external source.

## How to Add a New City

1. Add an entry to `cityRegistry` in `src/shared/config/cities.ts` with a unique `id`/`slug`, `isActive: false` initially, and an accurate `capabilities: []` (start empty until each capability's source coverage is actually reviewed and approved).
2. Confirm `validateCityRegistry` still passes (exactly one `isMain` city, which must stay `isActive`).
3. For each capability you want the new city to have, confirm there's an approved, city-aware provider/collector for that data source in that city — do not flip a capability on just because the UI would render something; the underlying collector must actually support that city (see the Budva `water` gap as the current cautionary example — a capability should never be turned on without real provider coverage).
4. Set `isActive: true` only once route/UI/collector coverage for at least one capability is genuinely ready.
5. Verify routing (`getActiveCities()`-derived `generateStaticParams`), sitemap (`getCitySitemapPaths`), and dashboard composition (`getCityDashboardCapabilities`) all pick up the new city automatically — they should, since they derive from the registry, but verify.
6. Add/extend collector configuration (cache path per city, scheduler/cron entries) for each capability the new city supports.

## How to Add a New Collector

1. Confirm the source is an approved, documented official source with a written ADR (or get one written) — collectors are not added speculatively (AGENTS.md §34).
2. Build the infrastructure chain: host-allowlisted HTTP client → parser/normalizer → (for Events) run through the domain quality pipeline → atomic cache write via `src/shared/lib/cache.ts`'s `writeJsonCache`.
3. Resolve the cache path through `src/config/env.ts` (add an env var with a sane default under `RUNTIME_DATA_DIR`/`EVENT_CACHE_DIR` as appropriate), never a hardcoded path.
4. Gate live behavior behind an explicit feature flag / provider-mode env var, following the existing `ENABLE_*` / `*_PROVIDER_MODE` pattern; reject `mock` mode in production if a mock mode exists at all.
5. Add a `pnpm run collect:<name>` script in `package.json`, following the existing `node --experimental-strip-types <path>` convention.
6. Add an authenticated `/api/internal/<provider>/refresh` route using the shared `refresh-post-handler` pattern, with its own `<PROVIDER>_REFRESH_SECRET` (min 32 chars, server-only, validated in `env.ts`).
7. Write fixture-based tests for the parser, the refresh flow, and the cache — no live network calls, ever, in tests.
8. Add the collector to the appropriate scheduler mechanism (VPS shell-loop entry and/or a Railway cron trigger service, per the active production topology — confirm with the project owner which applies) and update `docs/DEPLOYMENT.md` / `docs/DEPLOYMENT_RAILWAY.md` and `AGENTS.md` §35 with its cadence and cache boundary.
9. Update `docs/ARCHITECTURE.md`, `README.md`, and this repository's `ARCHITECTURE.md`/`CLAUDE.md` collector inventories.
10. Never let a visitor request trigger this collector, directly or indirectly.
