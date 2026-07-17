# UI

## Standards

The interface is mobile-first, semantic, keyboard-operable, and resilient to slow or unavailable data. The accessibility target is WCAG 2.2 AA.

## Theme

The public interface is currently light-only. Do not add a user-facing theme control or dark-theme-specific presentation until a complete dark theme is approved and designed.

## System boundaries

Shared UI primitives provide tokens, layout, typography, forms, feedback, navigation, and overlays. Feature modules compose these primitives; they do not fork styling systems or embed domain logic in generic components.

## Required states

Every asynchronous journey defines loading, empty, partial, stale, error, and success states. Error copy identifies the user action available and never implies data is current when it is not.

## Responsive behaviour

Content adapts rather than merely shrinks: navigation, density, touch targets, tables, maps, and filters must have deliberate narrow-screen behaviour. Performance budgets protect initial render; expensive visualizations and map SDKs are loaded only when needed.

## Content integrity

Show source attribution and freshness near consequential information. Use plain language, support local date/time formats, and never rely on colour alone to communicate status.
