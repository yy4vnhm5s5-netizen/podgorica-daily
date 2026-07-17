# Repository Health Report — Foundation Release

- Assessment date: 2026-07-17
- Scope: v0.1.0-foundation baseline

## Executive assessment

Podgorica Daily is a well-structured foundation, not yet a production product. Its architecture, documentation, quality gates, and application shell are strong for this stage. It is ready to begin controlled module delivery, but it is not ready to serve live information or claim full operational production readiness.

| Area                       | Score | Assessment                                                                                                                                                       |
| -------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project maturity           |   3/5 | Strong foundation and delivery standards; no product module has shipped.                                                                                         |
| Architecture               |   4/5 | Clear modular-monolith direction and accepted ADRs; boundaries are unproven until a real module exists.                                                          |
| Maintainability            |   4/5 | Strict typing, consistent tooling, clear shared-layer rules, and an AI handbook provide a good baseline.                                                         |
| Scalability                |   3/5 | Module isolation is planned, but persistence, caching, queues, and operational limits are intentionally undecided.                                               |
| Documentation completeness |   4/5 | Product, API, data, UI, scraper, ADR, sprint, and handbook documentation are present; operational runbooks are deferred.                                         |
| Testing readiness          |   2/5 | Quality checks are strong, but no test framework, fixtures, accessibility automation, or visual regression suite exists.                                         |
| Production readiness       |   2/5 | Containerization, CI, validation, and safe defaults exist; live-data operations, observability, security controls, and legal release metadata remain incomplete. |

## Consistency review

The following documents are consistent with the current implementation:

- `README.md` accurately describes a foundation-only application with no product modules.
- `docs/PROJECT.md` and `AGENTS.md` consistently prohibit unapproved feature work and require accessibility, privacy, source integrity, and reviewed delivery.
- `docs/ARCHITECTURE.md`, `AGENTS.md`, and ADR 0001 consistently specify a modular monolith with inward dependencies and isolated modules.
- `AGENTS.md` and ADR 0002 consistently reserve `src/shared` for typed, cross-cutting presentation and infrastructure code.
- `docs/ROADMAP.md` now records the Foundation phase as complete while keeping product modules as future work.

No application-code change is required by this review.

## Direct dependency review

Only direct dependencies are listed here. Transitive packages are locked by `pnpm-lock.yaml` and should be reviewed through automated vulnerability scanning before public release.

| Dependency                    | Why it exists                                                  | Still required?                         | Lighter alternative / decision                                                         |
| ----------------------------- | -------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `next`                        | App Router framework, build pipeline, standalone output.       | Yes.                                    | None; it is the selected platform.                                                     |
| `react`                       | Component runtime required by Next.js.                         | Yes.                                    | None.                                                                                  |
| `react-dom`                   | DOM renderer required by Next.js.                              | Yes.                                    | None.                                                                                  |
| `typescript`                  | Strict type checking and Next.js TypeScript support.           | Yes.                                    | None.                                                                                  |
| `tailwindcss`                 | Project styling system and design tokens.                      | Yes.                                    | CSS modules would be a different architecture; do not change without a decision.       |
| `postcss`                     | Tailwind CSS processing pipeline.                              | Yes.                                    | None while using Tailwind 3.                                                           |
| `autoprefixer`                | Browser-prefix processing in the CSS pipeline.                 | Yes.                                    | Keep unless the CSS build strategy changes.                                            |
| `@radix-ui/react-slot`        | `Button` composition via the shadcn-compatible `asChild` API.  | Yes, for the established primitive API. | Remove only if `asChild` is deliberately dropped from the design system.               |
| `class-variance-authority`    | Typed variants for shared UI primitives.                       | Yes.                                    | Handwritten class maps are lighter but less consistent; retain.                        |
| `clsx`                        | Conditional CSS class construction.                            | Yes.                                    | Native arrays are lighter but less readable and duplicate utility logic.               |
| `tailwind-merge`              | Resolves conflicting Tailwind utilities in `cn`.               | Yes.                                    | Omit only if components stop accepting composable class overrides.                     |
| `lucide-react`                | Tree-shakeable accessible icons for shared shell and controls. | Yes.                                    | Inline SVG is lighter per icon but less maintainable; retain.                          |
| `zod`                         | Runtime environment validation.                                | Yes.                                    | Manual parsing is smaller but less safe and less extensible for future API validation. |
| `eslint`                      | Static code quality checks.                                    | Yes.                                    | None.                                                                                  |
| `eslint-config-next`          | Next.js and React-specific lint rules.                         | Yes.                                    | None while using Next.js.                                                              |
| `@eslint/eslintrc`            | `FlatCompat` support for the current ESLint configuration.     | Yes.                                    | Remove only after migrating away from compatibility-based configuration.               |
| `eslint-config-prettier`      | Prevents formatting-rule conflicts with Prettier.              | Yes.                                    | None while both ESLint and Prettier are used.                                          |
| `prettier`                    | Deterministic formatting for source and documentation.         | Yes.                                    | None.                                                                                  |
| `prettier-plugin-tailwindcss` | Canonical Tailwind utility ordering.                           | Yes.                                    | Manual ordering is less reliable; retain.                                              |
| `husky`                       | Local pre-commit hook installation.                            | Yes.                                    | CI alone is lighter but loses fast local feedback; retain.                             |
| `lint-staged`                 | Limits pre-commit checks to changed files.                     | Yes.                                    | A custom script is possible but not simpler.                                           |
| `@types/node`                 | Node.js typings for configuration and build tooling.           | Yes.                                    | None.                                                                                  |
| `@types/react`                | React typings.                                                 | Yes.                                    | None.                                                                                  |
| `@types/react-dom`            | React DOM typings.                                             | Yes.                                    | None.                                                                                  |

### Dependency conclusion

The direct dependency set is lean and appropriate for the current foundation. No removal is recommended before Sprint 4. The only conditional cleanup candidate is `@radix-ui/react-slot`, but it supports the selected shadcn-compatible primitive API and should remain unless that API is intentionally simplified.

## Technical debt and release blockers

### Must resolve before public open-source publication

1. Add the promised MIT `LICENSE` file using the confirmed copyright holder.
2. Commit the existing foundation, shell, handbook, and release-document changes into the intended logical history.
3. Confirm the release tag and publishing authority for `v0.1.0-foundation`.

### Must resolve before live-data production use

1. Establish automated tests, integration fixtures, and accessibility checks.
2. Choose structured logging, monitoring, alerting, correlation identifiers, and health checks.
3. Approve provider, legal, attribution, freshness, caching, and failure policies per module.
4. Define database ownership, backup/restore, retention, access, and migration policies before persistence.
5. Run automated dependency vulnerability scanning in CI and on a release cadence.

## Top 10 priorities before version 1.0

1. Add the MIT license and complete release/tag ownership checks.
2. Establish a test strategy and add focused unit, integration, accessibility, and visual-regression tooling.
3. Add automated dependency vulnerability scanning and a documented remediation policy.
4. Define structured logging, monitoring, error tracking, health checks, and incident ownership.
5. Select and document weather-provider contracts, provenance, attribution, freshness, cache, and stale-data behaviour in an ADR.
6. Implement the first module behind its feature flag with deterministic fixtures and complete user states.
7. Define database selection criteria, migration governance, backup/restore testing, and retention controls before data persistence.
8. Establish authentication and authorization architecture before editorial or administrative workflows.
9. Define performance budgets and automate Web Vitals, accessibility, and mobile visual checks in CI.
10. Publish deployment, rollback, secret-rotation, and incident-response runbooks before broad rollout.
