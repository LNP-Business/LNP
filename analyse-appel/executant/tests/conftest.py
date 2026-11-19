import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent.parent / "moteur"))
sys.path.insert(0, str(ICI.parent))
sys.path.insert(0, str(ICI.parent.parent / "allege"))
