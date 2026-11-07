# ADR 0008: Dependency-free staged-file guard as a Git hook

**Date:** 2026-11-07 · **Status:** Accepted

## Context

The repository is public, so mistakes such as committing a dataset, a secret or
a notebook with data in its outputs must be caught before they enter history.
`.gitignore` only hides untracked files; it cannot block `git add -f` or check
file contents.

## Decision

A Git `pre-commit` hook (`.githooks/pre-commit`, enabled with
`git config core.hooksPath .githooks`) runs `scripts/repo_guard.py`, written
with the Python standard library only. It blocks commits that stage:

- anything under `research/data/`;
- data and database files outside approved synthetic-fixture folders;
- images outside approved folders;
- files larger than 1 MB;
- `.env` files other than `.env.example`;
- content matching common secret formats;
- Jupyter notebooks that still contain outputs.

It is tested with dummy fixtures only, never real secrets or health data.

## Alternatives considered

- **pre-commit framework with gitleaks and nbstripout:** mature, broader secret
  detection, but requires installing tools. Proposed as a later addition, on
  top of this guard, once its installation is approved.

## Consequences

- Works immediately with the existing Python installation.
- Pattern-based secret detection is narrower than a dedicated scanner. It is a
  safety net, not a guarantee, and staged changes must still be reviewed.
- Hooks are local: each clone must run the `core.hooksPath` command once, and
  `git commit --no-verify` bypasses the hook. A CI check could close that gap
  later.
