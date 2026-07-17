# Podgorica Daily — AI Engineering Handbook

## 1. Project Vision

Podgorica Daily is a trusted, fast, and accessible guide to daily life in Podgorica. It helps residents find local information quickly while making source, freshness, attribution, and limitations visible. Read `docs/VISION.md` before changing product-facing behaviour.

The repository currently contains a production-oriented foundation, design system, application shell, a server-rendered Weather module for current Podgorica conditions, and an explicitly labelled internal Daily Brief demo. The demo uses mocked content only; it is not AI-generated and must never be represented as a production summary. Transport, events, persistence, authentication, scraping, maps, search, and production AI features are not implemented. Do not describe shell placeholders or the Daily Brief demo as implemented product capabilities.

## 2. Product Principles

- Solve repeatable local needs; local utility comes before novelty.
- Make trust visible through source, freshness, attribution, and status whenever data is consequential.
- Keep public information usable without an account. Accounts are for approved editorial or administrative workflows only.
- Treat accessibility, privacy, responsive behaviour, and constrained-network use as baseline requirements.
- Introduce AI only after source-backed content and an editorial governance model exist.

## 3. Engineering Principles

- Prefer small, explicit changes that preserve module ownership.
- Keep dependencies pointing inward: presentation and infrastructure depend on application/domain contracts; domain code depends on neither framework nor vendor SDKs.
- Use typed contracts at boundaries. Do not leak provider payloads, database records, or unvalidated input across them.
- Optimize for maintainable evolution, not premature services or abstractions.
- Add no speculative code, placeholder `TODO`s, dead files, or unused dependencies.

## 4. Repository Structure

```text
src/
  app/                 Next.js App Router routes, root layout, and global styles
  config/              process-wide configuration validation
  hooks/               application-wide hooks only
  modules/             future module-owned feature code
  shared/              cross-cutting presentation and infrastructure utilities
    components/        typed, reusable UI primitives and shell components
    config/            shared configuration, including feature flags
    hooks/             reusable UI-level hooks only
    lib/               framework-neutral helpers
    types/             cross-cutting presentation/infrastructure contracts
  types/               application-wide declarations only
docs/                  project specifications and technical documentation
docs/adr/              accepted architecture decision records
.github/               CI and contribution templates
```

The root route in `src/app/page.tsx` redirects to the default locale. The locale dashboard route is `src/app/[locale]/page.tsx`, and the root layout is `src/app/layout.tsx`. The dashboard combines the Weather module, the clearly labelled Daily Brief demo, and static placeholders for unimplemented capabilities; search and command-palette messages are non-interactive placeholders.

## 5. Architecture

Use a modular monolith as established by [ADR 0001](docs/adr/0001-modular-monolith.md). Future capabilities live under `src/modules/<module-name>` and own their presentation, application, domain, and infrastructure concerns.

When a module is introduced, use this direction of dependency:

```text
presentation -> application -> domain
infrastructure -> application/domain contracts
```

Routes compose module presentation and shared UI. Provider clients, database adapters, queues, and caches belong to the owning module’s infrastructure layer. The domain layer must not import Next.js, React, database clients, or provider SDKs.

## 6. Module Boundaries

- A module owns its domain types, use cases, validation rules, provider adapters, persistence schema/migrations, tests, and feature-specific hooks.
- A module may import stable `shared` contracts and presentation primitives.
- A module must not import another module’s internal files, provider client, persistence implementation, or tables.
- Cross-module collaboration uses an approved typed contract, read model, or event—not a direct database query.
- Do not create a module until its scope, ownership, data source, failure behaviour, and feature flag are approved.
- Module names are lowercase kebab-case directory names. Keep feature-specific files colocated with the module.

## 7. Shared Layer Rules

`src/shared` is for genuinely cross-cutting code only. It must not become an unowned business layer.

- `shared/components` contains typed, responsive, accessible presentation primitives and shell components. It contains no domain workflows, provider calls, or module data assumptions. Follow [ADR 0002](docs/adr/0002-shared-ui-primitives.md).
- `shared/config` contains shared, non-secret configuration such as `features.ts` and `site.ts`.
- `shared/hooks` contains reusable UI-level hooks with no domain ownership.
- `shared/lib` contains small, focused helpers. The current date service is `shared/lib/date.ts`; do not duplicate date formatting in components.
- `shared/types` contains only cross-cutting presentation or infrastructure contracts. Domain types remain module-owned.
- Promote code to `shared` only after at least two independent consumers have the same stable need, or when it is an established platform primitive.

## 8. UI & UX Standards

- Use the existing typed primitives in `src/shared/components/ui` and composition components before adding another primitive.
- Use Tailwind utilities and the project’s semantic tokens (`background`, `foreground`, `primary`, `muted`, `border`) rather than one-off visual systems.
- The design is mobile-first, minimal, spacious, and responsive by default. Content must adapt intentionally; it must not merely shrink.
- Each future asynchronous journey must define loading, empty, partial, stale, error, and success states. Use the shared state primitives where appropriate.
- Keep source attribution and freshness close to consequential data.
- Do not turn static “coming soon” shell content into disabled controls. Until a capability exists, use clear non-interactive presentation.
- Storybook is not installed. When it is introduced, colocate `*.stories.tsx` next to the component and use static props only; stories must not call production services or module APIs.

## 9. Accessibility Standards

Target WCAG 2.2 AA as specified in `docs/UI.md`.

- Use semantic landmarks and native elements first. Every page needs a meaningful main-content path; preserve the root skip link and `#main-content` target in the shell.
- Every interactive control must be keyboard-operable, visibly focusable, have an accessible name, and communicate state without color alone.
- Use real buttons for actions and anchors for navigation. Do not use disabled interactive elements as placeholders.
- Keep headings ordered and meaningful. Do not use heading tags merely for styling.
- Provide text alternatives for icons; decorative icons use `aria-hidden="true"`.
- Respect touch target size, zoom, contrast, reduced motion, and safe-area insets on narrow devices.
- Test keyboard navigation, light and dark themes, and narrow/mobile layouts whenever UI changes.

## 10. Performance Standards

- Default to Server Components. Add client boundaries only for browser APIs, event handlers, or client state.
- Keep client components and shipped JavaScript small; do not mark a page or layout `"use client"` without a concrete need.
- Load expensive visualizations, map SDKs, and provider-dependent UI only when needed.
- Avoid layout shift; reserve predictable space for loading UI and media.
- Do not add a dependency for a small helper already covered by platform APIs or existing utilities.
- Run a production build before handoff. Treat build warnings as work to resolve, not as acceptable noise.

## 11. TypeScript Standards

- TypeScript is strict (`tsconfig.json`); maintain strictness and do not suppress errors with `any`, `@ts-ignore`, or unchecked casts.
- Use interfaces for component props and explicit exported types when callers need them.
- Prefer narrow unions, discriminated unions, and `unknown` plus validation at runtime boundaries.
- Keep types next to their owner. Do not place module types in `src/shared/types` or `src/types` merely for convenience.
- Use the `@/*` absolute import alias for source imports. Keep import ordering consistent with existing files: type imports, external packages, then absolute internal imports.

## 12. React Standards

- Use function components and typed props.
- Keep components focused: rendering and local interaction only. Move feature workflows to their module application layer.
- Do not fetch data inside generic shared components.
- Avoid effects for derived state. Use effects only for synchronization with an external system.
- Use stable keys derived from data, not array indexes, except for purely static structural rendering such as a fixed skeleton line count.
- Preserve server/client boundaries. Browser globals (`window`, `document`, `localStorage`) are allowed only in client components or intentionally inlined browser initialization code such as the current theme script.

## 13. Next.js Standards

- Use the App Router under `src/app`; do not introduce the Pages Router.
- Keep route files thin: compose presentation and invoke module use cases, but do not house domain rules or provider integrations in routes.
- Export route metadata deliberately. Update root metadata from `shared/config/site.ts` only for site-wide information.
- Validate environment variables through `src/config/env.ts` at process start; never read unvalidated `process.env` throughout the application.
- Preserve `output: "standalone"` unless its container deployment implications are reviewed.
- The theme initialization script must stay in the document head so the theme is selected before first paint. Maintain `color-scheme` support and the hydration safeguard only while that script mutates the root element before hydration.

## 14. Styling Standards

- Use Tailwind CSS and the configured semantic CSS variables in `src/app/globals.css`.
- Use `cn` from `@/shared/lib/utils` for conditional class composition.
- Follow the configured Prettier Tailwind ordering; do not hand-sort utilities against the formatter.
- Support both light and dark themes for all new shared UI.
- Use existing responsive breakpoints and mobile-first utilities. Preserve `env(safe-area-inset-bottom)` spacing where fixed mobile navigation is present.
- Avoid inline style objects except where a runtime value cannot be expressed safely with the existing token system.

## 15. State Management Policy

No global application state manager is installed or justified today.

- Keep ephemeral UI state local to the component.
- Use URL state for shareable navigation, filters, and search state when those features are implemented.
- Keep server data in the owning module’s application/infrastructure boundary; choose a client cache only after its invalidation, SSR, and ownership needs are documented.
- Do not introduce Redux, Zustand, React Query, or similar tools without a concrete approved use case, dependency review, and documentation update.

## 16. API Design Principles

Follow `docs/API.md` for every future API.

- Expose domain-oriented, stable contracts—not raw provider payloads.
- Validate input at the server boundary and return deterministic error codes with safe messages.
- Version breaking changes through endpoint versioning or versioned schema evolution.
- Define pagination, filtering, and sorting only when their semantics are explicit.
- Include source, freshness, and attribution metadata for external information where applicable.
- Enforce authentication, authorization, rate limiting, and error translation on the server.

## 17. Error Handling

- Validate untrusted input at the boundary and turn failures into typed, safe application errors.
- Distinguish validation, authentication, authorization, not-found, conflict, rate-limit, and upstream failures.
- Never expose credentials, stack traces, internal topology, or unfiltered provider errors to users.
- External integrations require timeouts, bounded retries, cache/staleness policy, and a clear user-facing failure state.
- Use `ErrorState` for generic presentation only; module-owned error mapping decides copy and recovery actions.

## 18. Logging

No logging library is currently installed. Do not add ad hoc `console` logging as an observability strategy.

When logging is introduced, use structured, privacy-safe events with correlation identifiers, severity, module ownership, and operationally useful context. Never log secrets, access tokens, raw restricted provider content, or unnecessary personal data. Any logging vendor or retention decision requires an ADR.

## 19. Feature Flag Policy

All product modules are gated through `src/shared/config/features.ts`.

- Add a typed, lowercase camelCase flag before exposing a new module or incomplete capability.
- Flags default to `false` until the module is approved and ready to be exposed. The approved `dailyBrief` demo is the documented exception: it is enabled only because every surface labels it as a demo.
- Use `isFeatureEnabled()` rather than scattered flag literals.
- Keep flags at composition boundaries (routes/navigation/module entry points), not deeply throughout domain logic.
- Remove a flag and its dead branch once rollout is complete; document any non-trivial rollout decision.
- Flags are not authorization controls and must not protect secrets or privileged operations.

## 20. Date & Time Policy

- Store and exchange timestamps as ISO 8601 UTC values with explicit offsets where applicable.
- Display local information in `Europe/Podgorica` by default.
- Use `formatDateTime` from `@/shared/lib/date` for UI date/time formatting. Components must not instantiate `Intl.DateTimeFormat` or call locale date/time formatters directly.
- Pass an explicit locale or time zone only when the product requirement justifies an override.
- Preserve timezone semantics for local events; do not silently convert a local civil time into a different meaning.

## 21. Environment Variables

- Define and validate every runtime variable in `src/config/env.ts` using Zod.
- Add non-secret examples to `.env.example`; never commit real values.
- Prefix a variable with `NEXT_PUBLIC_` only when it is intentionally safe for the browser bundle.
- Keep secrets server-only and out of logs, test fixtures, issue content, and client components.
- Update deployment configuration and documentation when a required variable changes.

## 22. Security Guidelines

- Treat remote content, request input, URLs, and provider payloads as untrusted.
- Authenticate and authorize privileged server actions; never rely on client-side checks.
- Use least-privilege access, bounded requests, timeouts, rate limits, and safe error translation for integrations.
- Do not scrape or bypass access controls. Follow `docs/SCRAPERS.md`: prefer official APIs, respect source terms and robots directives, and record provenance and ownership.
- Before storing data, define retention, deletion, access, backup, and privacy controls as required by `docs/DATABASE.md`.
- Require an ADR for material security, identity, provider, hosting, AI, persistence, or observability choices.

## 23. Dependency Policy

- Use the existing stack first: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-compatible primitives, Zod, and Lucide.
- Add a dependency only when platform APIs or current dependencies cannot meet a concrete requirement cleanly.
- Evaluate maintenance, bundle size, licensing, security history, SSR/RSC compatibility, and exit strategy before adding one.
- Pin through `pnpm` and update the lockfile. Do not install packages merely to prepare for unapproved future work.
- Do not add testing, state-management, map, auth, database, provider, or AI dependencies until the associated scope is approved.

## 24. Testing Policy

No automated test framework is configured yet. Do not claim tests ran when none exist.

- Before adding a feature, propose the smallest testing approach that covers its risk; add a test framework only with an approved need.
- Test domain and application logic at their boundaries; test provider adapters with fixtures; keep UI tests focused on user-visible behaviour and accessibility.
- Every future external integration needs deterministic fixtures and failure/staleness coverage.
- Until tests are configured, run the mandatory quality suite: `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`.

## 25. Git Workflow

- Inspect `git status -sb` and the relevant diff before staging.
- Do not stage unrelated work in a mixed worktree. Stage explicit paths or hunks.
- Work on a focused branch; use the repository’s established branch convention when one exists, otherwise use the current environment’s required prefix.
- Keep commits small, buildable where practical, and limited to one intent.
- Do not rewrite, reset, or discard user changes without explicit authorization.

## 26. Conventional Commit Rules

Use Conventional Commits:

```text
type(scope): imperative summary
```

Use `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, or `perf` as appropriate. Examples: `docs: introduce AI engineering handbook`, `fix(shell): preserve mobile safe-area spacing`, `feat(weather): add provider contract`.

- Keep the summary concise, lowercase, and imperative.
- Use a scope only when it clarifies the owned area.
- Do not combine documentation, feature work, and unrelated refactors in one commit.

## 27. Pull Request Workflow

- Open a focused pull request with the repository template completed truthfully.
- State the user/operational outcome, scope, architectural impact, risks, and validation performed.
- Confirm module ownership, documentation/ADR impact, accessibility, configuration, privacy, and observability effects.
- Ensure CI quality checks pass before requesting review.
- Do not merge or publish an unfinished feature behind an undocumented assumption.

## 28. Code Review Checklist

- Does the change honor the product documentation and relevant ADRs?
- Is code owned by the correct module or genuinely shared?
- Are boundaries, input validation, error states, and feature flags explicit?
- Is UI semantic, keyboard-accessible, responsive, light/dark compatible, and safe-area aware?
- Are types strict and runtime boundaries validated?
- Are new dependencies, configuration, security, privacy, and operational impacts justified?
- Are date/time formatting and source/freshness rules followed?
- Are formatting, linting, type checking, and production build verified?

## 29. Documentation Rules

`docs/` is the project specification and takes precedence over implementation assumptions.

- Read the relevant documents and ADRs before changing application behaviour or architecture.
- Update documentation in the same change when implemented behaviour, contracts, operational policy, or user-facing scope changes.
- Keep statements factual: distinguish current implementation from planned capabilities.
- Do not add empty templates, vague placeholders, or undocumented “future” architecture.
- Keep README focused on the project and current developer workflow; place detailed decisions in `docs/` or ADRs.

## 30. ADR Policy

The accepted ADRs are `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-shared-ui-primitives.md`, `docs/adr/0003-open-meteo-current-weather.md`, `docs/adr/0004-locale-prefixed-internationalization.md`, and `docs/adr/0005-daily-brief-demo-preview.md`.

- Create a new numbered ADR for a material, lasting architectural decision: providers, maps, identity, persistence, hosting, AI models, observability, or an architectural boundary change.
- Include status, date, context, decision, and consequences.
- Do not silently contradict an accepted ADR. Propose a superseding ADR and explain the trade-off before implementation.
- Small local implementation choices do not need an ADR.

## 31. Sprint Workflow

1. Read this handbook, applicable `docs/`, ADRs, and the affected code.
2. Confirm the sprint scope, non-goals, module owner, dependencies, and acceptance criteria.
3. Identify needed documentation or ADR decisions before coding.
4. Implement only the approved scope behind the appropriate feature flag.
5. Validate with the mandatory quality suite and relevant feature tests once available.
6. Review the diff for accessibility, security, responsive behaviour, module boundaries, and dead code.
7. Commit logically using Conventional Commits and prepare a concise review summary.

If a required decision, authority, provider contract, or security/privacy review is missing, stop and request it rather than guessing.

## 32. Definition of Done

A change is done only when it:

- meets its documented acceptance criteria without expanding scope;
- respects module/shared-layer boundaries and relevant ADRs;
- is typed, formatted, linted, type-checked, and production-built;
- includes appropriate accessible, responsive, light/dark, loading, empty, stale, and error behaviour for its scope;
- validates configuration and untrusted inputs at the correct boundary;
- documents user, operational, API, data, security, and rollout impacts where applicable;
- has a focused conventional commit and review-ready diff.

## 33. AI Behaviour Rules

- Start by reading the relevant documentation, ADRs, current structure, and existing patterns; do not rely on generic project assumptions.
- State material assumptions and stop for direction when an unapproved choice would change product scope, architecture, data ownership, security, or external commitments.
- Preserve user-authored changes in a dirty worktree. Do not reformat or modify unrelated files.
- Prefer the smallest implementation that meets accepted criteria. Explain trade-offs when more than one reasonable approach exists.
- Verify claims with local checks and report exactly what passed, failed, or could not run.
- Keep feature work out of shared code unless it meets the shared-layer rules.

## 34. Things AI Must Never Do

- Never implement transport, events, maps, search, identity, administration, scraping, persistence, or AI without explicit approved scope. Extend Weather only through its module boundary and approved provider policy.
- Never call an external API, add a provider SDK, create mock backend data, or fabricate live-data behaviour unless requested and documented.
- Never put business logic, provider calls, or module state in `src/shared`.
- Never bypass TypeScript, validation, authentication, authorization, feature flags, or source attribution requirements to make a demo work.
- Never commit secrets, expose server variables to the client, log sensitive data, or weaken security controls for convenience.
- Never make destructive Git operations, overwrite unrelated changes, or publish changes without explicit authorization.
- Never claim a capability, test, or operational control exists unless it is implemented and verified.

## 35. Future Expansion Guidelines

Introduce modules incrementally in the roadmap order and only after their contracts are approved:

- Trusted local data modules need documented providers, legal/attribution review, provenance, freshness, stale-data behaviour, monitoring, and a default-off feature flag.
- Maps, search, identity, and administration need an ADR before selecting a vendor or data model.
- Persistence starts only after module data ownership, migration strategy, retention, backup/restoration, and access controls are defined.
- AI summaries start only after source-backed content and editorial review workflows exist; they require governance, privacy, cost, quality, and exit-strategy decisions.
- Extract a service only when the modular-monolith boundary has a demonstrated operational need; do not preemptively distribute the system.

For all future work, use the project documentation and this handbook together: product documents define intended outcomes, ADRs define accepted structural decisions, and this file defines the practical contribution rules.
