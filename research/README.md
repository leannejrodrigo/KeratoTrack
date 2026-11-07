# Research Laboratory

Experimental machine-learning and computer-vision work will live here. No code,
models or datasets exist yet. See the
[provisional research protocol](../docs/research-protocol.md).

**Rules for this folder:**

- Results are experimental and carry no claim of clinical validity.
- Do not import anything from `companion/` or read its user data.
- Do not commit datasets, patient identifiers or patient-to-split assignments.
  They live **outside** the repository, in the folder named by the
  `KERATOTRACK_DATA_DIR` environment variable (see
  [`.env.example`](../.env.example)). `research/data/` is ignored by Git only as
  a second safeguard.
- Only non-identifying metadata, such as dataset versions, split versions and
  checksums, may be committed.
- Nothing is downloaded until its licence, provenance and permitted use have
  been checked.
