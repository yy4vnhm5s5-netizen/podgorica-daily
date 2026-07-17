# UI

## Standards

The product is mobile-first, semantic, keyboard-operable, and resilient to slow or unavailable data. The accessibility target is WCAG 2.2 AA.

## System boundaries

Shared primitives provide tokens, layout, typography, forms, feedback, navigation, and overlays. Feature modules compose these primitives; they do not fork styling systems or put domain logic in generic components.

## Required behaviour

Every asynchronous journey defines loading, empty, partial, stale, error, and success states. Error copy identifies the available user action and never implies stale data is current. Responsive design adapts navigation, density, touch targets, tables, maps, and filters rather than merely shrinking them. Source attribution and freshness appear near consequential information.
