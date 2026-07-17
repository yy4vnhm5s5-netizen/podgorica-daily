# ADR 0012: Validate and diagnose normalized Event quality before caching

- Status: Accepted
- Date: 2026-07-17

## Decision

Normalized events pass through deterministic quality validation before deduplication and cache writes. Reports are `accepted`, `acceptedWithWarnings`, or `rejected`, use typed rule codes, and contain an explainable 0–100 score. Missing optional content warns; identity, provenance, city, timezone, date validity, chronology, and configured age/horizon failures reject. No content is rewritten, invented, or AI-classified.

Policy is configured through `EVENT_QUALITY_MAX_PAST_DAYS=30`, `EVENT_QUALITY_MAX_FUTURE_DAYS=366`, `EVENT_QUALITY_MIN_SCORE=50`, three optional-field warning booleans (all `true`), `EVENT_QUALITY_COUNT_DROP_RATIO=0.5`, `EVENT_QUALITY_DEGRADED_WARNING_RATE=0.4`, and `EVENT_QUALITY_FAILING_REJECTION_RATE=0.5`. All values validate at startup.

The cache records policy version, counts, code aggregates, score buckets, count-drop diagnostics, and prior event count. A zero valid result retains a previous valid cache; a drop below the configured ratio is diagnosed. The application exposes accepted events only, plus non-public provider status diagnostics. Availability (`fresh`, `stale`, `unavailable`, `disabled`) remains separate from quality health: disabled wins, then unavailable, failing refresh/zero-result/rejection threshold, degraded stale/count-drop/warning threshold, otherwise healthy. V1 snapshots without diagnostics and v2/current partial snapshots remain readable with safe defaults. No visitor request fetches a provider.
