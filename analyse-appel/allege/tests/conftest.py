import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))                       # analyse_allegee
sys.path.insert(0, str(ICI.parent.parent / "moteur"))     # lnp_analyse
sys.path.insert(0, str(ICI))
