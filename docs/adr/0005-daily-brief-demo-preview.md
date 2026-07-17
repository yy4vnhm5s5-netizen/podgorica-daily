# ADR 0005: Use a clearly labelled mock provider for the Daily Brief preview

- Status: Accepted
- Date: 2026-07-17

## Context

The Daily Brief needs a production-shaped user interface for internal design and integration validation before verified city sources, editorial governance, or an AI service are approved. Presenting mocked copy as a real AI summary would violate the product's trust and provenance principles.

## Decision

Create the `daily-brief` module behind a `dailyBrief` feature flag. Its domain defines a provider contract; the infrastructure layer supplies a mock provider that returns a typed demo-content key only. The presentation layer resolves that key to locale-specific copy and labels every visible state as `Demo`. It states that the production version will summarize verified city data from configured sources. No external API, AI SDK, source ingestion, persistence, or summarization logic is introduced. The disabled refresh control is a deliberate, labelled preview affordance and does not claim that refresh is available.

## Consequences

- The visual hierarchy and state handling can be evaluated without fabricating live data or AI output.
- A future source-backed provider can replace the mock at the module infrastructure boundary after governance, source, privacy, cost, quality, and editorial decisions are accepted.
- The demo must stay visibly distinct from production content and be removed or converted before any public production AI claim.
