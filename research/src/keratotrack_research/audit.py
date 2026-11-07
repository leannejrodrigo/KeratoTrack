"""Dataset audit checks (research-protocol sections 6-8).

Design: every check is a pure function DataFrame -> list[Finding]. Checks do
not print, fix or drop anything. Deciding what to do about a finding (exclude,
correct, ask the dataset authors) is a documented human decision made before
modelling, not something the audit does silently.

Identifier checks come first because every later step trusts identifiers: a
patient whose ID appears in two spellings would be treated as two patients,
could land in both train and test, and leak without any visible error.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

# Data-entry plausibility limits. Same idea as the Companion: they catch
# entries that cannot be correctly recorded values (e.g. a missing digit),
# they are deliberately wide, and they are NOT clinical thresholds. They are
# reported as parameters of the audit run so readers can see them.
PLAUSIBILITY_LIMITS = {"kmax_d": (20.0, 120.0), "thinnest_um": (100.0, 1000.0), "age": (0, 110)}
VALID_EYES = {"OD", "OS"}
VALID_LABELS = {0, 1}


@dataclass(frozen=True)
class Finding:
    check: str
    severity: str  # "blocker" (must be resolved before splitting) | "warning" | "info"
    message: str
    count: int
    examples: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def normalise_id(s: object) -> str:
    """Canonical form used only for COMPARISON: trimmed and case-folded."""
    return str(s).strip().casefold()


def check_identifiers(df: pd.DataFrame) -> list[Finding]:
    out: list[Finding] = []
    pid = df["patient_id"]

    missing = pid.isna() | (pid.astype("string").str.strip() == "")
    if missing.any():
        out.append(Finding("ids.missing", "blocker", "Rows with no patient identifier", int(missing.sum())))

    raw = pid.dropna().astype(str)
    ws = raw[raw != raw.str.strip()]
    if len(ws):
        out.append(Finding("ids.whitespace", "blocker", "Patient identifiers with leading or trailing whitespace", len(ws), sorted(map(repr, ws.unique()))[:5]))

    # Distinct raw spellings that collapse to the same normalised ID.
    groups = raw.groupby(raw.map(normalise_id)).unique()
    collisions = groups[groups.map(len) > 1]
    if len(collisions):
        examples = [" vs ".join(map(repr, sorted(v))) for v in collisions.tolist()[:5]]
        out.append(
            Finding(
                "ids.variant_spellings",
                "blocker",
                "Identifiers that differ only by case or whitespace (probably the same patient; would split one patient into two)",
                len(collisions),
                examples,
            )
        )

    if "exam_id" in df:
        dup_exam = df["exam_id"].duplicated(keep=False)
        if dup_exam.any():
            out.append(Finding("ids.duplicate_exam_id", "warning", "Exam identifiers used on more than one row", int(df.loc[dup_exam, "exam_id"].nunique()), sorted(df.loc[dup_exam, "exam_id"].astype(str).unique())[:5]))

    bad_eye = ~df["eye"].isin(VALID_EYES)
    if bad_eye.any():
        out.append(Finding("ids.invalid_eye", "blocker", "Eye not recorded as OD or OS", int(bad_eye.sum()), sorted(df.loc[bad_eye, "eye"].astype(str).unique())[:5]))
    return out


def check_patient_consistency(df: pd.DataFrame, attributes: tuple[str, ...] = ("sex", "age")) -> list[Finding]:
    """Patient-level attributes must agree across all of that patient's rows."""
    out: list[Finding] = []
    key = df["patient_id"].map(normalise_id)
    for attr in attributes:
        if attr not in df:
            continue
        n_distinct = df.groupby(key)[attr].nunique(dropna=True)
        bad = n_distinct[n_distinct > 1]
        if len(bad):
            out.append(Finding(f"consistency.{attr}", "warning", f"Patients whose rows disagree on {attr} (possible mislinked records)", len(bad), sorted(bad.index)[:5]))
    eyes_per_patient = df.groupby(key)["eye"].nunique()
    return out + ([Finding("consistency.eyes", "blocker", "Patients with more than two distinct eyes", int((eyes_per_patient > 2).sum()))] if (eyes_per_patient > 2).any() else [])


def check_values(df: pd.DataFrame, limits: dict = PLAUSIBILITY_LIMITS) -> list[Finding]:
    out: list[Finding] = []
    for col, (lo, hi) in limits.items():
        if col not in df:
            continue
        values = pd.to_numeric(df[col], errors="coerce")
        n_missing = int(values.isna().sum())
        if n_missing:
            out.append(Finding(f"values.missing.{col}", "info", f"Missing values in {col}", n_missing))
        outside = values.notna() & ((values < lo) | (values > hi))
        if outside.any():
            ex = df.loc[outside, "exam_id"].astype(str).tolist() if "exam_id" in df else []
            out.append(Finding(f"values.implausible.{col}", "warning", f"{col} outside data-entry limits [{lo}, {hi}] (possible entry error; not a clinical judgement)", int(outside.sum()), ex[:5]))
    if "label" in df:
        bad = ~df["label"].isin(VALID_LABELS)
        if bad.any():
            out.append(Finding("values.invalid_label", "blocker", "Labels other than 0 or 1", int(bad.sum())))
    return out


def check_duplicates(df: pd.DataFrame, near_tolerance: dict[str, float] | None = None, level: str = "loose", include_exact: bool = True) -> list[Finding]:
    """Exact duplicate rows, and near-duplicate exams of the same eye.

    Near-duplicates are reported at the tolerance given (recorded in the
    finding message). Protocol section 8 requires reporting at more than one
    level; the CLI audit runs two.
    """
    out: list[Finding] = []
    exact = df.duplicated(keep=False)
    if include_exact and exact.any():
        out.append(Finding("duplicates.exact_rows", "warning", "Rows that are exact copies of another row", int(df.duplicated().sum())))

    tol = near_tolerance or {"kmax_d": 0.5, "thinnest_um": 10.0}
    deduped = df.drop_duplicates()
    key = [deduped["patient_id"].map(normalise_id), deduped["eye"]]
    pairs = 0
    examples: list[str] = []
    for (_pid, _eye), g in deduped.groupby(key):
        if len(g) < 2:
            continue
        vals = g[list(tol)].to_numpy(dtype=float)
        for i in range(len(g)):
            for j in range(i + 1, len(g)):
                diff = np.abs(vals[i] - vals[j])
                if np.all(np.nan_to_num(diff, nan=np.inf) <= np.array(list(tol.values()))):
                    pairs += 1
                    if len(examples) < 5 and "exam_id" in g:
                        examples.append(f"{g['exam_id'].iloc[i]} ~ {g['exam_id'].iloc[j]}")
    if pairs:
        tol_txt = ", ".join(f"{k} ≤ {v}" for k, v in tol.items())
        out.append(Finding(f"duplicates.near_same_eye.{level}", "info", f"Near-duplicate exam pairs of the same eye at {level} tolerance ({tol_txt}); repeats must not be treated as independent", pairs, examples))
    return out


def check_class_balance(df: pd.DataFrame) -> list[Finding]:
    by_eye = df.assign(_pid=df["patient_id"].map(normalise_id)).drop_duplicates(subset=["_pid", "eye"])
    pos = int(by_eye["label"].sum())
    return [Finding("summary.class_balance", "info", f"Label 1 in {pos} of {len(by_eye)} patient-eyes ({pos / max(1, len(by_eye)):.1%})", pos)]


ALL_CHECKS: list[Callable[[pd.DataFrame], list[Finding]]] = [check_identifiers, check_patient_consistency, check_values, check_duplicates, check_class_balance]


def run_audit(df: pd.DataFrame) -> list[Finding]:
    findings: list[Finding] = []
    for check in ALL_CHECKS:
        findings.extend(check(df))
    # Protocol section 8: report near-duplicates at more than one level.
    findings.extend(check_duplicates(df, {"kmax_d": 0.2, "thinnest_um": 4.0}, level="strict", include_exact=False))
    return findings


def has_blockers(findings: list[Finding]) -> bool:
    return any(f.severity == "blocker" for f in findings)
