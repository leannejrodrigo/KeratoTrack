import numpy as np
import pytest

from keratotrack_research.calibration import brier, ece, nll, reliability_bins


def test_brier_hand_computed():
    # ((0.9-1)^2 + (0.2-0)^2 + (0.6-1)^2 + (0.4-0)^2) / 4 = (0.01+0.04+0.16+0.16)/4
    assert brier([1, 0, 1, 0], [0.9, 0.2, 0.6, 0.4]) == pytest.approx(0.0925)


def test_brier_of_always_half_is_quarter():
    assert brier([0, 1, 0, 1], [0.5] * 4) == pytest.approx(0.25)


def test_nll_hand_computed_and_clipped():
    assert nll([1, 0], [0.8, 0.3]) == pytest.approx(-(np.log(0.8) + np.log(0.7)) / 2)
    assert np.isfinite(nll([1], [0.0]))  # clipped, not infinite


def test_perfectly_calibrated_predictions_have_near_zero_ece():
    rng = np.random.default_rng(1)
    p = rng.uniform(0, 1, 200_000)
    y = (rng.uniform(0, 1, p.size) < p).astype(float)
    for method in ("equal-width", "equal-mass"):
        assert ece(y, p, 10, method).ece < 0.01


def test_overconfident_predictions_have_large_ece():
    rng = np.random.default_rng(2)
    true_p = rng.uniform(0.3, 0.7, 50_000)
    y = (rng.uniform(0, 1, true_p.size) < true_p).astype(float)
    overconfident = np.where(true_p > 0.5, 0.99, 0.01)
    assert ece(y, overconfident).ece > 0.3


def test_ece_hand_computed_two_bins():
    # Bin [0,0.5): p=0.2,0.4 -> mean 0.3, y=0,1 -> 0.5, gap 0.2
    # Bin [0.5,1]: p=0.6,1.0 -> mean 0.8, y=1,1 -> 1.0, gap 0.2  => ECE = 0.2
    r = ece([0, 1, 1, 1], [0.2, 0.4, 0.6, 1.0], n_bins=2)
    assert r.ece == pytest.approx(0.2)
    assert [b.count for b in r.bins] == [2, 2]  # p = 1.0 lands in the last bin


def test_binning_choice_changes_ece_which_is_why_it_is_reported():
    rng = np.random.default_rng(3)
    p = rng.beta(0.5, 5, 5000)
    y = (rng.uniform(0, 1, p.size) < p * 1.3).astype(float)
    w, m = ece(y, p, 10, "equal-width"), ece(y, p, 10, "equal-mass")
    assert (w.method, w.n_bins) == ("equal-width", 10)
    assert w.ece != pytest.approx(m.ece, abs=1e-6)


def test_equal_mass_bins_hold_similar_counts():
    p = np.random.default_rng(4).beta(0.5, 5, 1000)
    counts = [b.count for b in reliability_bins(np.zeros(1000), p, 10, "equal-mass")]
    assert max(counts) - min(counts) <= 2


def test_rejects_invalid_inputs():
    with pytest.raises(ValueError):
        brier([0, 2], [0.1, 0.2])
    with pytest.raises(ValueError):
        brier([0, 1], [0.1, 1.2])
