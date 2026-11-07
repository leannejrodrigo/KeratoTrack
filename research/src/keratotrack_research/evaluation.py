"""Guarded final evaluation and the chained access log (design-spec 6.3).

The test set answers one question, once the methods are fixed: how does the
chosen model perform on patients it has never influenced? Every look at the
test set that feeds back into a decision makes that answer optimistic. So
test access is made DELIBERATE, RECORDED and VISIBLE:

  guarded_evaluate() refuses unless
    1. the research protocol is marked final,
    2. the Git working tree is clean (results trace to an exact commit),
    3. dataset, assignment and manifest checksums match,
    4. every previous log entry is committed and the hash chain is intact.
  It then appends an "intent" entry BEFORE loading test data, runs the
  evaluation, and appends a "completed" entry with the result's checksum.
  A crash between the two leaves a visible intent without completion.

THE HASH CHAIN. Each entry stores the SHA-256 of the previous entry's
canonical JSON. Editing or deleting an earlier entry changes its hash, so
the next entry's `prev_entry_sha256` no longer matches: tampering becomes
DETECTABLE. It is not PREVENTABLE: someone could rewrite the whole chain,
or Git history. Timestamps are self-reported, and ad-hoc code can bypass
the loader. The log supports honest reporting; it cannot replace it.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pandas as pd

from .hashing import canonical_json, sha256_bytes, sha256_file, sha256_json
from .splits import git_commit, load_verified

GENESIS = "0" * 64
FINAL_STATUS_MARKER = "**Status:** final"


class EvaluationRefused(RuntimeError):
    pass


def entry_hash(entry: dict) -> str:
    return sha256_bytes(canonical_json(entry))


def read_log(log_path: Path) -> list[dict]:
    if not log_path.exists():
        return []
    return [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]


def verify_chain(entries: list[dict]) -> list[str]:
    """Return a list of problems; empty means the chain is intact."""
    problems = []
    prev = GENESIS
    for i, e in enumerate(entries):
        if e.get("prev_entry_sha256") != prev:
            problems.append(f"entry {i + 1}: previous-entry checksum does not match (an earlier entry was edited, removed or reordered)")
        prev = entry_hash(e)
    numbers = [e["evaluation_number"] for e in entries if e.get("status") == "intent"]
    if numbers != list(range(1, len(numbers) + 1)):
        problems.append("evaluation numbers are not sequential from 1")
    return problems


def append_entry(log_path: Path, entry: dict) -> dict:
    entries = read_log(log_path)
    full = {**entry, "prev_entry_sha256": entry_hash(entries[-1]) if entries else GENESIS}
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(full, sort_keys=True, ensure_ascii=False) + "\n")
    return full


@dataclass
class Preconditions:
    """Each check returns None if satisfied, or a reason to refuse.

    Injected so tests can exercise every refusal path without real Git state.
    """

    repo_root: Path
    protocol_path: Path

    def protocol_final(self) -> str | None:
        text = self.protocol_path.read_text(encoding="utf-8") if self.protocol_path.exists() else ""
        return None if FINAL_STATUS_MARKER in text else f"The research protocol is not marked final ({self.protocol_path.name} must contain '{FINAL_STATUS_MARKER}')."

    def tree_clean(self) -> str | None:
        r = subprocess.run(["git", "status", "--porcelain"], cwd=self.repo_root, capture_output=True, text=True)
        if r.returncode != 0:
            return "Could not read Git status."
        return None if not r.stdout.strip() else "The working tree has uncommitted changes. Commit or stash them so results trace to an exact commit."

    def log_committed(self, log_path: Path) -> str | None:
        if not log_path.exists():
            return None
        r = subprocess.run(["git", "status", "--porcelain", "--", str(log_path)], cwd=self.repo_root, capture_output=True, text=True)
        return None if r.returncode == 0 and not r.stdout.strip() else "The evaluation log has uncommitted entries. Commit them first."


def guarded_evaluate(
    *,
    manifest_path: Path,
    dataset_path: Path,
    data_dir: Path,
    log_path: Path,
    config: dict[str, Any],
    model_path: Path,
    purpose: str,
    run_id: str,
    evaluate: Callable[[pd.DataFrame], dict[str, Any]],
    pre: Preconditions,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
) -> dict[str, Any]:
    if not purpose.strip():
        raise EvaluationRefused("A purpose is required for every test-set access.")
    reasons = [r for r in (pre.protocol_final(), pre.tree_clean(), pre.log_committed(log_path)) if r]
    entries = read_log(log_path)
    reasons += verify_chain(entries)
    if entries and entries[-1].get("status") == "intent":
        reasons.append(f"Evaluation {entries[-1]['evaluation_number']} has an intent entry but no completion. Investigate and record it before continuing.")
    if reasons:
        raise EvaluationRefused("Test-set evaluation refused:\n- " + "\n- ".join(reasons))

    manifest_sha = sha256_file(manifest_path)
    number = 1 + sum(1 for e in entries if e.get("status") == "intent")
    common = {
        "evaluation_number": number,
        "commit": git_commit(pre.repo_root),
        "protocol_sha256": sha256_file(pre.protocol_path),
        "manifest_sha256": manifest_sha,
        "run_id": run_id,
        "config_sha256": sha256_json(config),
        "model_sha256": sha256_file(model_path),
        "purpose": purpose,
    }
    # Written BEFORE the test data is loaded.
    append_entry(log_path, {**common, "status": "intent", "utc": now().isoformat(timespec="seconds")})

    _, df = load_verified(manifest_path, dataset_path, data_dir, _include_test=True)
    result = evaluate(df[df["split"] == "test"].reset_index(drop=True))

    append_entry(log_path, {**common, "status": "completed", "utc": now().isoformat(timespec="seconds"), "result_sha256": sha256_json(result)})
    return result
