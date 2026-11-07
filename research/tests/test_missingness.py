import numpy as np
import pytest

from keratotrack_research.missingness import make_mask, missing_probabilities

N = 20_000


@pytest.fixture()
def data():
    rng = np.random.default_rng(0)
    return rng, rng.normal(47, 3, N), rng.normal(40, 12, N)


@pytest.mark.parametrize("mech", ["MCAR", "MAR", "MNAR"])
@pytest.mark.parametrize("rate", [0.1, 0.3])
def test_all_mechanisms_hit_the_target_rate(data, mech, rate):
    rng, values, age = data
    mask = make_mask(rng, N, mech, rate, values=values, driver=age)
    assert mask.mean() == pytest.approx(rate, abs=0.015)


def test_mcar_is_independent_of_the_value(data):
    rng, values, _ = data
    mask = make_mask(rng, N, "MCAR", 0.3)
    assert values[mask].mean() == pytest.approx(values.mean(), abs=0.15)


def test_mar_depends_on_the_driver_not_directly_on_the_value(data):
    rng, values, age = data
    mask = make_mask(rng, N, "MAR", 0.3, driver=age)
    assert age[mask].mean() > age[~mask].mean() + 5
    assert values[mask].mean() == pytest.approx(values[~mask].mean(), abs=0.2)  # values independent of age here


def test_mnar_biases_the_observed_values(data):
    """The point of MNAR: what remains observed is a biased sample."""
    rng, values, _ = data
    mask = make_mask(rng, N, "MNAR", 0.3, values=values)
    assert values[~mask].mean() < values.mean() - 0.5


def test_two_sided_mnar_hides_both_extremes(data):
    rng, values, _ = data
    mask = make_mask(rng, N, "MNAR", 0.3, values=values, two_sided=True)
    assert values[~mask].std() < values.std()
    assert values[~mask].mean() == pytest.approx(values.mean(), abs=0.2)


def test_bad_arguments():
    with pytest.raises(ValueError):
        missing_probabilities(10, "MAR", 0.2)
    with pytest.raises(ValueError):
        missing_probabilities(10, "MCAR", 1.0)
