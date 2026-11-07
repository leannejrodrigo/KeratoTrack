# ADR 0004: Research data outside the repository

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The repository is public. Research datasets may contain patient codes and are
governed by their own licences. A data folder inside the repository, even if
ignored by Git, can still be committed by mistake (for example with
`git add -f`) or picked up by tools that ignore `.gitignore`.

## Decision

Datasets, patient identifiers, patient-to-split assignments and per-record
predictions are stored outside the repository, in the folder named by the
`KERATOTRACK_DATA_DIR` environment variable (locally
`C:\dev\KeratoTrack-data\`). Only non-identifying metadata, such as dataset
versions, split versions and checksums, may be committed. `research/data/`
remains in `.gitignore` as a second safeguard.

## Consequences

- Code is identical on every machine; each machine sets its own path.
- Reproducing the research requires obtaining each dataset from its original
  source under its own licence.
- Split manifests can prove that a split has not changed (by checksum) without
  publishing patient codes.
