# Architecture

## Direction

The application will use a modular monolith with explicit domain boundaries. This keeps initial operations simple while preventing feature code from becoming a shared, unowned dependency graph.

## Layers

1. **Presentation** renders routes, components, loading states, and accessibility behaviour.
2. **Application** coordinates use cases and authorization without knowing provider-specific details.
3. **Domain** owns business concepts, validation rules, and interfaces.
4. **Infrastructure** implements provider adapters, persistence, queues, caches, and observability.

Dependencies point inward: presentation and infrastructure depend on application/domain contracts; domain code depends on neither framework nor vendor SDKs.

## Modules

Future modules include weather, transport, events, maps, search, identity, editorial administration, and AI summaries. Modules communicate through typed contracts or events, never through direct access to another module's persistence implementation.

## Reliability and security

External integrations require timeouts, bounded retries, structured errors, cache policy, rate limits, and health signals. Authentication and authorization are enforced on the server. Configuration is validated at process start. Logs use structured, privacy-safe fields and carry correlation identifiers.
