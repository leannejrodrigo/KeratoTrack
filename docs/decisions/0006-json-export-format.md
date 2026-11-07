# ADR 0006: JSON as the complete export and import format

**Date:** 2026-11-07 · **Status:** Accepted (supersedes the earlier plan for CSV
export)

## Context

Browser storage is not a backup, so export is how users protect their records.
An export must preserve every field, including provenance, the synthetic flag
and the schema version, and must be importable again.

## Decision

JSON is the primary, complete export and import format. Imports are validated
against the schema, including the schema version, before anything is written.
CSV may be added later as an extra, export-only format for spreadsheets.

## Consequences

- Nested and optional fields are represented without loss.
- Import validation protects against corrupted or tampered files.
- Exported files leave the app's protection; the interface must say so.
