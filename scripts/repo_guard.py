"""KeratoTrack repository guard.

Checks files that are about to be committed (or every tracked file, with
``--all``) and blocks anything that should never reach the public repository:

* research data and database files,
* images outside approved folders,
* very large files,
* ``.env`` files,
* content that looks like a secret (API keys, tokens, private keys),
* Jupyter notebooks that still contain outputs (outputs can contain data).

Why a custom script? It uses only the Python standard library, so it works
without installing anything (see docs/decisions/0008-repository-guard-hook.md).
It is a safety net, not a guarantee: always review staged changes yourself.

Important detail: the guard reads file contents from Git's *index* (the
staging area) with ``git show :<path>``, not from the working folder. That is
what will actually be committed, so editing a file after ``git add`` cannot
hide a problem.

Usage:
    python scripts/repo_guard.py --staged   # used by the pre-commit hook
    python scripts/repo_guard.py --all      # check every tracked file

Exit code 0 means no problems; 1 means at least one file was blocked.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import PurePosixPath

# --------------------------------------------------------------------------
# Configuration. Kept at the top so the rules are easy to read and review.
# --------------------------------------------------------------------------

MAX_FILE_BYTES = 1_000_000  # 1 MB

# Large files that are expected and safe (generated lockfiles).
SIZE_EXEMPT_NAMES = {"package-lock.json"}

# File types that usually hold datasets or database contents.
DATA_EXTENSIONS = {
    ".csv", ".tsv", ".xls", ".xlsx", ".parquet", ".feather", ".h5", ".hdf5",
    ".npy", ".npz", ".pkl", ".pickle", ".joblib", ".mat", ".sav",
    ".dcm", ".nii", ".db", ".sqlite", ".sqlite3",
}

# Raster image types. SVG is not listed: it is text (icons, diagrams).
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif", ".webp"}

# Folders where images are expected (documentation and app assets).
IMAGE_ALLOWED_PREFIXES = ("docs/images/", "companion/public/")

# A line containing this marker is skipped by the *generic* secret check.
# Use it only for reviewed false positives, never to hide a real secret.
ALLOW_MARKER = "repo-guard: allow"

# Secret patterns. Each is specific enough to have few false positives.
SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("AWS access key ID", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("API secret key (sk-...)", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_\-]{20,}")),
]

# Generic "password = '...'"-style assignments. More false positives, so this
# one respects ALLOW_MARKER.
GENERIC_SECRET = re.compile(
    r"(?i)\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"
)


# --------------------------------------------------------------------------
# Data structures
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Problem:
    """One reason a file is blocked."""

    path: str
    rule: str
    detail: str


# --------------------------------------------------------------------------
# Git helpers. All paths from Git use forward slashes, on Windows too.
# --------------------------------------------------------------------------

def _git(*args: str) -> bytes:
    """Run a git command in the current folder and return its raw output."""
    return subprocess.run(["git", *args], check=True, capture_output=True).stdout


def staged_paths() -> list[str]:
    """Files added, copied, modified or renamed in the staging area.

    ``-z`` separates names with NUL bytes so unusual file names are safe.
    Deleted files (status D) are excluded: removing a file is never a leak.
    """
    out = _git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    return [p for p in out.decode("utf-8").split("\0") if p]


def tracked_paths() -> list[str]:
    """Every file currently in the index."""
    out = _git("ls-files", "-z")
    return [p for p in out.decode("utf-8").split("\0") if p]


def staged_blob(path: str) -> bytes:
    """Contents of ``path`` as stored in the index (what will be committed)."""
    return _git("show", f":{path}")


# --------------------------------------------------------------------------
# Rules. Each takes a path (and sometimes its contents) and returns problems.
# --------------------------------------------------------------------------

def _suffix(path: str) -> str:
    """Lower-case file extension, treating ``.nii.gz`` as ``.nii``."""
    p = PurePosixPath(path.lower())
    if p.suffix == ".gz" and PurePosixPath(p.stem).suffix:
        return PurePosixPath(p.stem).suffix
    return p.suffix


def in_synthetic_fixtures(path: str) -> bool:
    """True if the path contains a ``fixtures/synthetic/`` folder pair.

    This is the only place data-like files may be committed, and only
    synthetic ones (for automated tests).
    """
    parts = PurePosixPath(path).parts
    return any(a == "fixtures" and b == "synthetic" for a, b in zip(parts, parts[1:]))


def check_path(path: str) -> list[Problem]:
    """Rules that only need the file name and location."""
    problems: list[Problem] = []
    name = PurePosixPath(path).name
    ext = _suffix(path)

    if path.startswith("research/data/"):
        problems.append(Problem(path, "research data folder",
                                "Research data lives outside the repository (KERATOTRACK_DATA_DIR)."))

    if (name == ".env" or name.startswith(".env.")) and name != ".env.example":
        problems.append(Problem(path, "environment file",
                                "Only .env.example (names, no values) may be committed."))

    if ext in DATA_EXTENSIONS and not in_synthetic_fixtures(path):
        problems.append(Problem(path, "data file",
                                f"'{ext}' files may only be committed under a fixtures/synthetic/ folder."))

    if ext in IMAGE_EXTENSIONS and not (
        path.startswith(IMAGE_ALLOWED_PREFIXES) or in_synthetic_fixtures(path)
    ):
        problems.append(Problem(path, "image file",
                                "Images are allowed only in docs/images/, companion/public/ "
                                "or a fixtures/synthetic/ folder."))
    return problems


def check_size(path: str, size: int) -> list[Problem]:
    if size > MAX_FILE_BYTES and PurePosixPath(path).name not in SIZE_EXEMPT_NAMES:
        return [Problem(path, "large file",
                        f"{size:,} bytes exceeds the {MAX_FILE_BYTES:,}-byte limit.")]
    return []


def is_binary(data: bytes) -> bool:
    """Heuristic used by Git itself: a NUL byte near the start means binary."""
    return b"\0" in data[:8000]


def check_secrets(path: str, text: str) -> list[Problem]:
    problems: list[Problem] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(line):
                problems.append(Problem(path, "possible secret", f"line {lineno}: looks like a {label}."))
        if GENERIC_SECRET.search(line) and ALLOW_MARKER not in line:
            problems.append(Problem(path, "possible secret",
                                    f"line {lineno}: looks like a hard-coded credential."))
    return problems


def check_notebook(path: str, text: str) -> list[Problem]:
    """Block notebooks whose cells still contain outputs or execution counts."""
    try:
        nb = json.loads(text)
    except json.JSONDecodeError:
        return [Problem(path, "notebook", "Could not be parsed as JSON.")]
    for index, cell in enumerate(nb.get("cells", [])):
        if cell.get("outputs") or cell.get("execution_count") is not None:
            return [Problem(path, "notebook outputs",
                            f"cell {index} has outputs. Clear all outputs before committing.")]
    return []


def check_file(path: str, data: bytes) -> list[Problem]:
    """Run every rule on one file."""
    problems = check_path(path) + check_size(path, len(data))
    if is_binary(data):
        return problems
    text = data.decode("utf-8", errors="replace")
    problems += check_secrets(path, text)
    if _suffix(path) == ".ipynb":
        problems += check_notebook(path, text)
    return problems


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--staged", action="store_true", help="check files staged for commit")
    mode.add_argument("--all", action="store_true", help="check every tracked file")
    args = parser.parse_args(argv)

    paths = staged_paths() if args.staged else tracked_paths()
    problems: list[Problem] = []
    for path in paths:
        problems += check_file(path, staged_blob(path))

    if not problems:
        print(f"repo-guard: OK ({len(paths)} file(s) checked)")
        return 0

    print("repo-guard: commit blocked. These files must not be committed:\n", file=sys.stderr)
    for p in problems:
        print(f"  {p.path}\n    [{p.rule}] {p.detail}", file=sys.stderr)
    print("\nUnstage a file with:  git restore --staged <path>", file=sys.stderr)
    print("(Before the repository's first commit, use:  git rm --cached <path>)", file=sys.stderr)
    print("See docs/development.md for the rules and how to handle false positives.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
