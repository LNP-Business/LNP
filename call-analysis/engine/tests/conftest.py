"""Test harness only (no rule): the Annex B tests read real transcripts that are kept out of git (CLAUDE.md).
CI downloads them from the private Storage bucket callqa-fixtures. When they are absent and CALLQA_SKIP_MISSING_CORPUS=1,
a test that fails only because a transcript file is missing is reported as skipped instead of failed."""
import os

import pytest


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if os.environ.get("CALLQA_SKIP_MISSING_CORPUS") == "1" and call.excinfo is not None \
            and call.excinfo.errisinstance(FileNotFoundError) and "transcript_compact" in str(call.excinfo.value):
        rep.outcome, rep.longrepr = "skipped", (str(item.fspath), 0, "Skipped: real transcripts not available")
