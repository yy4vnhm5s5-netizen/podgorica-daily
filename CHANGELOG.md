# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-foundation] - 2026-07-17

### Added

- Next.js 15, React 19, TypeScript, App Router, and `src/` project foundation.
- Strict TypeScript, absolute imports, environment validation, ESLint, Prettier, Husky, and lint-staged quality tooling.
- Docker standalone runtime, Docker Compose configuration, and GitHub Actions quality pipeline.
- Typed shared UI primitives, responsive application shell, light/dark theme support, accessible navigation, and static dashboard placeholders.
- Shared feature-flag configuration and Europe/Podgorica date/time formatting service.
- Project specifications, AI engineering handbook, contribution templates, and accepted ADRs for the modular monolith and shared UI primitives.

### Security

- Validated runtime environment configuration through Zod.
- Non-root container runtime and a minimal CI permission set.

### Notes

- This is a foundation release. It intentionally contains no live weather, transport, events, maps, search, authentication, administration, scraping, persistence, or AI functionality.
- The planned MIT license file is not yet present; add it with the confirmed copyright holder before publishing this repository as open source.
