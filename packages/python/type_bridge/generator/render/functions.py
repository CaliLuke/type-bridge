"""Render function definitions from parsed schema."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from ..naming import to_python_name
from .template_loader import get_template

if TYPE_CHECKING:
    from ..models import FunctionSpec, ParsedSchema

# TypeDB type -> Python type hint
TYPE_MAPPING = {
    "string": "str",
    "integer": "int",
    "int": "int",
    "long": "int",
    "double": "float",
    "boolean": "bool",
    "bool": "bool",
    "date": "date",
    "datetime": "datetime",
    "datetime-tz": "datetime",
    "decimal": "Decimal",
    "duration": "Duration",
}


@dataclass
class FunctionContext:
    """Context for rendering a single function."""

    name: str
    py_name: str
    params: list[str]
    return_hint: str
    docstring: str | None
    stream_info: str
    type_info: str
    args: list[str] = field(default_factory=list)


def _get_python_type(type_name: str, for_param: bool = True) -> str:
    """Get Python type hint for TypeDB type."""
    is_optional = type_name.endswith("?")
    if is_optional:
        type_name = type_name[:-1]

    base = TYPE_MAPPING.get(type_name, type_name)

    if is_optional:
        base = f"{base} | None"

    if for_param:
        return f"{base} | Expression"
    return base


def _parse_return_type(return_type: str) -> tuple[bool, list[str]]:
    """Parse return type string into components."""
    is_stream = return_type.startswith("{") and return_type.endswith("}")
    if is_stream:
        inner = return_type[1:-1].strip()
    else:
        inner = return_type

    types = [t.strip() for t in inner.split(",")]
    return is_stream, types


def _get_return_type_hint(return_type: str) -> str:
    """Convert TypeDB return type to Python type hint for FunctionCallExpr generic."""
    is_stream, types = _parse_return_type(return_type)

    py_types = [_get_python_type(t, for_param=False) for t in types]

    if len(py_types) == 1:
        inner_type = py_types[0]
    else:
        inner_type = f"tuple[{', '.join(py_types)}]"

    if is_stream:
        return f"FunctionCallExpr[Iterator[{inner_type}]]"
    return f"FunctionCallExpr[{inner_type}]"


def _build_function_context(name: str, spec: FunctionSpec) -> FunctionContext:
    """Build template context for a single function."""
    py_name = to_python_name(name)

    params = []
    args = []
    for p in spec.parameters:
        p_name = to_python_name(p.name)
        p_type = _get_python_type(p.type, for_param=True)
        params.append(f"{p_name}: {p_type}")
        args.append(p_name)

    return_hint = _get_return_type_hint(spec.return_type)
    is_stream, types = _parse_return_type(spec.return_type)
    stream_info = "stream of " if is_stream else ""
    type_info = ", ".join(types)

    return FunctionContext(
        name=name,
        py_name=py_name,
        params=params,
        return_hint=return_hint,
        docstring=spec.docstring,
        stream_info=stream_info,
        type_info=type_info,
        args=args,
    )


def render_functions(schema: ParsedSchema) -> str:
    """Render the complete functions module."""
    if not schema.functions:
        return ""

    functions = []
    all_names = []
    for name, spec in schema.functions.items():
        py_name = to_python_name(name)
        all_names.append(py_name)
        functions.append(_build_function_context(name, spec))

    template = get_template("functions.py.jinja")
    return template.render(
        functions=functions,
        all_names=all_names,
    )
