# Research Laboratory

Experimental machine-learning and computer-vision work. See the
[provisional research protocol](../docs/research-protocol.md).

**Current state:** integrity infrastructure only, built and tested on
synthetic data. No real dataset has been downloaded or used, no model has been
trained, and there are no results. The literature review (R0) and the dataset
licence check and audit (R1) come first and decide whether later phases go
ahead.

**Rules for this folder:**

- Results are experimental and carry no claim of clinical validity.
- Do not import anything from `companion/` or read its user data.
- Do not commit datasets, patient identifiers, patient-to-split assignments
  or audit reports (reports quote example identifiers). They live **outside**
  the repository, in the folder named by `KERATOTRACK_DATA_DIR`
  (see [`.env.example`](../.env.example)). The code refuses a folder inside
  the repository.
- Only non-identifying metadata, such as split manifests and checksums, may
  be committed (`research/splits/`).
- Nothing is downloaded until its licence, provenance and permitted use have
  been checked.

## Running it

```sh
cd research
python -m venv .venv
.venv\Scripts\activate            # Windows; on macOS/Linux: source .venv/bin/activate
pip install -e ".[test]"
python -m pytest

keratotrack-research synth --dirty     # SYNTHETIC dataset with planted problems
keratotrack-research audit <dataset.csv>
keratotrack-research synth             # clean SYNTHETIC dataset
keratotrack-research split <dataset.csv>       # refuses if the audit has blockers
keratotrack-research verify <manifest.json> <dataset.csv>
keratotrack-research log-verify
```

## Modules

| Module | What it does |
|---|---|
| `config` | Resolves `KERATOTRACK_DATA_DIR`; refuses a folder inside the repository |
| `synthetic` | Seeded synthetic dataset (patients, 1–2 eyes, repeat exams); can plant known problems; naming rules (`SYN-`, no real dataset names) |
| `audit` | Identifier, consistency, plausibility and duplicate checks returning structured findings |
| `splits` | Patient-level stratified group split, leakage check, frozen manifest, verified loading (test rows excluded) |
| `evaluation` | Guarded test-set evaluation and the hash-chained access log |
| `missingness` | MCAR, MAR and MNAR masks at a controlled missing rate |
| `calibration` | Brier score, NLL, ECE (binning method always reported), reliability bins |
| `report` | Static Markdown and HTML audit reports with a provenance section |
