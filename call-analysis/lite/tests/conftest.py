import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))                       # callqa_lite
sys.path.insert(0, str(HERE.parent.parent / "engine"))     # alkimiy_callqa
sys.path.insert(0, str(HERE))
