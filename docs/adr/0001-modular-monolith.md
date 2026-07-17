# ADR 0001: Use a modular monolith

- Status: Accepted
- Date: 2026-07-17

## Context

Podgorica Daily needs independently maintainable capabilities while its early operational footprint remains small. The project architecture requires presentation, application, domain, and infrastructure dependencies to point inward, and prohibits modules from accessing each other's persistence implementations.

## Decision

Use a modular monolith. Each future capability owns its code under `src/modules/<module-name>` and exposes only deliberate contracts. Shared code is limited to cross-cutting presentation and infrastructure concerns under `src/shared`.

## Consequences

- Deployment and operations stay simple during early delivery.
- Module boundaries remain explicit and testable before extraction is ever needed.
- Cross-module changes require contract design rather than direct imports or table access.
- A future service extraction has a defined ownership boundary, but is not assumed prematurely.
