"""Render struct class definitions from parsed schema."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from .template_loader import get_template

if TYPE_CHECKING:
    from ..models import ParsedSchema

logger = logging.getLogger(__name__)

# Mapping from TypeDB value types to Python types
STRUCT_VALUE_TYPE_MAP: dict[str, str] = {
    "string": "str",
    "integer": "int",
    "int": "int",
    "long": "int",
    "double": "float",
    "boolean": "bool",
    "bool": "bool",
    "datetime": "datetime",
    "datetime-tz": "datetime",
    "date": "date",
    "decimal": "Decimal",
    "duration": "str",  # Duration as ISO 8601 string
}


@dataclass
class StructFieldContext:
    """Context for rendering a single struct field."""

    name: str
    python_name: str
    python_type: str
    optional: bool


@dataclass
class StructContext:
    """Context for rendering a single struct class."""

    class_name: str
    typedb_name: str
    docstring: str
    fields: list[StructFieldContext]


def _to_snake_case(name: str) -> str:
    """Convert kebab-case or PascalCase to snake_case."""
    # First replace hyphens with underscores
    result = name.replace("-", "_")
    # Then handle PascalCase -> snake_case
    import re

    result = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", result)
    result = re.sub("([a-z0-9])([A-Z])", r"\1_\2", result)
    return result.lower()


def _build_struct_context(
    struct_name: str,
    schema: ParsedSchema,
    class_names: dict[str, str],
) -> StructContext:
    """Build template context for a single struct."""
    struct = schema.structs[struct_name]
    cls_name = class_names[struct_name]

    docstring = struct.docstring if struct.docstring else f"Struct for `{struct_name}`."

    fields = []
    for field in struct.fields:
        python_type = STRUCT_VALUE_TYPE_MAP.get(field.value_type, "str")
        if field.optional:
            python_type = f"{python_type} | None"

        fields.append(
            StructFieldContext(
                name=field.name,
                python_name=_to_snake_case(field.name),
                python_type=python_type,
                optional=field.optional,
            )
        )

    return StructContext(
        class_name=cls_name,
        typedb_name=struct_name,
        docstring=docstring,
        fields=fields,
    )


def _get_required_imports(schema: ParsedSchema) -> set[str]:
    """Determine which imports are needed."""
    imports: set[str] = set()

    for struct in schema.structs.values():
        for field in struct.fields:
            if field.value_type in ("datetime", "datetime-tz"):
                imports.add("datetime")
            elif field.value_type == "date":
                imports.add("date")
            elif field.value_type == "decimal":
                imports.add("Decimal")

    return imports


def render_structs(schema: ParsedSchema, class_names: dict[str, str]) -> str:
    """Render the complete structs module source.

    Args:
        schema: Parsed schema containing struct definitions
        class_names: Mapping from TypeDB names to Python class names

    Returns:
        Complete Python source code for structs.py, or empty string if no structs
    """
    if not schema.structs:
        return ""

    logger.debug(f"Rendering {len(schema.structs)} struct classes")

    imports = _get_required_imports(schema)
    datetime_imports = sorted(imports & {"datetime", "date"})
    decimal_import = "Decimal" in imports

    structs = []
    all_names = []
    for struct_name in sorted(schema.structs.keys()):
        all_names.append(class_names[struct_name])
        structs.append(_build_struct_context(struct_name, schema, class_names))

    template = get_template("structs.py.jinja")
    result = template.render(
        datetime_imports=datetime_imports,
        decimal_import=decimal_import,
        structs=structs,
        all_names=sorted(all_names),
    )

    logger.info(f"Rendered {len(all_names)} struct classes")
    return result
