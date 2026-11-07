import json
import subprocess
from datetime import datetime, timezone

import pytest

from keratotrack_research import evaluation, splits


def git(repo, *args):
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


@pytest.fixture()
def setup(clean_df, tmp_path, data_dir):
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "test@example.invalid")
    git(repo, "config", "user.name", "Test")
    protocol = repo / "protocol.md"
    protocol.write_text("# Protocol\n\n**Status:** final\n")
    ds = data_dir / "datasets" / "SYN-test.csv"
    ds.parent.mkdir(parents=True)
    clean_df.to_csv(ds, index=False)
    manifest = repo / "research" / "splits" / "m.json"
    splits.freeze_split(ds, "SYN-test", True, data_dir, manifest)
    model = repo / "model.bin"
    model.write_bytes(b"synthetic-model")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "init")
    log = repo / "research" / "evaluation-log.jsonl"
    seen = {}

    def run(purpose="final evaluation", **over):
        kwargs = dict(
            manifest_path=manifest, dataset_path=ds, data_dir=data_dir, log_path=log,
            config={"model": "majority"}, model_path=model, purpose=purpose, run_id="SYN-run-1",
            evaluate=lambda test: seen.setdefault("splits", set(test["split"])) and {"n": len(test)},
            pre=evaluation.Preconditions(repo, protocol),
            now=lambda: datetime(2026, 11, 7, tzinfo=timezone.utc),
        )
        kwargs.update(over)
        return evaluation.guarded_evaluate(**kwargs)

    return dict(repo=repo, protocol=protocol, log=log, run=run, seen=seen)


def test_successful_evaluation_sees_only_test_rows_and_logs_intent_then_completion(setup):
    result = setup["run"]()
    assert setup["seen"]["splits"] == {"test"}
    assert result["n"] > 0
    entries = evaluation.read_log(setup["log"])
    assert [e["status"] for e in entries] == ["intent", "completed"]
    assert entries[1]["result_sha256"]
    assert evaluation.verify_chain(entries) == []


def test_refuses_when_protocol_not_final(setup):
    setup["protocol"].write_text("**Status:** provisional\n")
    git(setup["repo"], "commit", "-qam", "provisional")
    with pytest.raises(evaluation.EvaluationRefused, match="not marked final"):
        setup["run"]()
    assert not setup["log"].exists()  # refused BEFORE any intent was written


def test_refuses_on_dirty_tree(setup):
    (setup["repo"] / "scratch.txt").write_text("x")
    with pytest.raises(evaluation.EvaluationRefused, match="uncommitted changes"):
        setup["run"]()


def test_refuses_until_previous_log_entries_are_committed(setup):
    setup["run"]()
    with pytest.raises(evaluation.EvaluationRefused):
        setup["run"]()  # log not committed yet
    git(setup["repo"], "add", "-A")
    git(setup["repo"], "commit", "-qm", "log eval 1")
    setup["run"]()
    numbers = [e["evaluation_number"] for e in evaluation.read_log(setup["log"]) if e["status"] == "intent"]
    assert numbers == [1, 2]


def test_requires_a_purpose(setup):
    with pytest.raises(evaluation.EvaluationRefused, match="purpose"):
        setup["run"](purpose="  ")


def test_edited_log_entry_breaks_the_chain(setup):
    setup["run"]()
    lines = setup["log"].read_text().splitlines()
    first = json.loads(lines[0])
    first["purpose"] = "quietly changed"
    lines[0] = json.dumps(first, sort_keys=True)
    setup["log"].write_text("\n".join(lines) + "\n")
    assert evaluation.verify_chain(evaluation.read_log(setup["log"]))


def test_dangling_intent_blocks_further_evaluations(setup):
    def boom(_test):
        raise RuntimeError("crash mid-evaluation")

    with pytest.raises(RuntimeError):
        setup["run"](evaluate=boom)
    git(setup["repo"], "add", "-A")
    git(setup["repo"], "commit", "-qm", "log crash")
    with pytest.raises(evaluation.EvaluationRefused, match="intent entry but no completion"):
        setup["run"]()
