# Podgorica Daily

Podgorica Daily is a production-oriented local information platform for Podgorica. It currently provides server-rendered current weather plus explicitly labelled internal Daily Overview and City Alerts demos; transport, events, maps, search, and editorial workflows are not yet implemented.

Daily Overview is a zero-cost deterministic summary generated from normalized cached city data. It does not use generative services, language models, or visitor-triggered data collection.

The default language is Montenegrin Latin, ijekavian (`/me`). English is available at `/en`; the root route redirects to `/me`.

## Architecture

The project is a modular monolith. Presentation, application, domain, and infrastructure concerns remain separated, and future features own their code beneath `src/modules`. Shared components and utilities are deliberately restricted to cross-cutting concerns.

The project specifications in [`docs/`](docs/) are the source of truth for product scope, architecture, data, UI, API, and source-ingestion decisions.

## Development

Use Node.js 22 or newer.

```bash
pnpm install
pnpm run dev
```

Run the quality suite before opening a pull request:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
```

## Container runtime

Build and run the production image locally:

```bash
docker compose up --build
```

The service listens on `http://localhost:3000`.
