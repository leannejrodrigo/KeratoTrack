"""Locating the research data folder (ADR 0004).

Datasets, patient-to-split assignments and per-record predictions live
OUTSIDE the repository, in the folder named by KERATOTRACK_DATA_DIR. This
module is the only place that resolves that path, and it refuses a folder
inside the repository: a data folder inside the repo can be committed by
accident (``git add -f``) or swept up by tools that ignore .gitignore.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_VAR = "KERATOTRACK_DATA_DIR"

# research/src/keratotrack_research/config.py -> repository root is 3 levels up from src/.
REPO_ROOT = Path(__file__).resolve().parents[3]


class DataDirError(RuntimeError):
    pass


def _read_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env reader (KEY=VALUE lines). Avoids a python-dotenv dependency."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def data_dir(env: dict[str, str] | None = None, repo_root: Path = REPO_ROOT) -> Path:
    """Return the configured data folder, creating it if needed.

    Raises DataDirError if it is unset or resolves inside the repository.
    """
    env = dict(os.environ) if env is None else env
    raw = env.get(ENV_VAR) or _read_dotenv(repo_root / ".env").get(ENV_VAR, "")
    if not raw:
        raise DataDirError(
            f"{ENV_VAR} is not set. Copy .env.example to .env and set it to a folder "
            f"OUTSIDE the repository, for example C:\\dev\\KeratoTrack-data."
        )
    path = Path(raw).expanduser().resolve()
    root = repo_root.resolve()
    if path == root or root in path.parents:
        raise DataDirError(f"{ENV_VAR} points inside the repository ({path}). Research data must live outside it (ADR 0004).")
    path.mkdir(parents=True, exist_ok=True)
    return path
