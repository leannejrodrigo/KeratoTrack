import pandas as pd
import pytest

from keratotrack_research import synthetic


@pytest.fixture(scope="session")
def clean_df() -> pd.DataFrame:
    return synthetic.generate(synthetic.SyntheticSpec(n_patients=300))


@pytest.fixture(scope="session")
def dirty_df() -> pd.DataFrame:
    return synthetic.generate(synthetic.SyntheticSpec(n_patients=300, inject_issues=True))


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    """A data folder outside any repository, set through the real env var."""
    d = tmp_path / "KeratoTrack-data"
    monkeypatch.setenv("KERATOTRACK_DATA_DIR", str(d))
    return d
