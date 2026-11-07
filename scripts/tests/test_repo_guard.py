"""Tests for scripts/repo_guard.py.

Every test creates a throwaway Git repository in a temporary folder, stages
dummy files, and runs the guard there. No real secrets or health data are used:
fake secrets are assembled from pieces at runtime, so this test file itself
contains nothing that looks like a secret.

Run from the repository root with only the standard library:
    python -m unittest discover -s scripts/tests -v
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GUARD = REPO_ROOT / "scripts" / "repo_guard.py"
HOOKS_DIR = REPO_ROOT / ".githooks"

# Fake secret values, built from parts so no literal secret appears in source.
FAKE_AWS_KEY = "AKIA" + "TESTONLY" + "0000DUMY"           # 4 + 16 characters
FAKE_GITHUB_TOKEN = "ghp" + "_" + "x" * 36
FAKE_PRIVATE_KEY = "-----BEGIN " + "PRIVATE KEY" + "-----\nnot-a-real-key\n"
FAKE_PASSWORD_LINE = "pass" + "word = '" + "dummy-value-123" + "'"


class GuardTestCase(unittest.TestCase):
    """Creates a fresh temporary Git repository for each test."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="repo-guard-test-"))
        self.git("init", "-q")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.autocrlf", "false")

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    # -- helpers -----------------------------------------------------------

    def git(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(["git", *args], cwd=self.tmp, capture_output=True, text=True)

    def write(self, rel: str, content: str | bytes) -> None:
        path = self.tmp / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content, encoding="utf-8")

    def stage(self, rel: str, content: str | bytes) -> None:
        self.write(rel, content)
        # -f stages files even if a .gitignore would hide them: the guard
        # must catch what .gitignore cannot.
        result = self.git("add", "-f", rel)
        self.assertEqual(result.returncode, 0, result.stderr)

    def run_guard(self, mode: str = "--staged") -> subprocess.CompletedProcess[str]:
        return subprocess.run([sys.executable, str(GUARD), mode], cwd=self.tmp,
                              capture_output=True, text=True)

    def assertBlocked(self, rule: str) -> None:
        result = self.run_guard()
        self.assertEqual(result.returncode, 1, f"expected block, got:\n{result.stdout}{result.stderr}")
        self.assertIn(f"[{rule}]", result.stderr)

    def assertAllowed(self) -> None:
        result = self.run_guard()
        self.assertEqual(result.returncode, 0, f"expected pass, got:\n{result.stderr}")


class PathRuleTests(GuardTestCase):

    def test_ordinary_text_file_passes(self) -> None:
        self.stage("docs/notes.md", "# Notes\nNothing sensitive here.\n")
        self.assertAllowed()

    def test_research_data_folder_blocked(self) -> None:
        self.stage("research/data/dummy/readme.txt", "placeholder\n")
        self.assertBlocked("research data folder")

    def test_csv_outside_fixtures_blocked(self) -> None:
        self.stage("research/notebooks/labels.csv", "id,label\nSYN-0001,0\n")
        self.assertBlocked("data file")

    def test_csv_in_synthetic_fixtures_allowed(self) -> None:
        self.stage("research/tests/fixtures/synthetic/labels.csv", "id,label\nSYN-0001,0\n")
        self.assertAllowed()

    def test_compressed_nifti_detected(self) -> None:
        self.stage("scans/eye.nii.gz", b"\x1f\x8b\x08\x00dummy")
        self.assertBlocked("data file")

    def test_database_file_blocked(self) -> None:
        self.stage("companion/local.sqlite", b"SQLite format 3\x00dummy")
        self.assertBlocked("data file")

    def test_env_file_blocked(self) -> None:
        self.stage(".env", "KERATOTRACK_DATA_DIR=C:/somewhere\n")
        self.assertBlocked("environment file")

    def test_env_variant_blocked(self) -> None:
        self.stage("companion/.env.local", "X=1\n")
        self.assertBlocked("environment file")

    def test_env_example_allowed(self) -> None:
        self.stage(".env.example", "KERATOTRACK_DATA_DIR=\n")
        self.assertAllowed()

    def test_image_outside_allowed_folders_blocked(self) -> None:
        self.stage("research/figures/map.png", b"\x89PNG\r\n\x1a\n\x00dummy")
        self.assertBlocked("image file")

    def test_image_in_docs_images_allowed(self) -> None:
        self.stage("docs/images/screenshot.png", b"\x89PNG\r\n\x1a\n\x00dummy")
        self.assertAllowed()

    def test_svg_allowed_anywhere(self) -> None:
        self.stage("companion/src/icon.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>\n")
        self.assertAllowed()


class SizeRuleTests(GuardTestCase):

    def test_large_file_blocked(self) -> None:
        self.stage("docs/big.txt", "a" * 1_100_000)
        self.assertBlocked("large file")

    def test_package_lock_exempt(self) -> None:
        self.stage("companion/package-lock.json", "{" + " " * 1_100_000 + "}")
        self.assertAllowed()


class SecretRuleTests(GuardTestCase):

    def test_aws_key_blocked(self) -> None:
        self.stage("config.py", f"KEY_ID = '{FAKE_AWS_KEY}'\n")
        self.assertBlocked("possible secret")

    def test_github_token_blocked(self) -> None:
        self.stage("notes.md", f"token: {FAKE_GITHUB_TOKEN}\n")
        self.assertBlocked("possible secret")

    def test_private_key_blocked(self) -> None:
        self.stage("keys/id.txt", FAKE_PRIVATE_KEY)
        self.assertBlocked("possible secret")

    def test_generic_password_blocked(self) -> None:
        self.stage("settings.py", FAKE_PASSWORD_LINE + "\n")
        self.assertBlocked("possible secret")

    def test_allow_marker_suppresses_generic_check_only(self) -> None:
        self.stage("settings.py", FAKE_PASSWORD_LINE + "  # repo-guard: allow (test fixture)\n")
        self.assertAllowed()

    def test_allow_marker_does_not_hide_specific_patterns(self) -> None:
        self.stage("config.py", f"KEY_ID = '{FAKE_AWS_KEY}'  # repo-guard: allow\n")
        self.assertBlocked("possible secret")

    def test_checks_staged_content_not_working_copy(self) -> None:
        # Stage a secret, then remove it from the working copy only.
        self.stage("config.py", f"KEY_ID = '{FAKE_AWS_KEY}'\n")
        self.write("config.py", "KEY_ID = None\n")
        self.assertBlocked("possible secret")


class NotebookRuleTests(GuardTestCase):

    @staticmethod
    def notebook(outputs: list, execution_count: int | None) -> str:
        cell = {"cell_type": "code", "source": ["print('SYN-0001')"], "metadata": {},
                "outputs": outputs, "execution_count": execution_count}
        return json.dumps({"cells": [cell], "metadata": {}, "nbformat": 4, "nbformat_minor": 5})

    def test_notebook_with_outputs_blocked(self) -> None:
        outputs = [{"output_type": "stream", "name": "stdout", "text": ["SYN-0001\n"]}]
        self.stage("research/notebooks/audit.ipynb", self.notebook(outputs, 1))
        self.assertBlocked("notebook outputs")

    def test_clean_notebook_allowed(self) -> None:
        self.stage("research/notebooks/audit.ipynb", self.notebook([], None))
        self.assertAllowed()


class ModeAndHookTests(GuardTestCase):

    def test_all_mode_checks_committed_files(self) -> None:
        self.stage("docs/ok.md", "fine\n")
        self.git("commit", "-q", "-m", "ok", "--no-verify")
        self.assertEqual(self.run_guard("--all").returncode, 0)

    def test_guard_and_tests_pass_their_own_rules(self) -> None:
        # The guard's regexes and this test file must not trigger the guard.
        self.stage("scripts/repo_guard.py", GUARD.read_text(encoding="utf-8"))
        self.stage("scripts/tests/test_repo_guard.py", Path(__file__).read_text(encoding="utf-8"))
        self.assertAllowed()

    def test_hook_blocks_bad_commit_and_allows_good_commit(self) -> None:
        self.git("config", "core.hooksPath", HOOKS_DIR.as_posix())

        self.stage("research/data/x.txt", "placeholder\n")
        blocked = self.git("commit", "-m", "should be blocked")
        self.assertNotEqual(blocked.returncode, 0, "hook should have blocked the commit")
        self.assertIn("repo-guard: commit blocked", blocked.stderr)

        # "git restore --staged" needs an existing commit; before the first
        # commit, "git rm --cached" is the way to unstage.
        unstaged = self.git("rm", "-q", "--cached", "research/data/x.txt")
        self.assertEqual(unstaged.returncode, 0, unstaged.stderr)
        self.stage("docs/ok.md", "fine\n")
        allowed = self.git("commit", "-m", "should pass")
        self.assertEqual(allowed.returncode, 0, allowed.stderr)


if __name__ == "__main__":
    unittest.main()
