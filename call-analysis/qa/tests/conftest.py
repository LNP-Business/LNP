import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))                              # callqa_qa, run.py
sys.path.insert(0, str(HERE.parent.parent / "lite" / "tests"))    # the fictional call of the lite tests
import callqa_qa  # noqa: E402,F401
