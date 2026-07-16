# Database

## Position

No database is selected in Sprint 0. The choice follows approved data ownership, query patterns, retention requirements, backup objectives, privacy review, and operational capability—not framework preference.

## Data ownership

Each module owns its write model and migration history. Cross-module reads use application contracts, read models, or events; they do not couple to another module's tables. Provider raw payloads are retained only when licensing, debugging value, and retention policy justify them.

## Baseline controls

- Enforce schema validation and migration review.
- Store timestamps in UTC and preserve timezone semantics for local events.
- Encrypt transport and managed storage; restrict production access by least privilege.
- Define backups, restoration tests, retention, deletion, and incident ownership before storing production data.
- Audit privileged editorial actions without storing unnecessary personal data.

## Evolution

Migrations must be forward-compatible, observable, reversible where feasible, and exercised against representative production-sized data before release.
