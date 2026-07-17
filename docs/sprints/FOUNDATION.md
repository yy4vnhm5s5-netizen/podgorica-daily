# Foundation Release — v0.1.0-foundation

- Status: Complete
- Date: 2026-07-17

## Goals achieved

The Foundation phase established a maintainable, production-oriented base for Podgorica Daily without implementing product features or live data. The result is a responsive, accessible shell with a documented engineering model for future modules.

## Architecture

The application is a Next.js App Router modular monolith. Future capabilities belong under `src/modules/<module-name>` and own presentation, application, domain, and infrastructure concerns. Dependencies point inward; modules do not reach into another module’s persistence implementation.

Shared code is limited to cross-cutting UI and infrastructure concerns in `src/shared`. The two accepted decisions are:

- [ADR 0001](../adr/0001-modular-monolith.md): modular monolith with explicit module boundaries.
- [ADR 0002](../adr/0002-shared-ui-primitives.md): typed, shadcn-compatible shared UI primitives.

## Completed work

- Bootstrapped Next.js 15, React 19, TypeScript, Tailwind CSS, and the `src/` layout.
- Enabled strict TypeScript, `@/*` imports, Zod environment validation, ESLint, Prettier, Husky, and lint-staged.
- Added a standalone Docker image, Docker Compose service, and GitHub Actions quality workflow.
- Built typed shared primitives for cards, feedback states, status, timestamps, refresh actions, buttons, badges, and skeletons.
- Built an accessible shell with a sticky header, responsive navigation, mobile bottom navigation, safe-area spacing, footer, dashboard grid, skip link, theme switcher, and pre-paint theme initialization.
- Added static dashboard placeholders only; no module, provider, API, mock backend, or business logic was introduced.
- Centralized date/time formatting with `Europe/Podgorica` as the display default and added default-off feature flags for planned modules.
- Added specifications, contribution templates, ADRs, and the root `AGENTS.md` handbook.

## Validation

The release baseline has been verified with:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
```

GitHub Actions runs the same quality sequence on pull requests and pushes to `main`. The Docker image uses Next.js standalone output and a non-root runtime user.

There is no automated test framework yet. That is intentional for the no-business-logic foundation, but it must be addressed before live provider integrations ship.

## Remaining roadmap

1. Deliver trusted local-data modules for weather, transport, and events, each with approved providers, provenance, freshness, stale-data behaviour, monitoring, tests, and feature flags.
2. Add maps, unified search, identity, and editorial administration after their ADRs, data ownership, and operational requirements are approved.
3. Introduce deterministic daily overviews only after source-backed data, cache policy, and provider contracts are approved.
4. Complete hardening for performance, security, accessibility, resilience, observability, and production operations before a broad product rollout.

## Technical debt

- No test runner, unit tests, integration tests, accessibility automation, or visual regression suite exists.
- No structured logging, monitoring, health endpoint, error tracking, or dependency vulnerability-audit workflow is configured.
- No database, authentication, provider, API, caching, or persistence decision has been made; this is intentional and must remain explicit.
- The repository has no `LICENSE` file despite the original MIT-license requirement. A copyright holder must be confirmed before publishing one.
- The current dashboard uses static shell placeholders and is not evidence of live module delivery.

## Next milestones

- Resolve release metadata: add the MIT license with the confirmed copyright holder and publish the release tag after review.
- Establish the test strategy and minimum test tooling before the first external integration.
- Approve the weather-module provider and contract decisions, then implement it behind its existing feature flag.
- Define production observability and deployment ownership before operating live data.
