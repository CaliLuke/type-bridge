"""TypeDB schema management - modular schema utilities.

This package provides schema management functionality for TypeBridge, including:
- Schema comparison and diff (SchemaDiff, EntityChanges, RelationChanges)
- Schema information container (SchemaInfo)
- Schema management (SchemaManager)
- Schema migrations (MigrationManager)
- Schema exceptions (SchemaConflictError)
"""

from type_bridge.schema.diff import (
    AttributeFlagChange,
    EntityChanges,
    RelationChanges,
    SchemaDiff,
)
from type_bridge.schema.exceptions import SchemaConflictError
from type_bridge.schema.info import SchemaInfo
from type_bridge.schema.manager import SchemaManager
from type_bridge.schema.migration import MigrationManager

__all__ = [
    # Diff classes
    "SchemaDiff",
    "EntityChanges",
    "RelationChanges",
    "AttributeFlagChange",
    # Info container
    "SchemaInfo",
    # Managers
    "SchemaManager",
    "MigrationManager",
    # Exceptions
    "SchemaConflictError",
]
