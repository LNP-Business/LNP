import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))                       # callqa_lite
sys.path.insert(0, str(ICI.parent.parent / "moteur"))     # lnp_callqa
sys.path.insert(0, str(ICI))
