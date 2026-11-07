"""KeratoTrack Research Laboratory.

Integrity infrastructure built before any real dataset is used: identifier
validation, patient-level splits with committed manifests, a guarded test-set
loader with a chained access log, missing-data mechanisms, calibration metrics
and static reports.

Everything here is experimental and carries no claim of clinical validity
(docs/research-protocol.md, section 11). This package never reads Companion
data (docs/safety-boundaries.md, rule 8).
"""

__version__ = "0.1.0"
