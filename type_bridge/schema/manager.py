"""Schema manager for TypeDB schema operations."""

from type_bridge.models import Entity, Relation
from type_bridge.schema.exceptions import SchemaConflictError
from type_bridge.schema.info import SchemaInfo
from type_bridge.session import Database


class SchemaManager:
    """Manager for database schema operations."""

    db: Database
    registered_models: list[type[Entity | Relation]]

    def __init__(self, db: Database):
        """Initialize schema manager.

        Args:
            db: Database connection
        """
        self.db = db
        self.registered_models = []

    def register(self, *models: type) -> None:
        """Register model classes for schema management.

        Args:
            models: Model classes to register
        """
        for model in models:
            if model not in self.registered_models:
                self.registered_models.append(model)

    def collect_schema_info(self) -> SchemaInfo:
        """Collect schema information from registered models.

        Returns:
            SchemaInfo with entities, relations, and attributes
        """
        schema_info = SchemaInfo()

        for model in self.registered_models:
            if issubclass(model, Entity) and model is not Entity:
                schema_info.entities.append(model)
            elif issubclass(model, Relation) and model is not Relation:
                schema_info.relations.append(model)

            # Collect all attribute classes owned by this model
            owned_attrs = model.get_owned_attributes()
            for field_name, attr_info in owned_attrs.items():
                schema_info.attribute_classes.add(attr_info.typ)

        return schema_info

    def generate_schema(self) -> str:
        """Generate complete TypeQL schema definition.

        Returns:
            TypeQL schema definition string
        """
        # Collect schema information and generate TypeQL
        schema_info = self.collect_schema_info()
        return schema_info.to_typeql()

    def has_existing_schema(self) -> bool:
        """Check if database has existing schema defined.

        Returns:
            True if database exists and has custom schema beyond built-in types
        """
        if not self.db.database_exists():
            return False

        # Query for custom entity, relation, or attribute types
        # Built-in types: thing, entity, relation, attribute
        query = """
        match
        $x sub thing;
        fetch
        $x: label;
        """

        try:
            with self.db.transaction("read") as tx:
                results = list(tx.execute(query))

                # Check if there are any user-defined types
                # Built-ins include: thing, entity, relation, attribute
                built_in_types = {"thing", "entity", "relation", "attribute"}

                for result in results:
                    # Extract label from result
                    if hasattr(result, "get"):
                        label = result.get("x", {}).get("label")
                    else:
                        # Handle different result formats
                        continue

                    if label and label not in built_in_types:
                        return True

                return False
        except Exception:
            # If query fails, assume no schema
            return False

    def introspect_current_schema_info(self) -> SchemaInfo | None:
        """Introspect current database schema and build SchemaInfo.

        Note: This is a best-effort attempt. It cannot perfectly reconstruct
        Python class hierarchies from TypeDB schema.

        Returns:
            SchemaInfo with current schema, or None if database doesn't exist
        """
        if not self.db.database_exists():
            return None

        # For now, we return None and rely on has_existing_schema()
        # Full reconstruction would require complex TypeDB schema introspection
        return None

    def verify_compatibility(self, old_schema_info: SchemaInfo) -> None:
        """Verify that new schema is compatible with old schema.

        Checks for breaking changes (removed or modified types/attributes)
        and raises SchemaConflictError if found.

        Args:
            old_schema_info: The previous schema to compare against

        Raises:
            SchemaConflictError: If breaking changes are detected
        """
        new_schema_info = self.collect_schema_info()
        diff = old_schema_info.compare(new_schema_info)

        # Check for breaking changes
        has_breaking_changes = bool(
            diff.removed_entities
            or diff.removed_relations
            or diff.removed_attributes
            or diff.modified_entities
            or diff.modified_relations
        )

        if has_breaking_changes:
            raise SchemaConflictError(diff)

    def sync_schema(self, force: bool = False) -> None:
        """Synchronize database schema with registered models.

        Automatically checks for existing schema in the database and raises
        SchemaConflictError if schema already exists and might conflict.

        Args:
            force: If True, recreate database from scratch, ignoring conflicts

        Raises:
            SchemaConflictError: If database has existing schema and force=False
        """
        # Check for existing schema before making changes
        if not force and self.has_existing_schema():
            # Create a minimal diff to show the error
            from type_bridge.schema.diff import SchemaDiff

            diff = SchemaDiff()
            # We can't build full diff without introspecting, but we know there's existing schema
            raise SchemaConflictError(
                diff,
                message=(
                    "Schema conflict detected! Database already has existing schema.\n"
                    "\n"
                    "Cannot safely sync schema because the database contains existing types.\n"
                    "This could lead to:\n"
                    "  - Data loss if types are removed\n"
                    "  - Schema conflicts if types are modified\n"
                    "  - Undefined behavior if ownership changes\n"
                    "\n"
                    "Resolution options:\n"
                    "1. Use sync_schema(force=True) to recreate database from scratch (⚠️  DATA LOSS)\n"
                    "2. Manually drop the existing database first\n"
                    "3. Use MigrationManager for incremental schema changes\n"
                    "4. Start with an empty database\n"
                ),
            )

        if force:
            # Delete and recreate database
            if self.db.database_exists():
                self.db.delete_database()
            self.db.create_database()

        # Ensure database exists
        if not self.db.database_exists():
            self.db.create_database()

        # Generate and apply schema
        schema = self.generate_schema()

        with self.db.transaction("schema") as tx:
            tx.execute(schema)
            tx.commit()

    def drop_schema(self) -> None:
        """Drop all schema definitions."""
        if self.db.database_exists():
            self.db.delete_database()

    def introspect_schema(self) -> dict[str, list[str]]:
        """Introspect current database schema.

        Returns:
            Dictionary of schema information
        """
        # Query to get all types
        query = """
        match
        $x sub thing;
        fetch
        $x: label;
        """

        with self.db.transaction("read") as tx:
            results = tx.execute(query)

        schema_info = {"entities": [], "relations": [], "attributes": []}

        for result in results:
            # Parse result to categorize types
            # This is a simplified implementation
            pass

        return schema_info
