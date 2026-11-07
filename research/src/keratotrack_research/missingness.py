"""Simulating missing measurements (research-protocol section 4).

A mask M has M[i] = True where value i is hidden. The MECHANISM, meaning
what P(M = 1) depends on, matters as much as the amount:

  MCAR  P(M=1) = p                      independent of all data
  MAR   P(M=1) = f(other OBSERVED column) e.g. depends on age, not on the value itself
  MNAR  P(M=1) = f(the value ITSELF)    e.g. extreme values more often unrecorded

Why it matters: under MCAR the observed rows are a random subsample, so
simple imputation is unbiased (just noisier). Under MAR, conditioning on
the observed driver can correct bias. Under MNAR, the observed values are a
biased sample of the truth and no method that only sees the observed data
can fully correct it. A model evaluated under MCAR may look robust and then
fail under MNAR, which is the kind of gap this research asks about.

Implementation: a logistic model gives each row its own probability, with
an intercept solved so the EXPECTED missing fraction equals the target.
That makes MCAR/MAR/MNAR comparable at the same missing rate:

  p_i = sigmoid(a + s * z_i),  z_i = standardised driver value,
  a chosen by bisection so mean(p_i) = target rate.
"""

from __future__ import annotations

import numpy as np

Mechanism = str  # "MCAR" | "MAR" | "MNAR"


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _standardise(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    sd = np.nanstd(x)
    return np.zeros_like(x) if sd == 0 or np.isnan(sd) else (x - np.nanmean(x)) / sd


def _intercept_for_rate(z: np.ndarray, strength: float, rate: float) -> float:
    """Bisection on a: mean(sigmoid(a + strength*z)) is increasing in a."""
    lo, hi = -50.0, 50.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if _sigmoid(mid + strength * z).mean() < rate:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def missing_probabilities(n: int, mechanism: Mechanism, rate: float, *, values: np.ndarray | None = None, driver: np.ndarray | None = None, strength: float = 2.0, two_sided: bool = False) -> np.ndarray:
    if not 0 <= rate < 1:
        raise ValueError("rate must be in [0, 1)")
    if mechanism == "MCAR":
        return np.full(n, rate)
    if mechanism == "MAR":
        if driver is None:
            raise ValueError("MAR needs an observed driver column")
        z = _standardise(driver)
    elif mechanism == "MNAR":
        if values is None:
            raise ValueError("MNAR needs the values themselves")
        z = _standardise(values)
        if two_sided:
            z = np.abs(z)  # both extremes more likely to be missing
    else:
        raise ValueError(f"Unknown mechanism {mechanism!r}")
    if rate == 0:
        return np.zeros(n)
    return _sigmoid(_intercept_for_rate(z, strength, rate) + strength * z)


def make_mask(rng: np.random.Generator, n: int, mechanism: Mechanism, rate: float, **kwargs) -> np.ndarray:
    """Draw a boolean mask (True = hide this value)."""
    p = missing_probabilities(n, mechanism, rate, **kwargs)
    return rng.random(n) < p
