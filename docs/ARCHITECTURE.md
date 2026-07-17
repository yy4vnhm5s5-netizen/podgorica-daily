# Architecture

## Direction

The application will be a modular monolith with explicit domain boundaries: simple to operate initially, but resistant to an unowned shared dependency graph.

## Layers

1. **Presentation** renders routes, components, feedback states, and accessibility behaviour.
2. **Application** coordinates use cases and authorization without provider-specific knowledge.
3. **Domain** owns concepts, rules, and interfaces.
4. **Infrastructure** implements provider adapters, persistence, queues, caches, and observability.

Dependencies point inward. Domain code depends on neither framework nor vendor SDKs. Modules communicate through typed contracts or events, never by direct access to another module's persistence implementation.

## Reliability

Integrations require timeouts, bounded retries, cache policy, rate limits, structured errors, and health signals. Server boundaries enforce authorization; startup validates configuration; privacy-safe structured logs carry correlation identifiers.
