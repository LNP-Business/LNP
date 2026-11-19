"""Outillage des tests seulement (aucune règle) : les tests de l'annexe B lisent de vraies transcriptions gardées hors de
git (CLAUDE.md). L'intégration continue les télécharge depuis le compartiment de stockage privé callqa-fixtures. Quand elles
sont absentes et que CALLQA_SKIP_MISSING_CORPUS=1, un test qui échoue seulement parce qu'un fichier de transcription manque
est compté comme ignoré au lieu d'échoué."""
import os

import pytest


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    issue = yield
    rep_ = issue.get_result()
    if os.environ.get("CALLQA_SKIP_MISSING_CORPUS") == "1" and call.excinfo is not None \
            and call.excinfo.errisinstance(FileNotFoundError) and "transcript_compact" in str(call.excinfo.value):
        rep_.outcome, rep_.longrepr = "skipped", (str(item.fspath), 0, "Ignoré : vraies transcriptions absentes")
