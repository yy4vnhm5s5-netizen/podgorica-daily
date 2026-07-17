# ADR 0002: Use typed shared UI primitives

- Status: Accepted
- Date: 2026-07-17

## Context

The UI specification requires responsive, accessible loading, empty, error, and content states. Feature modules must compose shared primitives without embedding domain logic in the shared layer.

## Decision

Build the design system from typed React components under `src/shared/components`. Use shadcn-compatible primitives for foundational controls and expose generic composition APIs for cards, section headings, status, feedback, refresh actions, and timestamps. Components support light and dark color schemes through Tailwind classes and are colocated so future Storybook stories can live beside their component.

## Consequences

- Visual and accessibility standards are reusable without coupling to any future module.
- Storybook can be introduced without relocating component code or changing public APIs.
- Product-specific copy, data contracts, and workflows remain module-owned.
- Shared components require careful API review to avoid becoming a generic business layer.
