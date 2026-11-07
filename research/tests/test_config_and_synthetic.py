import pytest

from keratotrack_research import config, synthetic


def test_data_dir_must_be_set(tmp_path):
    with pytest.raises(config.DataDirError, match="not set"):
        config.data_dir(env={}, repo_root=tmp_path / "repo")


def test_data_dir_refused_inside_repository(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    with pytest.raises(config.DataDirError, match="inside the repository"):
        config.data_dir(env={config.ENV_VAR: str(repo / "research" / "data")}, repo_root=repo)


def test_data_dir_outside_repository_is_created(tmp_path):
    out = config.data_dir(env={config.ENV_VAR: str(tmp_path / "data")}, repo_root=tmp_path / "repo")
    assert out.is_dir()


def test_data_dir_read_from_dotenv(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / ".env").write_text(f"KERATOTRACK_DATA_DIR={tmp_path / 'd'}\n")
    assert config.data_dir(env={}, repo_root=repo) == (tmp_path / "d").resolve()


def test_generator_is_deterministic_and_labelled(clean_df):
    again = synthetic.generate(synthetic.SyntheticSpec(n_patients=300))
    assert clean_df.equals(again)
    assert clean_df["patient_id"].str.startswith("SYN-").all()
    assert clean_df["exam_id"].str.startswith("SYN-").all()


def test_patients_have_at_most_two_eyes_and_consistent_attributes(clean_df):
    assert clean_df.groupby("patient_id")["eye"].nunique().max() <= 2
    assert clean_df.groupby("patient_id")[["age", "sex"]].nunique().max().max() == 1


@pytest.mark.parametrize(
    "name,synthetic_flag,ok",
    [("SYN-kc", True, True), ("kc", True, False), ("SYN-kc", False, False), ("SYN-CornOrb-copy", True, False), ("CornOrb-v1", False, True)],
)
def test_dataset_naming_rules(name, synthetic_flag, ok):
    if ok:
        synthetic.validate_dataset_name(name, synthetic_flag)
    else:
        with pytest.raises(ValueError):
            synthetic.validate_dataset_name(name, synthetic_flag)
