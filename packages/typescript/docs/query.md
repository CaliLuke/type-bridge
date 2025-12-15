# Query Builder

The Query Builder provides a low-level API for constructing TypeQL queries programmatically.

## Table of Contents

- [Query Class](#query-class)
- [QueryBuilder Class](#querybuilder-class)
- [Building Queries](#building-queries)
- [Value Formatting](#value-formatting)

## Query Class

The `Query` class provides a fluent interface for building TypeQL queries.

### Creating a Query

```typescript
import { Query } from 'type-bridge-ts';

const query = new Query();
```

### Match Clause

```typescript
const query = new Query()
  .match('$p isa person')
  .match('$p has name $n');

console.log(query.build());
// match
// $p isa person;
// $p has name $n;
```

### Fetch Clause

```typescript
const query = new Query()
  .match('$p isa person')
  .fetch('$p.*');

console.log(query.build());
// match
// $p isa person;
// fetch {
//   $p.*
// };
```

### Insert Clause

```typescript
const query = new Query()
  .insert('$p isa person, has name "Alice", has age 30');

console.log(query.build());
// insert
// $p isa person, has name "Alice", has age 30;
```

### Delete Clause

```typescript
const query = new Query()
  .match('$p isa person, has name "Alice"')
  .delete('$p');

console.log(query.build());
// match
// $p isa person, has name "Alice";
// delete
// $p;
```

### Sort Clause

```typescript
const query = new Query()
  .match('$p isa person, has age $a')
  .sort('$a', 'asc');

console.log(query.build());
// match
// $p isa person, has age $a;
// sort $a asc;
```

Multiple sorts:

```typescript
const query = new Query()
  .match('$p isa person, has name $n, has age $a')
  .sort('$n', 'asc')
  .sort('$a', 'desc');

console.log(query.build());
// match
// $p isa person, has name $n, has age $a;
// sort $n asc, $a desc;
```

### Limit and Offset

```typescript
const query = new Query()
  .match('$p isa person')
  .fetch('$p.*')
  .offset(10)
  .limit(20);

console.log(query.build());
// match
// $p isa person;
// offset 10;
// limit 20;
// fetch {
//   $p.*
// };
```

### Complete Example

```typescript
const query = new Query()
  .match('$p isa person')
  .match('$p has age $a')
  .match('$a >= 18')
  .sort('$a', 'desc')
  .offset(0)
  .limit(10)
  .fetch('$p.*');

console.log(query.build());
// match
// $p isa person;
// $p has age $a;
// $a >= 18;
// sort $a desc;
// offset 0;
// limit 10;
// fetch {
//   $p.*
// };
```

### toString()

Alias for `build()`:

```typescript
const queryString = query.toString();
// Same as query.build()
```

## QueryBuilder Class

The `QueryBuilder` provides higher-level methods for common query patterns.

### matchEntity

Create a match query for an entity:

```typescript
import { QueryBuilder } from 'type-bridge-ts';

// Basic match
const query = QueryBuilder.matchEntity(Person);
console.log(query.build());
// match
// $e isa person;

// With custom variable
const query2 = QueryBuilder.matchEntity(Person, '$person');
console.log(query2.build());
// match
// $person isa person;

// With filters
const query3 = QueryBuilder.matchEntity(Person, '$e', { name: 'Alice', age: 30 });
console.log(query3.build());
// match
// $e isa person;
// $e has name "Alice";
// $e has age 30;
```

### insertEntity

Create an insert query from an entity instance:

```typescript
const person = new Person({ name: 'Alice', age: 30 });

const query = QueryBuilder.insertEntity(person);
console.log(query.build());
// insert
// $e isa person, has name "Alice", has age 30;

// With custom variable
const query2 = QueryBuilder.insertEntity(person, '$person');
console.log(query2.build());
// insert
// $person isa person, has name "Alice", has age 30;
```

### matchRelation

Create a match query for a relation:

```typescript
const query = QueryBuilder.matchRelation(Employment);
console.log(query.build());
// match
// $r (employee: $employee, employer: $employer) isa employment;

// With role players
const query2 = QueryBuilder.matchRelation(Employment, '$r', {
  employee: alice,
  employer: acme,
});
```

### deleteEntity

Create a delete query for an entity:

```typescript
const query = QueryBuilder.deleteEntity(Person, { name: 'Alice' });
console.log(query.build());
// match
// $e isa person;
// $e has name "Alice";
// delete
// $e;
```

### updateAttribute

Create an update query for an attribute:

```typescript
const query = QueryBuilder.updateAttribute(
  Person,
  { name: 'Alice' },  // Filter
  'age',              // Field to update
  new Age(31)         // New value
);
console.log(query.build());
// match
// $e isa person;
// $e has name "Alice";
// $e has age $old_age;
// delete
// $e has $old_age;
// insert
// $e has age 31;
```

### Chaining with Query

QueryBuilder methods return Query objects that can be chained:

```typescript
const query = QueryBuilder.matchEntity(Person, '$p', { status: 'active' })
  .sort('$p_name', 'asc')
  .limit(10)
  .fetch('$p.*');

console.log(query.build());
```

## Building Queries

### Manual Query Construction

For complex queries, build manually:

```typescript
const query = new Query()
  .match('$p isa person')
  .match('$p has name $n')
  .match('$p has age $a')
  .match('$a >= 18')
  .match('$a <= 65')
  .match('$n contains "Smith"')
  .sort('$a', 'desc')
  .limit(100)
  .fetch('$p.*');
```

### Pattern Helpers

Common patterns:

```typescript
// Entity with all attributes
const matchWithAttrs = (typeName: string, varName: string, attrs: string[]) => {
  const query = new Query().match(`${varName} isa ${typeName}`);
  for (const attr of attrs) {
    query.match(`${varName} has ${attr} ${varName}_${attr}`);
  }
  return query;
};

// Relation with role players
const matchRelation = (relName: string, roles: Record<string, string>) => {
  const rolePatterns = Object.entries(roles)
    .map(([role, varName]) => `${role}: ${varName}`)
    .join(', ');
  return new Query().match(`$r (${rolePatterns}) isa ${relName}`);
};
```

### Reduce Queries

For aggregations:

```typescript
const query = new Query()
  .match('$p isa person')
  .match('$p has age $a');

// Add reduce clause manually
const countQuery = query.build() + '\nreduce $count = count;';

const sumQuery = query.build() + '\nreduce $total = sum($a);';
```

## Value Formatting

### formatValue / formatQueryValue

Format values for TypeQL:

```typescript
import { formatQueryValue } from 'type-bridge-ts';

// Strings - quoted and escaped
formatQueryValue('hello');         // "hello"
formatQueryValue('say "hi"');      // "say \"hi\""
formatQueryValue('path\\file');    // "path\\file"

// Numbers - as-is
formatQueryValue(42);              // 42
formatQueryValue(3.14);            // 3.14
formatQueryValue(-10);             // -10

// Booleans - lowercase
formatQueryValue(true);            // true
formatQueryValue(false);           // false

// Dates - ISO format
formatQueryValue(new Date('2024-01-15T10:30:00Z'));
// 2024-01-15T10:30:00.000Z

// Attribute instances - extract value
formatQueryValue(new Name('Alice'));  // "Alice"
formatQueryValue(new Age(30));        // 30
```

### In Queries

Use formatted values in query construction:

```typescript
import { Query, formatQueryValue } from 'type-bridge-ts';

const name = 'Alice';
const age = 30;

const query = new Query()
  .match('$p isa person')
  .match(`$p has name ${formatQueryValue(name)}`)
  .match(`$p has age ${formatQueryValue(age)}`);
```

## Complete Example

```typescript
import {
  Query,
  QueryBuilder,
  formatQueryValue,
  Database,
} from 'type-bridge-ts';

async function queryExamples(db: Database) {
  // 1. Simple entity query
  const simpleQuery = QueryBuilder.matchEntity(Person, '$p', { status: 'active' })
    .fetch('$p.*')
    .build();

  const result1 = await db.executeQuery(simpleQuery, 'read');

  // 2. Complex manual query
  const complexQuery = new Query()
    .match('$p isa person')
    .match('$p has age $age')
    .match('$age >= 18')
    .match('$age <= 65')
    .match('$p has status "active"')
    .sort('$age', 'desc')
    .limit(50)
    .fetch('$p.*')
    .build();

  const result2 = await db.executeQuery(complexQuery, 'read');

  // 3. Insert query
  const insertQuery = new Query()
    .insert(`$p isa person, has name ${formatQueryValue('Bob')}, has age ${formatQueryValue(25)}`)
    .build();

  await db.executeQuery(insertQuery, 'write');

  // 4. Update query (delete + insert pattern)
  const updateQuery = new Query()
    .match('$p isa person')
    .match(`$p has name ${formatQueryValue('Bob')}`)
    .match('$p has age $old_age')
    .delete('$p has $old_age')
    .insert(`$p has age ${formatQueryValue(26)}`)
    .build();

  await db.executeQuery(updateQuery, 'write');

  // 5. Delete query
  const deleteQuery = new Query()
    .match('$p isa person')
    .match(`$p has name ${formatQueryValue('Bob')}`)
    .delete('$p')
    .build();

  await db.executeQuery(deleteQuery, 'write');

  // 6. Aggregation query
  const aggQuery = new Query()
    .match('$p isa person')
    .match('$p has age $a')
    .build() + '\nreduce $avg = mean($a), $count = count;';

  const result3 = await db.executeQuery(aggQuery, 'read');
  console.log('Average age:', result3.rows[0]?.['avg']);
  console.log('Count:', result3.rows[0]?.['count']);

  // 7. Relation query
  const relationQuery = new Query()
    .match('$r (employee: $e, employer: $c) isa employment')
    .match('$e has name $en')
    .match('$c has name $cn')
    .fetch('$en, $cn')
    .build();

  const result4 = await db.executeQuery(relationQuery, 'read');
}
```

## TypeQL Reference

Common TypeQL patterns used by the query builder:

### Match Patterns

```typeql
-- Entity
$p isa person;

-- With attribute
$p isa person, has name "Alice";

-- Attribute binding
$p has name $n;

-- Comparison
$a >= 18;
$n contains "Smith";

-- Relation
$r (employee: $e, employer: $c) isa employment;
```

### Modifiers

```typeql
-- Sort
sort $a asc;
sort $n asc, $a desc;

-- Pagination
offset 10;
limit 20;
```

### Fetch

```typeql
-- All attributes
fetch { $p.* };

-- Specific attributes
fetch { $p.name, $p.age };

-- Multiple variables
fetch { $e.*, $c.* };
```

### Insert

```typeql
-- Entity
insert $p isa person, has name "Alice", has age 30;

-- Relation
insert $r (employee: $e, employer: $c) isa employment;
```

### Delete

```typeql
-- Entity
delete $p;

-- Attribute
delete $p has $old_age;
```

### Reduce (Aggregation)

```typeql
reduce $count = count;
reduce $sum = sum($a);
reduce $avg = mean($a);
reduce $min = min($a), $max = max($a);
```
