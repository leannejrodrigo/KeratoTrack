"""SYNTHETIC tabular dataset for building and testing the pipeline.

Everything here is invented by this code. The class-conditional distributions
are arbitrary choices made so the pipeline has something to process; they
are NOT derived from any dataset, paper or person, and nothing about
keratoconus may be inferred from them or from any result computed on them.

Structure mirrors what a real dataset is likely to have, because those are
the things the integrity code must handle:

* patients with one or two eyes (the unit of independence is the PATIENT),
* labels that are correlated within a patient (both eyes often share a label),
* occasional repeat exams of the same eye (near-duplicates),
* patient-level attributes (age, sex) that must agree across rows.

With ``inject_issues=True`` the generator plants known problems so tests can
check that the audit finds exactly them: an identifier that differs only by
case and whitespace, an impossible value, an exact duplicate row, a patient
with conflicting sex, and a missing value.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

SYNTHETIC_PREFIX = "SYN-"

# Names of real datasets that synthetic data may never be registered under
# (design-spec 8.1). Comparison is case-insensitive.
RESERVED_REAL_DATASET_NAMES = {"cornorb"}

COLUMNS = ["patient_id", "eye", "exam_id", "age", "sex", "kmax_d", "thinnest_um", "label"]


@dataclass(frozen=True)
class SyntheticSpec:
    n_patients: int = 400
    seed: int = 20261107
    prevalence: float = 0.4  # fraction of patients with label 1 in at least one eye
    both_eyes_fraction: float = 0.8
    fellow_eye_same_label: float = 0.7
    repeat_exam_fraction: float = 0.05
    inject_issues: bool = False


def dataset_id(spec: SyntheticSpec) -> str:
    return f"{SYNTHETIC_PREFIX}kc-tabular-n{spec.n_patients}-s{spec.seed}{'-dirty' if spec.inject_issues else ''}"


def validate_dataset_name(name: str, synthetic: bool) -> None:
    """Synthetic datasets must be SYN- named and never use a real dataset's name."""
    if synthetic and not name.startswith(SYNTHETIC_PREFIX):
        raise ValueError(f"Synthetic dataset names must start with {SYNTHETIC_PREFIX!r}: {name!r}")
    if not synthetic and name.startswith(SYNTHETIC_PREFIX):
        raise ValueError(f"Only synthetic datasets may use the {SYNTHETIC_PREFIX!r} prefix: {name!r}")
    lowered = name.lower()
    if synthetic and any(real in lowered for real in RESERVED_REAL_DATASET_NAMES):
        raise ValueError(f"Synthetic data cannot be registered under a real dataset's name: {name!r}")


def generate(spec: SyntheticSpec = SyntheticSpec()) -> pd.DataFrame:
    # A Generator with an explicit seed: reproducible, and independent of any
    # global NumPy random state that other code might touch.
    rng = np.random.default_rng(spec.seed)
    rows: list[dict] = []
    exam_counter = 0

    for p in range(spec.n_patients):
        pid = f"{SYNTHETIC_PREFIX}P{p:05d}"
        age = int(rng.integers(14, 70))
        sex = str(rng.choice(["F", "M"]))
        patient_positive = rng.random() < spec.prevalence
        eyes = ["OD", "OS"] if rng.random() < spec.both_eyes_fraction else [str(rng.choice(["OD", "OS"]))]

        # Within-patient correlation: the first eye takes the patient label;
        # a fellow eye usually shares it. This is exactly why splitting by eye
        # would leak: the test eye's twin would be in training.
        labels = [int(patient_positive)]
        if len(eyes) == 2:
            same = rng.random() < spec.fellow_eye_same_label
            labels.append(labels[0] if same else int(not labels[0]) if patient_positive else 0)

        for eye, label in zip(eyes, labels):
            n_exams = 2 if rng.random() < spec.repeat_exam_fraction else 1
            base_k = rng.normal(52.0, 4.0) if label else rng.normal(44.0, 1.5)
            base_t = rng.normal(455.0, 35.0) if label else rng.normal(540.0, 30.0)
            for _ in range(n_exams):
                exam_counter += 1
                rows.append(
                    {
                        "patient_id": pid,
                        "eye": eye,
                        "exam_id": f"{SYNTHETIC_PREFIX}E{exam_counter:06d}",
                        "age": age,
                        "sex": sex,
                        # Repeat exams differ by small measurement noise.
                        "kmax_d": round(float(base_k + rng.normal(0, 0.3)), 1),
                        "thinnest_um": int(round(base_t + rng.normal(0, 4.0))),
                        "label": label,
                    }
                )

    df = pd.DataFrame(rows, columns=COLUMNS)
    if spec.inject_issues:
        df = _inject_issues(df)
    df["kmax_d"] = df["kmax_d"].astype("float64")
    df["thinnest_um"] = df["thinnest_um"].astype("float64")
    return df


# Planted problems, recorded so tests can assert the audit finds exactly these.
INJECTED = {
    "case_whitespace_id": f" {SYNTHETIC_PREFIX.lower()}p00001",  # same patient as SYN-P00001
    "impossible_kmax_exam": f"{SYNTHETIC_PREFIX}E000003",
    "duplicate_exam": f"{SYNTHETIC_PREFIX}E000005",
    "conflicting_sex_patient": f"{SYNTHETIC_PREFIX}P00010",
    "missing_thinnest_exam": f"{SYNTHETIC_PREFIX}E000007",
}


def _inject_issues(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # 1. A row for an existing patient whose ID differs only in case/whitespace.
    src = df[df["patient_id"] == f"{SYNTHETIC_PREFIX}P00001"].iloc[[0]].copy()
    src["patient_id"] = INJECTED["case_whitespace_id"]
    src["exam_id"] = f"{SYNTHETIC_PREFIX}E900001"
    df = pd.concat([df, src], ignore_index=True)
    # 2. An impossible value (a typing error: 5.2 instead of 52.0).
    df.loc[df["exam_id"] == INJECTED["impossible_kmax_exam"], "kmax_d"] = 5.2
    # 3. An exact duplicate row.
    df = pd.concat([df, df[df["exam_id"] == INJECTED["duplicate_exam"]]], ignore_index=True)
    # 4. A patient whose rows disagree on sex.
    idx = df.index[df["patient_id"] == INJECTED["conflicting_sex_patient"]]
    if len(idx) >= 1:
        df.loc[idx[-1], "sex"] = "M" if df.loc[idx[0], "sex"] == "F" else "F"
        if len(idx) == 1:  # ensure two rows exist so the conflict is visible
            extra = df.loc[[idx[0]]].copy()
            extra["exam_id"] = f"{SYNTHETIC_PREFIX}E900002"
            extra["sex"] = "M" if extra["sex"].iloc[0] == "F" else "F"
            df = pd.concat([df, extra], ignore_index=True)
    # 5. A missing measurement.
    df.loc[df["exam_id"] == INJECTED["missing_thinnest_exam"], "thinnest_um"] = np.nan
    return df.reset_index(drop=True)


def dataset_card(spec: SyntheticSpec, df: pd.DataFrame) -> dict:
    return {
        "dataset_id": dataset_id(spec),
        "synthetic": True,
        "notice": "SYNTHETIC DATA: generated by keratotrack_research.synthetic. Not real patient information. "
        "Distributions are arbitrary; nothing about keratoconus may be inferred from this data.",
        "generator": "keratotrack_research.synthetic.generate",
        "spec": asdict(spec),
        "rows": int(len(df)),
        "columns": list(df.columns),
    }
