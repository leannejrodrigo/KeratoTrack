# ADR 0009: First libraries for the Companion and the research package

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The README requires each library to be confirmed, with its reason recorded,
when it is first installed. Phases C1–C4 and the research integrity
infrastructure installed the first ones. All are free and open source.

## Decision

### Companion runtime (`companion/package.json` dependencies)

| Library | Why |
|---|---|
| `react`, `react-dom` | ADR 0002 |
| `d3-scale`, `d3-shape` | ADR 0003: scales, line paths and marker symbols only. Not the whole `d3` bundle, and nothing that touches the DOM |
| `idb` | A thin Promise wrapper over IndexedDB (about 1 KB). It adds no storage logic, so the code maps directly onto the IndexedDB API. Dexie (named in the design spec) was not chosen because its own query layer and change tracking are not needed yet and would hide the API being learned |
| `zod` | Runtime validation. TypeScript types vanish at runtime (ADR 0002), so imported files and stored records are parsed against a schema that also produces the TypeScript type |
| `@fontsource-variable/inter`, `@fontsource/jetbrains-mono` | Self-hosted fonts (design-spec 3), installed as packages so versions are pinned. SIL OFL 1.1; see [licensing.md](../licensing.md) |

### Companion development only (devDependencies)

| Library | Why |
|---|---|
| `vite`, `@vitejs/plugin-react`, `typescript` | ADR 0002 |
| `vitest` | Test runner that shares Vite's configuration |
| `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | Component tests that find elements by role and label, the way assistive technology does |
| `fake-indexeddb` | A complete in-memory IndexedDB for Node, so the same contract tests run against the real IndexedDB code path |
| `@types/*` | Type definitions only |

### Research (`research/pyproject.toml`)

`numpy`, `pandas`, `scikit-learn` (as planned in the README), and `pytest`
for tests. No other dependencies: `.env` reading, hashing and reports use the
standard library. PyTorch is deferred until image models begin.

## Consequences

- Playwright and `@axe-core/playwright` are still planned for C8 and are not
  installed yet.
- New libraries are added by extending this ADR or writing a new one.
