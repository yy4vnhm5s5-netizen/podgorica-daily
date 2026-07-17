# API

## Principles

APIs expose stable domain contracts rather than provider payloads. Server boundaries own authentication, authorization, validation, rate limiting, and error translation.

## Contract conventions

- Version breaking changes and provide migration guidance.
- Validate all input and return deterministic, safe error codes.
- Use ISO 8601 timestamps with explicit offsets; apply Europe/Podgorica only as a display policy.
- Define pagination, filtering, and sorting semantics before exposing them.
- Return source, freshness, and attribution metadata for externally sourced content.

Errors distinguish invalid requests, authorization failures, absence, conflicts, rate limits, and upstream failures. Responses never reveal credentials, internal topology, or unfiltered provider errors. Contract changes require ownership, compatibility review, and fixtures.
