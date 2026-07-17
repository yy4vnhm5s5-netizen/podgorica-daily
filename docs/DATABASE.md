# Database

## Position

Sprint 0 selects no database. The eventual choice follows data ownership, query patterns, retention, backup objectives, privacy review, and operational capability—not framework preference.

## Ownership and controls

Each module owns its write model and migration history. Cross-module reads use contracts, read models, or events—not another module's tables. Raw provider payloads are retained only when licensing, debugging value, and retention policy justify them.

- Enforce schema validation and migration review.
- Store timestamps in UTC while preserving local timezone semantics for events.
- Encrypt transport and storage; use least-privilege production access.
- Define backups, restoration tests, retention, deletion, and incident ownership before storing production data.
- Make migrations forward-compatible, observable, and exercised against representative data.
