"""Integration tests for schema inheritance."""

import pytest

from type_bridge import Entity, EntityFlags, Flag, Key, SchemaManager, String


@pytest.mark.integration
@pytest.mark.order(6)
def test_schema_inheritance(clean_db):
    """Test schema creation with entity inheritance."""

    class Name(String):
        pass

    class Animal(Entity):
        flags = EntityFlags(type_name="animal", abstract=True)
        name: Name = Flag(Key)

    class Species(String):
        pass

    class Dog(Animal):
        flags = EntityFlags(type_name="dog")
        species: Species

    # Create and sync schema
    schema_manager = SchemaManager(clean_db)
    schema_manager.register(Animal, Dog)
    schema_manager.sync_schema(force=True)

    # Verify schema
    schema_info = schema_manager.collect_schema_info()

    entity_names = {e.get_type_name() for e in schema_info.entities}
    assert "animal" in entity_names
    assert "dog" in entity_names

    # Verify dog inherits from animal
    dog_entity = [e for e in schema_info.entities if e.get_type_name() == "dog"][0]
    dog_owned_attrs = dog_entity.get_owned_attributes()
    # Dog should own both name (inherited) and species
    assert "name" in dog_owned_attrs
    assert "species" in dog_owned_attrs
