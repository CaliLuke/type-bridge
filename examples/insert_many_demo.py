"""Demonstration of insert_many for bulk insertions.

This example shows how to use insert_many for efficient bulk insertions:
1. EntityManager.insert_many(entities: List[E])
2. RelationManager.insert_many(relations: List[R])
"""

from type_bridge import (
    Entity,
    EntityFlags,
    Flag,
    Integer,
    Key,
    Relation,
    RelationFlags,
    Role,
    String,
)
from type_bridge.schema import SchemaManager
from type_bridge.session import Database


# Define attribute types
class Name(String):
    pass


class Email(String):
    pass


class Age(Integer):
    pass


class Position(String):
    pass


class Salary(Integer):
    pass


# Define entities
class Person(Entity):
    flags = EntityFlags(type_name="person")

    name: Name = Flag(Key)
    email: Email
    age: Age | None


class Company(Entity):
    flags = EntityFlags(type_name="company")

    name: Name = Flag(Key)


# Define relation
class Employment(Relation):
    flags = RelationFlags(type_name="employment")

    employee: Role[Person] = Role("employee", Person)
    employer: Role[Company] = Role("employer", Company)

    position: Position
    salary: Salary | None


def main():
    """Demonstrate insert_many functionality."""
    print("=" * 70)
    print("insert_many() Bulk Insertion Demo")
    print("=" * 70)

    # Setup database
    db = Database(address="localhost:1729", database="insert_many_demo")
    db.connect()

    if db.database_exists():
        db.delete_database()

    db.create_database()

    # Create schema
    print("\n1. Creating schema...")
    print("-" * 70)
    schema_manager = SchemaManager(db)
    schema_manager.register(Person, Company, Employment)
    schema_manager.sync_schema()
    print("✓ Schema created")

    # Test 1: EntityManager.insert_many()
    print("\n2. Testing EntityManager.insert_many()...")
    print("-" * 70)

    # Create multiple person instances
    persons = [
        Person(name=Name("Alice Johnson"), email=Email("alice@example.com"), age=Age(30)),
        Person(name=Name("Bob Smith"), email=Email("bob@example.com"), age=Age(35)),
        Person(name=Name("Charlie Brown"), email=Email("charlie@example.com"), age=None),
        Person(name=Name("Diana Prince"), email=Email("diana@example.com"), age=Age(28)),
        Person(name=Name("Eve Adams"), email=Email("eve@example.com"), age=Age(32)),
    ]

    # Insert all at once
    inserted_persons = Person.manager(db).insert_many(persons)
    print(f"✓ Inserted {len(inserted_persons)} persons in a single transaction:")
    for person in inserted_persons:
        age_str = f"{person.age.value}" if person.age else "None"
        print(f"  - {person.name.value} ({person.email.value}), age: {age_str}")

    # Test 2: EntityManager.insert_many() for companies
    print("\n3. Testing EntityManager.insert_many() for companies...")
    print("-" * 70)

    companies = [
        Company(name=Name("TechCorp")),
        Company(name=Name("StartupCo")),
        Company(name=Name("MegaIndustries")),
    ]

    inserted_companies = Company.manager(db).insert_many(companies)
    print(f"✓ Inserted {len(inserted_companies)} companies in a single transaction:")
    for company in inserted_companies:
        print(f"  - {company.name.value}")

    # Test 3: RelationManager.insert_many()
    print("\n4. Testing RelationManager.insert_many()...")
    print("-" * 70)

    # Create multiple employment relations
    employments = [
        Employment(
            position=Position("Senior Engineer"),
            salary=Salary(120000),
            employee=persons[0],  # Alice
            employer=companies[0],  # TechCorp
        ),
        Employment(
            position=Position("Product Manager"),
            salary=Salary(130000),
            employee=persons[1],  # Bob
            employer=companies[0],  # TechCorp
        ),
        Employment(
            position=Position("Founder"),
            salary=None,
            employee=persons[2],  # Charlie
            employer=companies[1],  # StartupCo
        ),
        Employment(
            position=Position("Designer"),
            salary=Salary(95000),
            employee=persons[3],  # Diana
            employer=companies[1],  # StartupCo
        ),
        Employment(
            position=Position("CTO"),
            salary=Salary(180000),
            employee=persons[4],  # Eve
            employer=companies[2],  # MegaIndustries
        ),
    ]

    inserted_employments = Employment.manager(db).insert_many(employments)
    print(f"✓ Inserted {len(inserted_employments)} employment relations in a single transaction:")
    for i, emp in enumerate(inserted_employments):
        person = persons[i]
        company = companies[0 if i < 2 else 1 if i < 4 else 2]
        salary_str = f"${emp.salary.value:,}" if emp.salary else "undisclosed"
        print(
            f"  - {person.name.value} at {company.name.value} as {emp.position.value} ({salary_str})"
        )

    # Test 4: Verify data was inserted
    print("\n5. Verifying insertions...")
    print("-" * 70)

    all_persons = Person.manager(db).all()
    all_companies = Company.manager(db).all()

    print(f"✓ Total persons in database: {len(all_persons)}")
    print(f"✓ Total companies in database: {len(all_companies)}")

    # Summary
    print("\n" + "=" * 70)
    print("Performance Benefits of insert_many()")
    print("=" * 70)
    print("• Single transaction for multiple insertions")
    print("• Reduces network roundtrips to database")
    print("• More efficient than multiple insert() calls")
    print("• Maintains data consistency within transaction")
    print("\nComparison:")
    print("  insert() 5x:  5 transactions, 5 network roundtrips")
    print("  insert_many:  1 transaction, 1 network roundtrip ✓")
    print("=" * 70)

    # Cleanup
    db.delete_database()
    db.close()


if __name__ == "__main__":
    main()
