# ADR 0002: React, TypeScript and Vite for the Companion

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The Companion is a mobile-first web application with forms, tables, charts and
accessibility requirements. The developer wants transferable skills.

## Decision

Use React for components, TypeScript in strict mode for types, and Vite as the
development server and build tool (template `react-ts`; Vite requires Node.js
20.19+ or 22.12+).

## Alternatives considered

- **Svelte:** less boilerplate, smaller ecosystem.
- **Plain TypeScript without a framework:** maximal understanding, but slow to
  build accessible, stateful interfaces.

## Consequences

- Large ecosystem and widely recognised skills.
- TypeScript types disappear at runtime, so imported data still needs runtime
  validation.
- The project relies on Node.js and npm for development only; the built app is
  static files.
