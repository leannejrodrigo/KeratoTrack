"""Patient-level train/validation/test splits with a committed manifest.

WHY PATIENT-LEVEL. A patient's two eyes are correlated, and repeat exams of
one eye are near copies. If any of a patient's rows are in training and
others in test, the model can score well by recognising familiar anatomy,
and the test estimate is inflated for new patients. So the unit that is
assigned to a split is the PATIENT, never a row or an eye.

HOW. scikit-learn's StratifiedGroupKFold(n_splits=k) partitions the groups
(patients) into k folds so that no group crosses folds, while trying to keep
the label ratio similar in each fold. We use it twice:
  1. k = round(1 / test_fraction) folds; take one fold as TEST.
  2. On the remainder, k = round(1 / val_fraction_of_rest); one fold as VAL.
Stratification is BEST-EFFORT (groups are indivisible, so exact ratios are
not always achievable), which is why the achieved label balance is computed
and written into the manifest instead of assumed.

The stratification label is per patient: 1 if any of the patient's eyes is
labelled 1. A per-row label cannot be used because one patient can have
rows with different labels.

FREEZING. The patient -> split assignment file contains patient codes, so it
is written to the data folder OUTSIDE the repository. The manifest, which is
committed, records only non-identifying facts: dataset checksum, method,
parameters, seed, code commit, counts, label balance and the assignment
file's checksum. Every later run verifies these and refuses on mismatch.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

from .audit import normalise_id
from .hashing import sha256_file

SPLITS = ("train", "val", "test")
MANIFEST_FORMAT = "keratotrack-split-manifest"
MANIFEST_VERSION = 1


class LeakageError(AssertionError):
    pass


class ManifestMismatch(RuntimeError):
    pass


@dataclass(frozen=True)
class SplitParams:
    test_fraction: float = 0.2
    val_fraction: float = 0.2  # of the whole dataset
    seed: int = 20261107


def patient_labels(df: pd.DataFrame) -> pd.Series:
    """One label per (normalised) patient: 1 if any eye is labelled 1."""
    return df.groupby(df["patient_id"].map(normalise_id))["label"].max().astype(int)


def _take_one_fold(groups: np.ndarray, y: np.ndarray, n_folds: int, seed: int) -> np.ndarray:
    """Boolean mask over `groups` selecting one stratified, group-disjoint fold."""
    sgkf = StratifiedGroupKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    # Each patient appears once here, so groups are trivially unique; we still
    # pass them so the API's guarantee is the thing we rely on.
    _, fold_idx = next(sgkf.split(np.zeros(len(groups)), y, groups))
    mask = np.zeros(len(groups), dtype=bool)
    mask[fold_idx] = True
    return mask


def make_assignment(df: pd.DataFrame, params: SplitParams = SplitParams()) -> pd.DataFrame:
    """Return a DataFrame [patient_key, split], one row per patient."""
    if not 0 < params.test_fraction < 0.5 or not 0 < params.val_fraction < 0.5:
        raise ValueError("test_fraction and val_fraction must be in (0, 0.5)")
    labels = patient_labels(df)
    patients = labels.index.to_numpy()
    y = labels.to_numpy()

    test_mask = _take_one_fold(patients, y, max(2, round(1 / params.test_fraction)), params.seed)
    rest = ~test_mask
    val_share_of_rest = params.val_fraction / (1 - params.test_fraction)
    val_mask_rest = _take_one_fold(patients[rest], y[rest], max(2, round(1 / val_share_of_rest)), params.seed + 1)

    split = np.full(len(patients), "train", dtype=object)
    split[test_mask] = "test"
    split[np.flatnonzero(rest)[val_mask_rest]] = "val"
    return pd.DataFrame({"patient_key": patients, "split": split}).sort_values("patient_key", ignore_index=True)


def attach_split(df: pd.DataFrame, assignment: pd.DataFrame) -> pd.DataFrame:
    key = df["patient_id"].map(normalise_id)
    mapping = dict(zip(assignment["patient_key"], assignment["split"]))
    missing = sorted(set(key) - set(mapping))
    if missing:
        raise ManifestMismatch(f"{len(missing)} patients in the data have no split assignment (e.g. {missing[:3]}).")
    return df.assign(split=key.map(mapping))


def assert_no_leakage(df_with_split: pd.DataFrame) -> None:
    """Fail if any patient (after ID normalisation) appears in more than one split."""
    key = df_with_split["patient_id"].map(normalise_id)
    n_splits = df_with_split.groupby(key)["split"].nunique()
    leaked = n_splits[n_splits > 1]
    if len(leaked):
        raise LeakageError(f"{len(leaked)} patients appear in more than one split, e.g. {list(leaked.index[:3])}")


def split_summary(df_with_split: pd.DataFrame) -> dict:
    """Counts and achieved label balance per split (computed, never assumed)."""
    key = df_with_split["patient_id"].map(normalise_id)
    out = {}
    for s in SPLITS:
        part = df_with_split[df_with_split["split"] == s]
        pk = key[part.index]
        plabels = part.groupby(pk)["label"].max()
        out[s] = {
            "patients": int(pk.nunique()),
            "rows": int(len(part)),
            "patient_label1_fraction": round(float(plabels.mean()), 4) if len(plabels) else None,
            "row_label1_fraction": round(float(part["label"].mean()), 4) if len(part) else None,
        }
    return out


def git_commit(repo_root: Path) -> str:
    """HEAD commit, suffixed "-dirty" if the working tree has uncommitted changes.

    Without the suffix, a result produced from uncommitted code would claim a
    commit that does not contain the code that produced it.
    """
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo_root, capture_output=True, text=True, check=True).stdout.strip()
        status = subprocess.run(["git", "status", "--porcelain"], cwd=repo_root, capture_output=True, text=True, check=True).stdout
        return f"{head}-dirty" if status.strip() else head
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def freeze_split(
    dataset_path: Path,
    dataset_id: str,
    synthetic: bool,
    data_dir: Path,
    manifest_path: Path,
    params: SplitParams = SplitParams(),
    repo_root: Path | None = None,
    now: datetime | None = None,
) -> dict:
    """Create the assignment (outside the repo) and the manifest (committable)."""
    if manifest_path.exists():
        raise FileExistsError(f"{manifest_path} already exists. A frozen split is never overwritten; create a new split version instead.")
    df = pd.read_csv(dataset_path)
    assignment = make_assignment(df, params)
    with_split = attach_split(df, assignment)
    assert_no_leakage(with_split)

    split_id = f"{dataset_id}__split-s{params.seed}"
    assignment_path = data_dir / "splits" / f"{split_id}.assignment.csv"
    assignment_path.parent.mkdir(parents=True, exist_ok=True)
    assignment.to_csv(assignment_path, index=False, lineterminator="\n")

    manifest = {
        "format": MANIFEST_FORMAT,
        "format_version": MANIFEST_VERSION,
        "split_id": split_id,
        "synthetic": synthetic,
        "dataset": {"id": dataset_id, "sha256": sha256_file(dataset_path), "rows": int(len(df))},
        "method": {
            "name": "two-stage StratifiedGroupKFold, one fold taken per stage",
            "group": "patient_id (trimmed, case-folded)",
            "stratify_on": "patient label = max over the patient's rows",
            "test_fraction": params.test_fraction,
            "val_fraction": params.val_fraction,
            "seed": params.seed,
        },
        "assignment": {"filename": assignment_path.name, "sha256": sha256_file(assignment_path)},
        "counts": split_summary(with_split),
        "code_commit": git_commit(repo_root) if repo_root else "unknown",
        "created_utc": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def load_verified(manifest_path: Path, dataset_path: Path, data_dir: Path, *, _include_test: bool = False) -> tuple[dict, pd.DataFrame]:
    """Load TRAIN and VAL rows with their split, refusing if anything differs from the manifest.

    Test rows are dropped here. The only intended route to them is
    evaluation.guarded_evaluate, which passes _include_test=True after its
    preconditions pass and its "intent" log entry is written. Python cannot
    make this private for real; the underscore is a convention, and the
    access log plus honest reporting are what make it meaningful.
    """
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("format") != MANIFEST_FORMAT:
        raise ManifestMismatch("Not a KeratoTrack split manifest.")
    if sha256_file(dataset_path) != manifest["dataset"]["sha256"]:
        raise ManifestMismatch("Dataset checksum does not match the manifest. The data has changed since the split was frozen.")
    assignment_path = data_dir / "splits" / manifest["assignment"]["filename"]
    if not assignment_path.is_file():
        raise ManifestMismatch(f"Assignment file not found in the data folder: {assignment_path.name}")
    if sha256_file(assignment_path) != manifest["assignment"]["sha256"]:
        raise ManifestMismatch("Assignment checksum does not match the manifest. The split has been changed.")
    df = attach_split(pd.read_csv(dataset_path), pd.read_csv(assignment_path))
    assert_no_leakage(df)
    if split_summary(df) != manifest["counts"]:
        raise ManifestMismatch("Recomputed split counts differ from the manifest.")
    if not _include_test:
        df = df[df["split"] != "test"].reset_index(drop=True)
    return manifest, df
