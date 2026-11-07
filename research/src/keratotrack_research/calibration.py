"""Calibration metrics for binary classifiers (research-protocol section 5).

A model is CALIBRATED if, among cases given probability p, about a fraction
p are actually positive. Discrimination (AUROC) ignores this entirely: any
monotonic rescaling of the scores keeps AUROC identical but can wreck
calibration. Hence both are always reported.

Brier score    mean((p - y)^2). A proper scoring rule: its expectation is
               minimised by the true probability. Lower is better; 0.25 is
               what always predicting 0.5 scores on balanced data.
NLL            -mean(y log p + (1 - y) log(1 - p)). Also proper, and it
               punishes confident mistakes very hard (log 0 -> infinity), so
               probabilities are clipped to [eps, 1 - eps]. The eps is reported.
ECE            sum_b (n_b / N) * |mean(y in b) - mean(p in b)| over bins b.
               It depends on the binning. Equal-WIDTH bins can be nearly empty
               where the model rarely predicts; equal-MASS (quantile) bins hold
               the same number of cases each. Different binning gives different
               numbers on the same predictions, which is why the method and bin
               count are returned with the value and ECE is never reported alone.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NLL_EPS = 1e-12


def _check(y: np.ndarray, p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    if y.shape != p.shape or y.ndim != 1:
        raise ValueError("y and p must be 1-D arrays of equal length")
    if not np.isin(y, (0.0, 1.0)).all():
        raise ValueError("y must contain only 0 and 1")
    if ((p < 0) | (p > 1) | np.isnan(p)).any():
        raise ValueError("p must be probabilities in [0, 1]")
    return y, p


def brier(y, p) -> float:
    y, p = _check(y, p)
    return float(np.mean((p - y) ** 2))


def nll(y, p, eps: float = NLL_EPS) -> float:
    y, p = _check(y, p)
    p = np.clip(p, eps, 1 - eps)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


@dataclass(frozen=True)
class ReliabilityBin:
    lower: float
    upper: float
    count: int
    mean_predicted: float | None
    observed_fraction: float | None


@dataclass(frozen=True)
class ECEResult:
    ece: float
    method: str  # "equal-width" | "equal-mass"
    n_bins: int
    bins: list[ReliabilityBin]


def reliability_bins(y, p, n_bins: int = 10, method: str = "equal-width") -> list[ReliabilityBin]:
    y, p = _check(y, p)
    if method == "equal-width":
        edges = np.linspace(0.0, 1.0, n_bins + 1)
    elif method == "equal-mass":
        edges = np.quantile(p, np.linspace(0.0, 1.0, n_bins + 1))
        edges[0], edges[-1] = 0.0, 1.0
    else:
        raise ValueError(f"Unknown binning method {method!r}")
    # Right-closed last bin so p = 1.0 is counted; other bins are [lo, hi).
    idx = np.clip(np.searchsorted(edges, p, side="right") - 1, 0, n_bins - 1)
    out = []
    for b in range(n_bins):
        m = idx == b
        n = int(m.sum())
        out.append(ReliabilityBin(float(edges[b]), float(edges[b + 1]), n, float(p[m].mean()) if n else None, float(y[m].mean()) if n else None))
    return out


def ece(y, p, n_bins: int = 10, method: str = "equal-width") -> ECEResult:
    bins = reliability_bins(y, p, n_bins, method)
    total = sum(b.count for b in bins)
    value = sum(b.count / total * abs(b.observed_fraction - b.mean_predicted) for b in bins if b.count)
    return ECEResult(float(value), method, n_bins, bins)
