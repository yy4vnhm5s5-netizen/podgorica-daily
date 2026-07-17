# Shared components

Components in this directory are reusable presentation primitives. They must be typed, keyboard-accessible where interactive, responsive, and independent of module data or workflows.

When Storybook is introduced, place a `*.stories.tsx` file beside the component it documents. Stories must use static props and must not call module APIs, external providers, or production services.
