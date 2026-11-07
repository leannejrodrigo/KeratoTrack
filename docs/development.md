# Development guide

This guide describes what exists **now**. It grows as each phase adds code.

## Requirements

| Tool | Version used | Needed for |
|---|---|---|
| Git | 2.54 | Version control and the safety hook |
| Python | 3.13 (any 3.10+ should work) | The repository guard and its tests (standard library only) |
| Node.js | 22.23 | The Companion (Vite needs 20.19+ or 22.12+) |
| npm | 10.9 | Companion dependencies |

The repository guard still needs nothing beyond the Python standard library.
The Companion and the research package have their own dependencies, listed in
[ADR 0009](decisions/0009-first-libraries.md).

## One-time setup after cloning

```sh
git config core.hooksPath .githooks
```

This tells Git to run the hooks in `.githooks/` (stored in the repository)
instead of `.git/hooks/` (which is never shared). Without it, the safety check
below does not run.

For research work later, copy `.env.example` to `.env` and set
`KERATOTRACK_DATA_DIR` to a folder **outside** the repository, for example
`C:\dev\KeratoTrack-data`. `.env` is ignored by Git.

## The staged-file guard

`scripts/repo_guard.py` runs automatically before every commit
(`.githooks/pre-commit`). It reads the **staged** version of each file and
blocks the commit if it finds:

| Rule | Blocked | Allowed exceptions |
|---|---|---|
| Research data folder | Anything under `research/data/` | None |
| Data file | `.csv`, `.xlsx`, `.parquet`, `.npy`, `.pkl`, `.dcm`, `.nii(.gz)`, database files and similar | Inside a `fixtures/synthetic/` folder (synthetic test data only) |
| Image file | `.png`, `.jpg`, `.tif` and similar | `docs/images/`, `companion/public/`, `fixtures/synthetic/`. SVG is always allowed |
| Large file | Over 1 MB | `package-lock.json` |
| Environment file | `.env`, `.env.*` | `.env.example` |
| Possible secret | Private keys, AWS, GitHub, Slack, Google and `sk-` style keys, and `password = '...'`-style assignments | A reviewed false positive of the *generic* assignment rule can carry `repo-guard: allow` on the same line. Specific key formats cannot be allowed |
| Notebook outputs | `.ipynb` files with any cell outputs | None. Clear outputs first |

Run it by hand at any time:

```sh
python scripts/repo_guard.py --staged   # files staged for the next commit
python scripts/repo_guard.py --all      # every tracked file
```

**Limitations.** The guard is a safety net, not a guarantee:

- Pattern-based secret detection misses secrets in unusual formats.
- `git commit --no-verify` skips hooks, and each clone must enable them.
- It cannot judge whether a text file contains identifying information.

Always review `git diff --staged` before committing. A dedicated secret
scanner (gitleaks) and notebook stripper (nbstripout) may be added later, after
their installation is approved.

## Patient Companion

```sh
cd companion
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest: unit, repository contract and integration tests
npm run typecheck    # TypeScript strict mode
npm run build
```

Design tokens live in `design-tokens/tokens.json` at the repository root. After
editing them, run `npm run tokens` in `companion/`. A test fails if the
generated `tokens.css` is out of date, and another checks every contrast pair
listed in the tokens file.

## Research

Use a virtual environment so the research dependencies stay separate from your
system Python:

```sh
cd research
python -m venv .venv
.venv\Scripts\activate      # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -e ".[test]"
python -m pytest
```

`KERATOTRACK_DATA_DIR` must be set (in `.env` or the environment) for any
command that writes data. See [research/README.md](../research/README.md).

## Running the tests

```sh
python -m unittest discover -s scripts/tests -v     # repository guard
cd companion && npm test                              # Companion
cd research && python -m pytest                       # Research
```

The tests create temporary Git repositories, stage **dummy** files and check
that the guard blocks or allows them. Fake secrets are assembled at runtime, so
no real or realistic secret appears anywhere in the repository.

## Line endings

`.gitattributes` keeps text files normalised and forces LF line endings for
the hook script, which would otherwise break on Windows checkouts.

## If something sensitive is committed

Follow rule 7 in [safety-boundaries.md](safety-boundaries.md). Deleting a file
in a later commit does not remove it from history, and anything pushed must be
treated as exposed.
