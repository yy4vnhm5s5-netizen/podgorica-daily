# Roadmap — Gradom.me Platform

This roadmap distinguishes what is owner-stated and prioritized today from what is inferred future direction with no committed scope. Nothing here is invented — items without an ADR or explicit owner statement are marked as such and should not be treated as approved work.

Horizons are relative (Short/Medium/Long term), not calendar-dated, since no explicit deadlines were provided.

## Short Term

**Technical**
- Verify, from real Railway production logs and the mounted volume, whether the Budva-specific CEDIS collector path (already implemented in code — see [CURRENT_STATUS.md](CURRENT_STATUS.md) Issue 1 for the verified implementation detail and current diagnostic status) is actually executing and writing correctly, then fix the root cause once evidence exists. *(Priority 1, owner-stated)*
- If the existing per-city CEDIS log line proves insufficient once inspected, extend it with a `collector` name field and fetched/parsed/rejected counts, per the gap recorded in [TECH_DEBT.md](TECH_DEBT.md) item 2. *(Priority 1, owner-stated goal; this specific logging enhancement is my inference of a likely next step, not an owner-specified task)*
- Fix the Cineplexx parser's `missing-date` rejection. *(Priority 2, owner-stated)*

**Product**
- None explicitly stated beyond the bug fixes above.

**Infrastructure**
- None explicitly stated beyond what's needed to diagnose Priority 1 — specifically, inspecting the Railway dashboard/logs and mounted volume contents for Budva-specific evidence. *(This inspection step is my inference of what "prove" requires, not a separately owner-specified task.)*

**Testing**
- Add fixture-based test coverage for the Budva-specific CEDIS collector path once the diagnostic logging exposes what's actually happening, so the fix is regression-proof.
- Add/confirm fixture coverage for the Cineplexx date-parsing path once the `missing-date` root cause is identified.

## Medium Term

**Technical**
- General responsive and visual polish, continued as an ongoing effort. *(Priority 3, owner-stated, no fixed scope)*

**Product**
- Homepage city cards evolving toward the same dashboard-card visual language as city summary cards, becoming compact per-city dashboards. *(Owner-stated future direction — explicitly unscoped: no design spec, ADR, or implementation plan exists yet. Do not begin implementation without first agreeing scope.)*

**Infrastructure**
- None explicitly stated.

**Testing**
- None explicitly stated beyond continuing to extend fixture coverage as modules evolve (per AGENTS.md §24's standing testing policy).

## Long Term

**Technical**
- A durable, shared storage adapter (e.g. Postgres or object storage) to replace the file-cache boundary, which is a documented prerequisite before running separate web/scheduler services or any horizontally-scaled/serverless deployment (docs/DEPLOYMENT_RAILWAY.md "Long-term Railway option"). *(Inferred from documented architecture constraints, not scheduled or ADR-approved.)*

**Product**
- Additional active cities beyond Podgorica and Budva. Bar and Nikšić exist only as inactive, capability-less registry planning entries — activating either requires approved source/provider coverage review per module (AGENTS.md §35), and is not scheduled. *(Inferred from registry structure, not scheduled.)*
- A supported water-notice provider for Budva, if one is identified and approved, would close the current capability gap. *(Not scheduled — no provider has been identified per owner correction.)*

**Infrastructure**
- Migration of scheduled refresh execution to a fully separate, durably-connected scheduler service, distinct from the current single-Railway-web-service-plus-cron-trigger model — this is the same long-term Railway option referenced above, contingent on the durable-storage prerequisite. *(Inferred from documentation, not scheduled.)*

**Testing**
- None explicitly stated.

## Out of Scope / Not Planned

Per AGENTS.md §34 ("Things Contributors Must Never Do"), the following remain explicitly out of scope until a separate, approved scope decision changes this:
- Maps, unified search, identity/authentication, editorial administration.
- Any new transport, event, or content source/collector beyond the currently approved list, without new approved scope.
- Persistence/database work, until data ownership, migration strategy, retention, backup/restoration, and access controls are defined (docs/DATABASE.md).

These are not "someday" roadmap items in the ordinary sense — they require an explicit scope/architecture decision (typically a new ADR) before any implementation work begins.
