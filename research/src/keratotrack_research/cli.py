"""Command-line entry point: python -m keratotrack_research <command>.

  synth      generate a SYNTHETIC dataset into the data folder
  audit      run the audit and write Markdown/HTML reports to the data folder
  split      freeze a patient-level split (refuses if the audit has blockers)
  verify     check a dataset and assignment against a committed manifest
  log-verify check the evaluation access log's hash chain

There is deliberately no command that reads the test split. Final
evaluation goes through evaluation.guarded_evaluate once models exist.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import audit, report, splits, synthetic
from .config import REPO_ROOT, DataDirError, data_dir
from .evaluation import read_log, verify_chain
from .hashing import sha256_file

MANIFEST_DIR = REPO_ROOT / "research" / "splits"


def _dataset_meta(path: Path) -> tuple[str, bool]:
    card = path.with_suffix(".card.json")
    if card.exists():
        info = json.loads(card.read_text(encoding="utf-8"))
        return info["dataset_id"], bool(info["synthetic"])
    name = path.stem
    return name, name.startswith(synthetic.SYNTHETIC_PREFIX)


def cmd_synth(a: argparse.Namespace) -> int:
    spec = synthetic.SyntheticSpec(n_patients=a.n, seed=a.seed, inject_issues=a.dirty)
    df = synthetic.generate(spec)
    did = synthetic.dataset_id(spec)
    synthetic.validate_dataset_name(did, synthetic=True)
    out = data_dir() / "datasets" / f"{did}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False, lineterminator="\n")
    out.with_suffix(".card.json").write_text(json.dumps(synthetic.dataset_card(spec, df), indent=2) + "\n", encoding="utf-8")
    print(f"SYNTHETIC dataset written: {out}\n  rows={len(df)} sha256={sha256_file(out)}")
    return 0


def cmd_audit(a: argparse.Namespace) -> int:
    import pandas as pd

    path = Path(a.dataset)
    did, syn = _dataset_meta(path)
    df = pd.read_csv(path)
    findings = audit.run_audit(df)
    meta = dict(dataset_id=did, sha=sha256_file(path), rows=len(df), synthetic=syn, commit=splits.git_commit(REPO_ROOT))
    md, ht = report.write_reports(findings, data_dir() / "reports", f"audit__{did}", **meta)
    for f in findings:
        print(f"[{f.severity:7}] {f.check}: {f.count}  {f.message}")
    print(f"Reports: {md}\n         {ht}")
    return 1 if audit.has_blockers(findings) else 0


def cmd_split(a: argparse.Namespace) -> int:
    import pandas as pd

    path = Path(a.dataset)
    did, syn = _dataset_meta(path)
    findings = audit.run_audit(pd.read_csv(path))
    if audit.has_blockers(findings):
        print("Refusing to freeze a split: the audit has blockers. Resolve them (and document how) first.", file=sys.stderr)
        return 1
    manifest_path = Path(a.manifest) if a.manifest else MANIFEST_DIR / f"{did}__split-s{a.seed}.manifest.json"
    m = splits.freeze_split(path, did, syn, data_dir(), manifest_path, splits.SplitParams(a.test_fraction, a.val_fraction, a.seed), REPO_ROOT)
    print(f"Split frozen. Manifest (commit this): {manifest_path}")
    print(json.dumps(m["counts"], indent=2))
    return 0


def cmd_verify(a: argparse.Namespace) -> int:
    m, df = splits.load_verified(Path(a.manifest), Path(a.dataset), data_dir())
    print(f"OK: {m['split_id']} matches. Loaded train+val only ({len(df)} rows). Test rows were not loaded.")
    return 0


def cmd_log_verify(a: argparse.Namespace) -> int:
    entries = read_log(Path(a.log))
    problems = verify_chain(entries)
    print(f"{len(entries)} entries. " + ("Chain intact." if not problems else "PROBLEMS:\n- " + "\n- ".join(problems)))
    return 1 if problems else 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="keratotrack-research", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    s = sub.add_parser("synth"); s.add_argument("--n", type=int, default=400); s.add_argument("--seed", type=int, default=20261107); s.add_argument("--dirty", action="store_true", help="plant known issues for audit testing"); s.set_defaults(fn=cmd_synth)
    s = sub.add_parser("audit"); s.add_argument("dataset"); s.set_defaults(fn=cmd_audit)
    s = sub.add_parser("split"); s.add_argument("dataset"); s.add_argument("--manifest"); s.add_argument("--seed", type=int, default=20261107)
    s.add_argument("--test-fraction", type=float, default=0.2); s.add_argument("--val-fraction", type=float, default=0.2)
    s.set_defaults(fn=cmd_split)
    s = sub.add_parser("verify"); s.add_argument("manifest"); s.add_argument("dataset"); s.set_defaults(fn=cmd_verify)
    s = sub.add_parser("log-verify"); s.add_argument("--log", default=str(REPO_ROOT / "research" / "evaluation-log.jsonl")); s.set_defaults(fn=cmd_log_verify)
    a = p.parse_args(argv)
    try:
        return a.fn(a)
    except (DataDirError, splits.ManifestMismatch, splits.LeakageError, FileExistsError, ValueError) as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
