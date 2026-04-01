"""Shared output formatting — JSON for agents, Rich tables for humans."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID


def _default_serializer(obj: Any) -> Any:
    """JSON serializer for types not handled by the default encoder."""
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def is_json_mode(json_flag: bool) -> bool:
    """Return True when output should be JSON (explicit flag or piped stdout)."""
    return json_flag or not sys.stdout.isatty()


def print_json(data: Any) -> None:
    """Print JSON to stdout."""
    sys.stdout.write(json.dumps(data, default=_default_serializer, indent=2))
    sys.stdout.write("\n")
    sys.stdout.flush()


def print_error(code: int, message: str, error_type: str) -> None:
    """Print a structured error to stderr as JSON."""
    payload = {"error": {"code": code, "message": message, "type": error_type}}
    sys.stderr.write(json.dumps(payload))
    sys.stderr.write("\n")
    sys.stderr.flush()


def print_table(rows: list[dict[str, Any]], columns: list[str], title: str | None = None) -> None:
    """Print a Rich table if available, otherwise a plain-text table."""
    try:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        table = Table(title=title, show_lines=False)
        for col in columns:
            table.add_column(col)
        for row in rows:
            table.add_row(*[_format_cell(row.get(col)) for col in columns])
        console.print(table)
    except ImportError:
        # Fallback: plain-text aligned output
        if title:
            print(f"\n  {title}")
            print("  " + "-" * len(title))
        header = "  ".join(col.ljust(20) for col in columns)
        print(header)
        print("-" * len(header))
        for row in rows:
            line = "  ".join(_format_cell(row.get(col)).ljust(20) for col in columns)
            print(line)


def print_detail(data: dict[str, Any], title: str | None = None) -> None:
    """Print a single record as key-value pairs."""
    try:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        table = Table(title=title, show_header=False, show_lines=False)
        table.add_column("Field", style="bold")
        table.add_column("Value")
        for key, value in data.items():
            table.add_row(key, _format_cell(value))
        console.print(table)
    except ImportError:
        if title:
            print(f"\n  {title}")
            print("  " + "-" * len(title))
        for key, value in data.items():
            print(f"  {key}: {_format_cell(value)}")


def _format_cell(value: Any) -> str:
    """Format a cell value for display."""
    if value is None:
        return "-"
    if isinstance(value, UUID):
        return str(value)[:8] + "..."
    if isinstance(value, Decimal):
        return f"{float(value):.2f}"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, list):
        return f"[{len(value)} items]"
    if isinstance(value, dict):
        return f"{{{len(value)} keys}}"
    return str(value)
