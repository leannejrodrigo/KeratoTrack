# ADR 0005: Research reports as static files before an interactive interface

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The first research work is a literature review and a scripted dataset audit.
An interactive web interface built before real data or experiments exist would
be designed around guesses.

## Decision

Research tooling starts as Python scripts that produce static HTML and
Markdown reports with provenance footers. The interactive Research Laboratory
interface is deferred until there is real content worth exploring.

## Consequences

- Research value arrives earlier, with less code.
- All research architecture boundaries (data outside the repository, split
  manifest, guarded evaluation, access log) are still built from the start.
- Reports use the shared design tokens, so a later interface stays consistent.
