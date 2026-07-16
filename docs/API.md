# API

## Principles

Internal and public APIs expose stable, domain-oriented contracts rather than provider payloads. Server boundaries own authentication, authorization, validation, rate limiting, and error translation.

## Contract conventions

- Use versioned endpoints or versioned schema evolution for breaking changes.
- Validate all input at the boundary; return deterministic error codes and safe messages.
- Use ISO 8601 timestamps with explicit offsets; use `Europe/Podgorica` for local display policy.
- Support pagination, filtering, and sorting only when the data contract defines their semantics.
- Return source, freshness, and attribution metadata for externally sourced content where applicable.

## Errors and observability

Errors separate invalid requests, authorization failures, absence, conflicts, rate limits, and upstream failures. Responses never reveal credentials, internal topology, or unfiltered provider errors. Requests are traceable through a correlation identifier.

## Governance

An API contract change requires ownership, compatibility review, test fixtures, and consumer migration guidance. Public APIs require abuse prevention and an explicit retention policy for telemetry.
