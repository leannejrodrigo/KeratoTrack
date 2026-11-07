import json

import pandas as pd
import pytest

from keratotrack_research import splits


def test_assignment_is_patient_level_and_leak_free(clean_df):
    a = splits.make_assignment(clean_df)
    df = splits.attach_split(clean_df, a)
    splits.assert_no_leakage(df)
    assert set(df["split"]) == {"train", "val", "test"}


def test_fractions_are_roughly_respected(clean_df):
    summary = splits.split_summary(splits.attach_split(clean_df, splits.make_assignment(clean_df)))
    total = sum(s["patients"] for s in summary.values())
    assert summary["test"]["patients"] / total == pytest.approx(0.2, abs=0.03)
    assert summary["val"]["patients"] / total == pytest.approx(0.2, abs=0.03)


def test_stratification_is_reported_not_assumed(clean_df):
    summary = splits.split_summary(splits.attach_split(clean_df, splits.make_assignment(clean_df)))
    fracs = [s["patient_label1_fraction"] for s in summary.values()]
    assert max(fracs) - min(fracs) < 0.1  # best-effort balance, checked


def test_leakage_detector_catches_a_split_patient(clean_df):
    df = splits.attach_split(clean_df, splits.make_assignment(clean_df))
    pid = df["patient_id"].value_counts().index[0]  # a patient with >1 row
    rows = df.index[df["patient_id"] == pid]
    df.loc[rows[0], "split"] = "train"
    df.loc[rows[1], "split"] = "test"
    with pytest.raises(splits.LeakageError):
        splits.assert_no_leakage(df)


def test_leakage_detector_sees_through_id_spelling(clean_df):
    df = splits.attach_split(clean_df, splits.make_assignment(clean_df)).head(4).copy()
    df["patient_id"] = ["SYN-P1", " syn-p1", "SYN-P2", "SYN-P3"]
    df["split"] = ["train", "test", "train", "val"]
    with pytest.raises(splits.LeakageError):
        splits.assert_no_leakage(df)


def test_row_level_split_WOULD_leak(clean_df):
    """Teaching test: what goes wrong without grouping."""
    shuffled = clean_df.sample(frac=1, random_state=0).reset_index(drop=True)
    shuffled["split"] = ["test" if i % 5 == 0 else "train" for i in range(len(shuffled))]
    with pytest.raises(splits.LeakageError):
        splits.assert_no_leakage(shuffled)


def _freeze(clean_df, tmp_path, data_dir):
    ds = data_dir / "datasets" / "SYN-test.csv"
    ds.parent.mkdir(parents=True)
    clean_df.to_csv(ds, index=False)
    manifest = tmp_path / "repo" / "research" / "splits" / "m.json"
    m = splits.freeze_split(ds, "SYN-test", True, data_dir, manifest)
    return ds, manifest, m


def test_manifest_contains_no_patient_codes(clean_df, tmp_path, data_dir):
    _, manifest, _ = _freeze(clean_df, tmp_path, data_dir)
    text = manifest.read_text()
    assert "SYN-P" not in text and "syn-p" not in text
    assert json.loads(text)["assignment"]["sha256"]


def test_frozen_split_is_never_overwritten(clean_df, tmp_path, data_dir):
    ds, manifest, _ = _freeze(clean_df, tmp_path, data_dir)
    with pytest.raises(FileExistsError):
        splits.freeze_split(ds, "SYN-test", True, data_dir, manifest)


def test_verified_load_excludes_test_rows(clean_df, tmp_path, data_dir):
    ds, manifest, m = _freeze(clean_df, tmp_path, data_dir)
    _, df = splits.load_verified(manifest, ds, data_dir)
    assert "test" not in set(df["split"])
    assert len(df) == m["counts"]["train"]["rows"] + m["counts"]["val"]["rows"]


def test_changed_dataset_is_refused(clean_df, tmp_path, data_dir):
    ds, manifest, _ = _freeze(clean_df, tmp_path, data_dir)
    changed = pd.read_csv(ds)
    changed.loc[0, "kmax_d"] += 0.1
    changed.to_csv(ds, index=False)
    with pytest.raises(splits.ManifestMismatch, match="Dataset checksum"):
        splits.load_verified(manifest, ds, data_dir)


def test_changed_assignment_is_refused(clean_df, tmp_path, data_dir):
    ds, manifest, m = _freeze(clean_df, tmp_path, data_dir)
    path = data_dir / "splits" / m["assignment"]["filename"]
    a = pd.read_csv(path)
    a.loc[0, "split"] = "train" if a.loc[0, "split"] == "test" else "test"
    a.to_csv(path, index=False)
    with pytest.raises(splits.ManifestMismatch, match="Assignment checksum"):
        splits.load_verified(manifest, ds, data_dir)
