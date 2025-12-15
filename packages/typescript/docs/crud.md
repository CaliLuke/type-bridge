# CRUD Operations

This document covers the CRUD (Create, Read, Update, Delete) operations provided by EntityManager, RelationManager, and their query builders.

## Table of Contents

- [EntityManager](#entitymanager)
- [EntityQuery](#entityquery)
- [RelationManager](#relationmanager)
- [RelationQuery](#relationquery)
- [Filter Operators](#filter-operators)
- [Exceptions](#exceptions)

## EntityManager

EntityManager provides CRUD operations for entities.

### Getting a Manager

```typescript
import { Database } from 'type-bridge-ts';

const db = new Database({ /* config */ });
await db.connect();

// Get manager from entity class
const personManager = Person.manager(db);

// Or with transaction context
await db.transaction(async (tx) => {
  const manager = Person.manager(tx);
  // Use manager within transaction
});
```

### Create Operations

#### insert()

Insert a single entity:

```typescript
const person = new Person({ name: 'Alice', age: 30 });
await personManager.insert(person);
```

#### insertMany()

Insert multiple entities:

```typescript
const people = [
  new Person({ name: 'Alice', age: 30 }),
  new Person({ name: 'Bob', age: 25 }),
  new Person({ name: 'Carol', age: 35 }),
];
await personManager.insertMany(people);
```

#### put()

Idempotent upsert - insert if not exists, or match existing:

```typescript
// Uses key attributes to check existence
await personManager.put(new Person({ id: 'P001', name: 'Alice', age: 30 }));

// If entity with id='P001' exists, this is a no-op
// If not, it inserts the entity
```

#### putMany()

Idempotent upsert for multiple entities:

```typescript
await personManager.putMany([person1, person2, person3]);
```

### Read Operations

#### all()

Get all entities of this type:

```typescript
const allPeople = await personManager.all();
console.log(`Found ${allPeople.length} people`);
```

#### get()

Get a single entity by filters (throws if not exactly one):

```typescript
try {
  const alice = await personManager.get({ name: 'Alice' });
  console.log(alice.age.value);
} catch (error) {
  if (error instanceof EntityNotFoundError) {
    console.log('No person named Alice');
  } else if (error instanceof NotUniqueError) {
    console.log('Multiple people named Alice');
  }
}
```

#### one()

Alias for get():

```typescript
const alice = await personManager.one({ name: 'Alice' });
```

#### first()

Get the first matching entity (or undefined):

```typescript
const firstAdult = await personManager.first({ age__gte: 18 });
if (firstAdult) {
  console.log(firstAdult.name.value);
}
```

#### filter()

Get all entities matching filters:

```typescript
const adults = await personManager.filter({ age__gte: 18 });
const activeUsers = await personManager.filter({ status: 'active' });
```

### Update Operations

#### update()

Update entities matching filters:

```typescript
// Update all people named Alice
await personManager.update(
  { name: 'Alice' },           // Filter
  { age: new Age(31) }         // Updates
);
```

**Note:** Key attributes cannot be updated.

### Delete Operations

#### delete()

Delete entities matching filters:

```typescript
// Delete specific entity
await personManager.delete({ name: 'Alice' });

// Delete all inactive users
await personManager.delete({ status: 'inactive' });
```

#### deleteMany()

Delete multiple specific entities:

```typescript
const toDelete = await personManager.filter({ status: 'inactive' });
await personManager.deleteMany(toDelete);
```

### Query Builder

#### query()

Get a chainable query builder:

```typescript
const query = personManager.query();
const results = await query
  .filter({ age__gte: 18 })
  .orderBy('name')
  .limit(10)
  .all();
```

## EntityQuery

EntityQuery provides a chainable API for building complex queries.

### Basic Usage

```typescript
const results = await Person.manager(db)
  .query()
  .filter({ age__gte: 18 })
  .filter({ status: 'active' })
  .orderBy('name', '-age')
  .offset(10)
  .limit(20)
  .all();
```

### Methods

#### filter()

Add filter conditions:

```typescript
query.filter({ name: 'Alice' });           // Exact match
query.filter({ age__gt: 30 });             // Greater than
query.filter({ status__in: ['a', 'b'] });  // In list

// Multiple filters (AND)
query.filter({ age__gte: 18, status: 'active' });

// Chained filters (also AND)
query.filter({ age__gte: 18 }).filter({ age__lte: 65 });
```

#### orderBy()

Sort results:

```typescript
query.orderBy('name');          // Ascending by name
query.orderBy('-age');          // Descending by age (prefix with -)
query.orderBy('name', '-age');  // Multiple sorts
```

#### limit()

Limit result count:

```typescript
query.limit(10);  // Max 10 results
```

#### offset()

Skip results (requires sorting):

```typescript
query.offset(20);  // Skip first 20 results

// Pagination example
query.orderBy('name').offset(20).limit(10);  // Page 3 (items 21-30)
```

### Execution Methods

#### all()

Execute and return all results:

```typescript
const people: Person[] = await query.all();
```

#### first()

Execute and return first result:

```typescript
const person: Person | undefined = await query.first();
```

#### one()

Execute and return exactly one result (throws if not exactly one):

```typescript
const person: Person = await query.one();  // Throws if 0 or >1 results
```

#### count()

Count matching results:

```typescript
const count: number = await query.filter({ status: 'active' }).count();
```

#### delete()

Delete all matching results:

```typescript
const deletedCount: number = await query
  .filter({ status: 'inactive' })
  .delete();
```

## RelationManager

RelationManager provides CRUD operations for relations.

### Getting a Manager

```typescript
const employmentManager = Employment.manager(db);
```

### Create Operations

#### insert()

Insert a relation with role players:

```typescript
const alice = new Person({ name: 'Alice' });
const acme = new Company({ name: 'ACME' });

const employment = new Employment({
  employee: alice,
  employer: acme,
  startDate: new Date('2024-01-15'),
});

await employmentManager.insert(employment);
```

#### put()

Idempotent upsert for relations:

```typescript
await employmentManager.put(employment);
```

### Read Operations

Similar to EntityManager:

```typescript
// All relations
const allEmployments = await employmentManager.all();

// Filter by relation attributes
const recentHires = await employmentManager.filter({
  startDate__gte: new Date('2024-01-01'),
});

// Filter by role player attributes (using double underscore)
const aliceJobs = await employmentManager.filter({
  employee__name: 'Alice',
});
```

### Role Player Filtering

Filter by role player attributes using `role__attribute` syntax:

```typescript
// Filter by employee's name
const query = employmentManager.query()
  .filter({ employee__name: 'Alice' });

// Filter by employee's age
const seniorEmployees = await employmentManager.query()
  .filter({ employee__age__gte: 50 })
  .all();

// Filter by employer's name
const acmeEmployees = await employmentManager.query()
  .filter({ employer__name: 'ACME Corp' })
  .all();

// Combine relation and role player filters
const highPaidAtAcme = await employmentManager.query()
  .filter({
    employer__name: 'ACME Corp',
    salary__gte: 100000,
  })
  .all();
```

### Delete Operations

```typescript
// Delete by relation attributes
await employmentManager.delete({ salary__lt: 30000 });

// Delete by role player
await employmentManager.delete({ employee__name: 'Alice' });
```

## RelationQuery

RelationQuery extends EntityQuery with role player support.

### Role Player Filters

```typescript
const query = Employment.manager(db)
  .query()
  .filter({
    employee__age__gte: 25,      // Role player attribute
    employer__name: 'ACME',      // Role player attribute
    salary__gte: 50000,          // Relation attribute
  })
  .orderBy('startDate')
  .limit(10);

const results = await query.all();
```

### Accessing Role Players in Results

```typescript
const employments = await employmentManager.all();

for (const emp of employments) {
  console.log(`${emp.employee.name.value} works at ${emp.employer.name.value}`);
  console.log(`  Salary: ${emp.salary?.value}`);
}
```

## Filter Operators

Django-style lookup operators for filtering.

### Syntax

```
field__operator: value
```

### Available Operators

| Operator | Description | Example |
|----------|-------------|---------|
| (none) / `exact` / `eq` | Exact match | `{ name: 'Alice' }` |
| `gt` | Greater than | `{ age__gt: 30 }` |
| `gte` | Greater than or equal | `{ age__gte: 18 }` |
| `lt` | Less than | `{ age__lt: 65 }` |
| `lte` | Less than or equal | `{ score__lte: 100 }` |
| `contains` | String contains | `{ name__contains: 'ali' }` |
| `in` | Value in list | `{ status__in: ['active', 'pending'] }` |

### Examples

```typescript
// Exact match (default)
query.filter({ name: 'Alice' });
query.filter({ name__exact: 'Alice' });
query.filter({ name__eq: 'Alice' });

// Numeric comparisons
query.filter({ age__gt: 30 });   // age > 30
query.filter({ age__gte: 30 });  // age >= 30
query.filter({ age__lt: 65 });   // age < 65
query.filter({ age__lte: 65 });  // age <= 65

// String contains
query.filter({ email__contains: '@example.com' });

// In list
query.filter({ status__in: ['active', 'pending', 'review'] });

// Combining operators
query.filter({
  age__gte: 18,
  age__lte: 65,
  status: 'active',
});
```

### Role Player Operators

For relations, operators work on role player attributes:

```typescript
// employee.age > 30
query.filter({ employee__age__gt: 30 });

// employee.name contains 'Smith'
query.filter({ employee__name__contains: 'Smith' });
```

## Exceptions

### CrudError

Base class for all CRUD errors.

```typescript
import { CrudError } from 'type-bridge-ts';

try {
  await manager.get({ name: 'Unknown' });
} catch (error) {
  if (error instanceof CrudError) {
    console.log('CRUD operation failed:', error.message);
  }
}
```

### EntityNotFoundError

Thrown when entity is not found.

```typescript
import { EntityNotFoundError } from 'type-bridge-ts';

try {
  await personManager.get({ name: 'Unknown' });
} catch (error) {
  if (error instanceof EntityNotFoundError) {
    console.log(`Entity type: ${error.entityType}`);
    console.log(`Operation: ${error.operation}`);
    console.log(`Details: ${error.details}`);
  }
}
```

### RelationNotFoundError

Thrown when relation is not found.

```typescript
import { RelationNotFoundError } from 'type-bridge-ts';

try {
  await employmentManager.get({ employee__name: 'Unknown' });
} catch (error) {
  if (error instanceof RelationNotFoundError) {
    console.log(`Relation type: ${error.relationType}`);
  }
}
```

### NotUniqueError

Thrown when expecting one result but found multiple.

```typescript
import { NotUniqueError } from 'type-bridge-ts';

try {
  await personManager.get({ status: 'active' });  // Multiple matches
} catch (error) {
  if (error instanceof NotUniqueError) {
    console.log(`Found ${error.matchCount} matches`);
  }
}
```

### KeyAttributeError

Thrown when trying to update a key attribute.

```typescript
import { KeyAttributeError } from 'type-bridge-ts';

try {
  await personManager.update(
    { name: 'Alice' },
    { id: 'new-id' }  // Can't update key!
  );
} catch (error) {
  if (error instanceof KeyAttributeError) {
    console.log(`Cannot update key field: ${error.fieldName}`);
    console.log(`Available fields: ${error.availableFields?.join(', ')}`);
  }
}
```

### InvalidFilterError

Thrown when using an invalid filter field.

```typescript
import { InvalidFilterError } from 'type-bridge-ts';

try {
  await personManager.filter({ unknownField: 'value' });
} catch (error) {
  if (error instanceof InvalidFilterError) {
    console.log(`Invalid field: ${error.fieldName}`);
    console.log(`Available fields: ${error.availableFields?.join(', ')}`);
  }
}
```

## Complete Example

```typescript
import {
  Database,
  Entity,
  Relation,
  Role,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
  EntityNotFoundError,
  NotUniqueError,
} from 'type-bridge-ts';

// Define models (see models.md)
// ...

async function main() {
  const db = new Database({
    address: 'localhost:1729',
    database: 'example',
  });

  await db.connect();

  try {
    const personManager = Person.manager(db);
    const employmentManager = Employment.manager(db);

    // Create
    const alice = new Person({ id: 'P001', name: 'Alice', age: 30 });
    const bob = new Person({ id: 'P002', name: 'Bob', age: 25 });
    await personManager.insertMany([alice, bob]);

    const acme = new Company({ name: 'ACME Corp' });
    await Company.manager(db).insert(acme);

    await employmentManager.insert(new Employment({
      employee: alice,
      employer: acme,
      salary: 75000,
    }));

    // Read
    const allPeople = await personManager.all();
    console.log(`Total people: ${allPeople.length}`);

    const adults = await personManager.query()
      .filter({ age__gte: 18 })
      .orderBy('name')
      .all();

    // Find by key
    try {
      const person = await personManager.get({ id: 'P001' });
      console.log(`Found: ${person.name.value}`);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        console.log('Person not found');
      }
    }

    // Update
    await personManager.update({ id: 'P001' }, { age: new Age(31) });

    // Delete
    await personManager.delete({ id: 'P002' });

    // Query with role player filter
    const acmeEmployees = await employmentManager.query()
      .filter({ employer__name: 'ACME Corp' })
      .filter({ salary__gte: 50000 })
      .orderBy('-salary')
      .all();

    for (const emp of acmeEmployees) {
      console.log(`${emp.employee.name.value}: $${emp.salary?.value}`);
    }

  } finally {
    await db.close();
  }
}

main().catch(console.error);
```
