"""Schema information container for TypeDB schema management."""

from type_bridge.attribute.base import Attribute
from type_bridge.models import Entity, Relation
from type_bridge.schema.diff import (
    AttributeFlagChange,
    EntityChanges,
    RelationChanges,
    SchemaDiff,
)


class SchemaInfo:
    """Container for organized schema information."""

    def __init__(self):
        """Initialize SchemaInfo with empty collections."""
        self.entities: list[type[Entity]] = []
        self.relations: list[type[Relation]] = []
        self.attribute_classes: set[type[Attribute]] = set()

    def to_typeql(self) -> str:
        """Generate TypeQL schema definition from collected schema information.

        Base classes (with base=True) are skipped as they don't appear in TypeDB schema.

        Returns:
            TypeQL schema definition string
        """
        lines = []

        # Define attributes first
        lines.append("define")
        lines.append("")

        # Sort attributes by name for consistent output
        sorted_attrs = sorted(self.attribute_classes, key=lambda x: x.get_attribute_name())
        for attr_class in sorted_attrs:
            lines.append(attr_class.to_schema_definition())

        lines.append("")

        # Define entities (skip base classes)
        for entity_model in self.entities:
            schema_def = entity_model.to_schema_definition()
            if schema_def is not None:  # Skip base classes
                lines.append(schema_def)
                lines.append("")

        # Define relations (skip base classes)
        for relation_model in self.relations:
            schema_def = relation_model.to_schema_definition()
            if schema_def is not None:  # Skip base classes
                lines.append(schema_def)

                # Add role player definitions
                for role_name, role in relation_model._roles.items():
                    player_type = role.player_type
                    lines.append(
                        f"{player_type} plays {relation_model.get_type_name()}:{role.role_name};"
                    )
                lines.append("")

        return "\n".join(lines)

    def compare(self, other: "SchemaInfo") -> SchemaDiff:
        """Compare this schema with another schema.

        Args:
            other: Another SchemaInfo to compare against

        Returns:
            SchemaDiff containing all differences between the schemas
        """
        diff = SchemaDiff()

        # Compare entities
        self_entity_set = set(self.entities)
        other_entity_set = set(other.entities)

        diff.added_entities = other_entity_set - self_entity_set
        diff.removed_entities = self_entity_set - other_entity_set

        # Compare entities that exist in both (for modifications)
        common_entities = self_entity_set & other_entity_set
        for entity in common_entities:
            entity_changes = self._compare_entity(entity, entity)
            if entity_changes:
                diff.modified_entities[entity] = entity_changes

        # Compare relations
        self_relation_set = set(self.relations)
        other_relation_set = set(other.relations)

        diff.added_relations = other_relation_set - self_relation_set
        diff.removed_relations = self_relation_set - other_relation_set

        # Compare relations that exist in both (for modifications)
        common_relations = self_relation_set & other_relation_set
        for relation in common_relations:
            relation_changes = self._compare_relation(relation, relation)
            if relation_changes:
                diff.modified_relations[relation] = relation_changes

        # Compare attributes
        diff.added_attributes = other.attribute_classes - self.attribute_classes
        diff.removed_attributes = self.attribute_classes - other.attribute_classes

        return diff

    def _compare_entity(
        self, self_entity: type[Entity], other_entity: type[Entity]
    ) -> EntityChanges | None:
        """Compare two entity types for differences.

        Args:
            self_entity: Entity from this schema
            other_entity: Entity from other schema

        Returns:
            EntityChanges with differences, or None if no changes
        """
        # Compare owned attributes
        self_attrs = self_entity.get_owned_attributes()
        other_attrs = other_entity.get_owned_attributes()

        added_attrs = list(set(other_attrs.keys()) - set(self_attrs.keys()))
        removed_attrs = list(set(self_attrs.keys()) - set(other_attrs.keys()))

        # Compare attribute flags for common attributes
        common_attrs = set(self_attrs.keys()) & set(other_attrs.keys())
        modified_attrs = []
        for attr_name in common_attrs:
            self_info = self_attrs[attr_name]
            other_info = other_attrs[attr_name]

            # Compare flags
            if self_info.flags != other_info.flags:
                modified_attrs.append(
                    AttributeFlagChange(
                        name=attr_name,
                        old_flags=str(self_info.flags.to_typeql_annotations()),
                        new_flags=str(other_info.flags.to_typeql_annotations()),
                    )
                )

        changes = EntityChanges(
            added_attributes=added_attrs,
            removed_attributes=removed_attrs,
            modified_attributes=modified_attrs,
        )

        return changes if changes.has_changes() else None

    def _compare_relation(
        self, self_relation: type[Relation], other_relation: type[Relation]
    ) -> RelationChanges | None:
        """Compare two relation types for differences.

        Args:
            self_relation: Relation from this schema
            other_relation: Relation from other schema

        Returns:
            RelationChanges with differences, or None if no changes
        """
        # Compare roles
        self_roles = set(self_relation._roles.keys())
        other_roles = set(other_relation._roles.keys())

        added_roles = list(other_roles - self_roles)
        removed_roles = list(self_roles - other_roles)

        # Compare owned attributes (same as entities)
        self_attrs = self_relation.get_owned_attributes()
        other_attrs = other_relation.get_owned_attributes()

        added_attrs = list(set(other_attrs.keys()) - set(self_attrs.keys()))
        removed_attrs = list(set(self_attrs.keys()) - set(other_attrs.keys()))

        changes = RelationChanges(
            added_roles=added_roles,
            removed_roles=removed_roles,
            added_attributes=added_attrs,
            removed_attributes=removed_attrs,
        )

        return changes if changes.has_changes() else None
