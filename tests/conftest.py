"""Shared test fixtures and path setup for CarabinerOS tests."""
import sys
from pathlib import Path

# Ensure project root is on sys.path so `import carabiner` resolves.
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))