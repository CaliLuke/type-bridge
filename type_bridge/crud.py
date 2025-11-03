"""CRUD operations for TypeDB entities and relations."""

from datetime import datetime
from typing import Any, TypeVar

from type_bridge.models import Entity, Relation
from type_bridge.query import Query, QueryBuilder
from type_bridge.session import Database

E = TypeVar("E", bound=Entity)
R = TypeVar("R", bound=Relation)


class EntityManager[E: Entity]:
    """Manager for entity CRUD operations.

    Type-safe manager that preserves entity type information.
    """

    def __init__(self, db: Database, model_class: type[E]):
        """Initialize entity manager.

        Args:
            db: Database connection
            model_class: Entity model class
        """
        self.db = db
        self.model_class = model_class

    def insert(self, **attributes) -> E:
        """Insert a new entity into the database.

        Args:
            attributes: Entity attributes

        Returns:
            Inserted entity instance
        """
        instance = self.model_class(**attributes)
        query = QueryBuilder.insert_entity(instance)

        with self.db.transaction("write") as tx:
            tx.execute(query.build())
            tx.commit()

        return instance

    def insert_many(self, entities: list[E]) -> list[E]:
        """Insert multiple entities into the database in a single transaction.

        More efficient than calling insert() multiple times.

        Args:
            entities: List of entity instances to insert

        Returns:
            List of inserted entity instances

        Example:
            persons = [
                Person(name="Alice", email="alice@example.com"),
                Person(name="Bob", email="bob@example.com"),
                Person(name="Charlie", email="charlie@example.com"),
            ]
            Person.manager(db).insert_many(persons)
        """
        if not entities:
            return []

        # Build a single TypeQL query with multiple insert patterns
        insert_patterns = []
        for i, entity in enumerate(entities):
            # Use unique variable names for each entity
            var = f"$e{i}"
            pattern = entity.to_insert_query(var)
            insert_patterns.append(pattern)

        # Combine all patterns into a single insert query
        query = "insert\n" + ";\n".join(insert_patterns) + ";"

        with self.db.transaction("write") as tx:
            tx.execute(query)
            tx.commit()

        return entities

    def get(self, **filters) -> list[E]:
        """Get entities matching filters.

        Args:
            filters: Attribute filters

        Returns:
            List of matching entities
        """
        query = QueryBuilder.match_entity(self.model_class, **filters)
        query.fetch("$e")  # Fetch all attributes with $e.*

        with self.db.transaction("read") as tx:
            results = tx.execute(query.build())

        # Convert results to entity instances
        entities = []
        for result in results:
            # Extract attributes from result
            attrs = self._extract_attributes(result)
            entity = self.model_class(**attrs)
            entities.append(entity)

        return entities

    def filter(self, **filters) -> "EntityQuery[E]":
        """Create a query for filtering entities.

        Args:
            filters: Attribute filters

        Returns:
            EntityQuery for chaining
        """
        return EntityQuery(self.db, self.model_class, filters)

    def all(self) -> list[E]:
        """Get all entities of this type.

        Returns:
            List of all entities
        """
        return self.get()

    def delete(self, **filters) -> int:
        """Delete entities matching filters.

        Args:
            filters: Attribute filters

        Returns:
            Number of entities deleted
        """
        # First match the entities
        query = Query()
        pattern_parts = [f"$e isa {self.model_class.get_type_name()}"]

        for attr_name, attr_value in filters.items():
            formatted_value = self._format_value(attr_value)
            pattern_parts.append(f"has {attr_name} {formatted_value}")

        pattern = ", ".join(pattern_parts)
        query.match(pattern)
        query.delete("$e")

        with self.db.transaction("write") as tx:
            results = tx.execute(query.build())
            tx.commit()

        return len(results) if results else 0

    def _extract_attributes(self, result: dict[str, Any]) -> dict[str, Any]:
        """Extract attributes from query result.

        Args:
            result: Query result dictionary

        Returns:
            Dictionary of attributes
        """
        attrs = {}
        # Extract attributes from owned attribute classes
        owned_attrs = self.model_class.get_owned_attributes()
        for field_name, attr_info in owned_attrs.items():
            attr_class = attr_info.typ
            attr_name = attr_class.get_attribute_name()
            if attr_name in result:
                attrs[field_name] = result[attr_name]
            else:
                # For optional fields, explicitly set to None if not present
                attrs[field_name] = None
        return attrs

    @staticmethod
    def _format_value(value: Any) -> str:
        """Format a Python value for TypeQL."""
        if isinstance(value, str):
            return f'"{value}"'
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, datetime):
            # TypeDB datetime format: YYYY-MM-DDTHH:MM:SS
            return value.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            return f'"{str(value)}"'


class EntityQuery[E: Entity]:
    """Chainable query for entities.

    Type-safe query builder that preserves entity type information.
    """

    def __init__(self, db: Database, model_class: type[E], filters: dict[str, Any]):
        """Initialize entity query.

        Args:
            db: Database connection
            model_class: Entity model class
            filters: Attribute filters
        """
        self.db = db
        self.model_class = model_class
        self.filters = filters
        self._limit_value: int | None = None
        self._offset_value: int | None = None

    def limit(self, limit: int) -> "EntityQuery[E]":
        """Limit number of results.

        Args:
            limit: Maximum number of results

        Returns:
            Self for chaining
        """
        self._limit_value = limit
        return self

    def offset(self, offset: int) -> "EntityQuery[E]":
        """Skip number of results.

        Args:
            offset: Number of results to skip

        Returns:
            Self for chaining
        """
        self._offset_value = offset
        return self

    def execute(self) -> list[E]:
        """Execute the query.

        Returns:
            List of matching entities
        """
        query = QueryBuilder.match_entity(self.model_class, **self.filters)
        query.fetch("$e")  # Fetch all attributes with $e.*

        if self._limit_value is not None:
            query.limit(self._limit_value)
        if self._offset_value is not None:
            query.offset(self._offset_value)

        with self.db.transaction("read") as tx:
            results = tx.execute(query.build())

        # Convert results to entity instances
        entities = []
        owned_attrs = self.model_class.get_owned_attributes()
        for result in results:
            # Extract attributes from result
            attrs = {}
            for field_name, attr_info in owned_attrs.items():
                attr_class = attr_info.typ
                attr_name = attr_class.get_attribute_name()
                if attr_name in result:
                    attrs[field_name] = result[attr_name]
                else:
                    # For optional fields, explicitly set to None if not present
                    attrs[field_name] = None
            entity = self.model_class(**attrs)
            entities.append(entity)

        return entities

    def first(self) -> E | None:
        """Get first matching entity.

        Returns:
            First entity or None
        """
        results = self.limit(1).execute()
        return results[0] if results else None

    def count(self) -> int:
        """Count matching entities.

        Returns:
            Number of matching entities
        """
        return len(self.execute())


class RelationManager[R: Relation]:
    """Manager for relation CRUD operations.

    Type-safe manager that preserves relation type information.
    """

    def __init__(self, db: Database, model_class: type[R]):
        """Initialize relation manager.

        Args:
            db: Database connection
            model_class: Relation model class
        """
        self.db = db
        self.model_class = model_class

    def insert(self, role_players: dict[str, Any], attributes: dict[str, Any] | None = None) -> R:
        """Insert a new relation into the database.

        Args:
            role_players: Dictionary mapping role names to player entities (Entity instances)
            attributes: Optional dictionary of relation attributes

        Returns:
            Inserted relation instance

        Example:
            employment_manager = RelationManager(db, Employment)
            employment = employment_manager.insert(
                role_players={"employee": person, "employer": company},
                attributes={"position": "Engineer", "salary": 100000}
            )
        """
        # Build the query
        query = Query()

        # First, we need to match the role players by their key attributes
        match_clauses = []
        role_var_map = {}

        for role_attr_name, player_entity in role_players.items():
            # Get the role from the model class
            role = self.model_class._roles.get(role_attr_name)
            if not role:
                raise ValueError(f"Unknown role: {role_attr_name}")

            # Create a variable for this player
            player_var = f"$player_{role_attr_name}"
            role_var_map[role_attr_name] = (player_var, role.role_name)

            # Match the player by their key attributes
            player_type = player_entity.get_type_name()
            owned_attrs = player_entity.get_owned_attributes()

            # Find key attributes to match
            match_parts = [f"{player_var} isa {player_type}"]
            for field_name, attr_info in owned_attrs.items():
                attr_class = attr_info.typ
                flags = attr_info.flags
                if flags.is_key:
                    value = getattr(player_entity, field_name, None)
                    if value is not None:
                        attr_name = attr_class.get_attribute_name()
                        formatted_value = self._format_value(value)
                        match_parts.append(f"has {attr_name} {formatted_value}")

            match_clauses.append(", ".join(match_parts))

        # Add all match clauses
        for match_clause in match_clauses:
            query.match(match_clause)

        # Build insert clause for the relation
        # TypeQL 3.x syntax: (role: $player, ...) isa relation_type (NO VARIABLE!)
        role_players_str = ', '.join([f'{role_name}: {var}' for var, role_name in role_var_map.values()])
        insert_pattern = f"({role_players_str}) isa {self.model_class.get_type_name()}"

        # Add attributes if provided
        if attributes:
            attr_parts = []
            for field_name, attr_value in attributes.items():
                # Skip None values for optional attributes
                if attr_value is None:
                    continue
                # Get the attribute class from the model to get the correct TypeQL name
                owned_attrs = self.model_class.get_owned_attributes()
                if field_name in owned_attrs:
                    attr_info = owned_attrs[field_name]
                    typeql_attr_name = attr_info.typ.get_attribute_name()
                    formatted_value = self._format_value(attr_value)
                    attr_parts.append(f"has {typeql_attr_name} {formatted_value}")
            insert_pattern += ", " + ", ".join(attr_parts)

        query.insert(insert_pattern)

        # Execute the query
        query_str = query.build()
        with self.db.transaction("write") as tx:
            tx.execute(query_str)
            tx.commit()

        # Create and return instance
        # Note: Don't pass role_players to __init__ as they are ClassVar fields
        # Only pass attributes
        instance_kwargs = attributes if attributes else {}

        return self.model_class(**instance_kwargs)

    def insert_many(self, relations: list[R]) -> list[R]:
        """Insert multiple relations into the database in a single transaction.

        More efficient than calling insert() multiple times.

        Args:
            relations: List of relation instances to insert

        Returns:
            List of inserted relation instances

        Example:
            employments = [
                Employment(
                    position="Engineer",
                    salary=100000,
                    employee=alice,
                    employer=tech_corp
                ),
                Employment(
                    position="Manager",
                    salary=120000,
                    employee=bob,
                    employer=tech_corp
                ),
            ]
            Employment.manager(db).insert_many(employments)
        """
        if not relations:
            return []

        # Build query
        query = Query()

        # Collect all unique role players to match
        all_players = {}  # key: (entity_type, key_attr_values) -> player_var
        player_counter = 0

        # First pass: collect all unique players from all relation instances
        for relation in relations:
            # Extract role players from instance
            for role_name, role in self.model_class._roles.items():
                player_entity = relation.__dict__.get(role_name)
                if player_entity is None:
                    continue
                # Create unique key for this player based on key attributes
                player_type = player_entity.get_type_name()
                owned_attrs = player_entity.get_owned_attributes()

                key_values = []
                for field_name, attr_info in owned_attrs.items():
                    if attr_info.flags.is_key:
                        value = getattr(player_entity, field_name, None)
                        if value is not None:
                            attr_name = attr_info.typ.get_attribute_name()
                            key_values.append((attr_name, value))

                player_key = (player_type, tuple(sorted(key_values)))

                if player_key not in all_players:
                    player_var = f"$player{player_counter}"
                    player_counter += 1
                    all_players[player_key] = player_var

                    # Build match clause for this player
                    match_parts = [f"{player_var} isa {player_type}"]
                    for attr_name, value in key_values:
                        formatted_value = self._format_value(value)
                        match_parts.append(f"has {attr_name} {formatted_value}")

                    query.match(", ".join(match_parts))

        # Second pass: build insert patterns for relations
        insert_patterns = []

        for i, relation in enumerate(relations):
            # Map role players to their variables
            role_var_map = {}
            for role_name, role in self.model_class._roles.items():
                player_entity = relation.__dict__.get(role_name)
                if player_entity is None:
                    raise ValueError(f"Missing role player for role: {role_name}")

                # Find the player variable
                player_type = player_entity.get_type_name()
                owned_attrs = player_entity.get_owned_attributes()

                key_values = []
                for field_name, attr_info in owned_attrs.items():
                    if attr_info.flags.is_key:
                        value = getattr(player_entity, field_name, None)
                        if value is not None:
                            attr_name = attr_info.typ.get_attribute_name()
                            key_values.append((attr_name, value))

                player_key = (player_type, tuple(sorted(key_values)))
                player_var = all_players[player_key]
                role_var_map[role_name] = (player_var, role.role_name)

            # Build insert pattern for this relation
            role_players_str = ', '.join([f'{role_name}: {var}' for var, role_name in role_var_map.values()])
            insert_pattern = f"({role_players_str}) isa {self.model_class.get_type_name()}"

            # Extract and add attributes from relation instance
            attr_parts = []
            for field_name in self.model_class._owned_attrs:
                if hasattr(relation, field_name):
                    attr_value = getattr(relation, field_name)
                    if attr_value is None:
                        continue

                    # Extract raw value from Attribute instances
                    if hasattr(attr_value, 'value'):
                        attr_value = attr_value.value

                    owned_attrs = self.model_class.get_owned_attributes()
                    if field_name in owned_attrs:
                        attr_info = owned_attrs[field_name]
                        typeql_attr_name = attr_info.typ.get_attribute_name()
                        formatted_value = self._format_value(attr_value)
                        attr_parts.append(f"has {typeql_attr_name} {formatted_value}")

            if attr_parts:
                insert_pattern += ", " + ", ".join(attr_parts)

            insert_patterns.append(insert_pattern)

        # Add all insert patterns to query
        query.insert(";\n".join(insert_patterns))

        # Execute the query
        query_str = query.build()
        with self.db.transaction("write") as tx:
            tx.execute(query_str)
            tx.commit()

        return relations

    @staticmethod
    def _format_value(value: Any) -> str:
        """Format a Python value for TypeQL."""
        if isinstance(value, str):
            return f'"{value}"'
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, datetime):
            # TypeDB datetime format: YYYY-MM-DDTHH:MM:SS
            return value.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            return f'"{str(value)}"'

    def get(self, **filters) -> list[R]:
        """Get relations matching filters.

        Supports filtering by both attributes and role players.

        Args:
            filters: Attribute filters and/or role player filters
                - Attribute filters: position="Engineer", salary=100000, is_remote=True
                - Role player filters: employee=person_entity, employer=company_entity

        Returns:
            List of matching relations

        Example:
            # Filter by attribute
            Employment.manager(db).get(position="Engineer")

            # Filter by role player
            Employment.manager(db).get(employee=alice)

            # Filter by both
            Employment.manager(db).get(position="Manager", employer=tech_corp)
        """
        # Build TypeQL 3.x query with correct syntax for fetching relations with role players
        owned_attrs = self.model_class.get_owned_attributes()

        # Separate attribute filters from role player filters
        attr_filters = {}
        role_player_filters = {}

        for key, value in filters.items():
            if key in self.model_class._roles:
                # This is a role player filter
                role_player_filters[key] = value
            elif key in owned_attrs:
                # This is an attribute filter
                attr_filters[key] = value
            else:
                raise ValueError(f"Unknown filter: {key}")

        # Build match clause with inline role players
        role_parts = []
        role_info = {}  # role_name -> (var, entity_class)
        for role_name, role in self.model_class._roles.items():
            role_var = f"${role_name}"
            role_parts.append(f"{role.role_name}: {role_var}")
            role_info[role_name] = (role_var, role.player_entity_type)

        roles_str = ", ".join(role_parts)
        match_clauses = [f"$r isa {self.model_class.get_type_name()} ({roles_str})"]

        # Add attribute filter clauses
        for field_name, value in attr_filters.items():
            attr_info = owned_attrs[field_name]
            attr_name = attr_info.typ.get_attribute_name()
            formatted_value = self._format_value(value)
            match_clauses.append(f"$r has {attr_name} {formatted_value}")

        # Add role player filter clauses
        for role_name, player_entity in role_player_filters.items():
            role_var = f"${role_name}"
            entity_class = role_info[role_name][1]

            # Match the role player by their key attributes
            player_owned_attrs = entity_class.get_owned_attributes()
            for field_name, attr_info in player_owned_attrs.items():
                if attr_info.flags.is_key:
                    key_value = getattr(player_entity, field_name, None)
                    if key_value is not None:
                        attr_name = attr_info.typ.get_attribute_name()
                        # Extract value from Attribute instance if needed
                        if hasattr(key_value, 'value'):
                            key_value = key_value.value
                        formatted_value = self._format_value(key_value)
                        match_clauses.append(f"{role_var} has {attr_name} {formatted_value}")
                        break

        match_str = ";\n".join(match_clauses) + ";"

        # Build fetch clause with nested structure for role players
        fetch_items = []

        # Add relation attributes
        for field_name, attr_info in owned_attrs.items():
            attr_name = attr_info.typ.get_attribute_name()
            fetch_items.append(f'"{attr_name}": $r.{attr_name}')

        # Add each role player as nested object
        for role_name, (role_var, entity_class) in role_info.items():
            fetch_items.append(f'"{role_name}": {{\n    {role_var}.*\n  }}')

        fetch_body = ",\n  ".join(fetch_items)
        fetch_str = f"fetch {{\n  {fetch_body}\n}};"

        query_str = f"match\n{match_str}\n{fetch_str}"

        with self.db.transaction("read") as tx:
            results = tx.execute(query_str)

        # Convert results to relation instances
        relations = []

        for result in results:
            # Extract relation attributes
            attrs = {}
            for field_name, attr_info in owned_attrs.items():
                attr_class = attr_info.typ
                attr_name = attr_class.get_attribute_name()
                if attr_name in result:
                    attrs[field_name] = result[attr_name]
                else:
                    attrs[field_name] = None

            # Create relation instance
            relation = self.model_class(**attrs)

            # Extract role players from nested objects in result
            for role_name, (role_var, entity_class) in role_info.items():
                if role_name in result and isinstance(result[role_name], dict):
                    player_data = result[role_name]
                    # Extract player attributes
                    player_attrs = {}
                    for field_name, attr_info in entity_class.get_owned_attributes().items():
                        attr_class = attr_info.typ
                        attr_name = attr_class.get_attribute_name()
                        if attr_name in player_data:
                            player_attrs[field_name] = player_data[attr_name]
                        else:
                            player_attrs[field_name] = None

                    # Create entity instance and assign to role
                    if any(v is not None for v in player_attrs.values()):
                        player_entity = entity_class(**player_attrs)
                        setattr(relation, role_name, player_entity)

            relations.append(relation)

        return relations
