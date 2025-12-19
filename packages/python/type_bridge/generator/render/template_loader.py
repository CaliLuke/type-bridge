"""Jinja2 template loader for code generation."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

from jinja2 import Environment, FileSystemLoader

if TYPE_CHECKING:
    from jinja2 import Template

# Template directory relative to this file
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"


def _render_annotation_value(value: Any) -> str:
    """Render an annotation value as Python literal."""
    if isinstance(value, bool):
        return "True" if value else "False"
    elif isinstance(value, str):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    elif isinstance(value, (int, float)):
        return repr(value)
    elif isinstance(value, list):
        items = ", ".join(_render_annotation_value(v) for v in value)
        return f"[{items}]"
    else:
        return repr(value)


@lru_cache(maxsize=1)
def _get_environment() -> Environment:
    """Get the Jinja2 environment with custom filters."""
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )
    # Custom filters
    env.filters["repr"] = repr
    env.filters["render_annotation"] = _render_annotation_value
    return env


def get_template(name: str) -> Template:
    """Load a template by name.

    Args:
        name: Template filename (e.g., "attributes.py.jinja")

    Returns:
        Loaded Jinja2 Template object
    """
    env = _get_environment()
    return env.get_template(name)
