# ADR 0003: Charts drawn as React SVG, D3 for maths only

**Date:** 2026-11-07 · **Status:** Accepted (supersedes the earlier provisional
choice of Recharts)

## Context

Measurement charts must follow strict rules: transparent data-dependent axis
scaling, lines broken at device changes, no interpolation of missing values, no
thresholds, keyboard access to every point and visible provenance.

## Decision

React renders the SVG elements directly. D3 modules are used only for
calculations (scales and line shapes). The axis rule and device segmentation
are our own pure, unit-tested functions.

## Alternatives considered

- **Recharts or another high-level chart library:** quicker to start, but
  hides the markup and makes the rules and accessibility harder to control.
- **Observable Plot:** expressive, but generates its own SVG.

## Consequences

- Full control over accessibility and the safety rules.
- More code to write and test, which is also a learning benefit.
