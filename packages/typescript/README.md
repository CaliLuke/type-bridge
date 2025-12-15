# @type-bridge/type-bridge

TypeScript ORM for TypeDB - A complete port of the [type_bridge](https://github.com/ds1sqe/type-bridge) Python library.

[![npm](https://img.shields.io/npm/v/@type-bridge/type-bridge)](https://www.npmjs.com/package/@type-bridge/type-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@type-bridge/type-bridge` provides a full-featured Object-Relational Mapper (ORM) for TypeDB, enabling TypeScript/JavaScript applications to interact with TypeDB using type-safe abstractions over TypeQL.

## Installation

```bash
npm install @type-bridge/type-bridge
```

## Quick Start

```typescript
import {
  Database,
  Entity,
  Relation,
  Role,
  StringAttribute,
  IntegerAttribute,
  TypeFlags,
  AttributeFlags,
  Flag,
  Key,
} from '@type-bridge/type-bridge';

// 1. Define attribute types
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

// 2. Define entity
class Person extends Entity {
  static override flags = new TypeFlags({ name: 'person' });

  declare name: Name;
  declare age: Age;

  static {
    this.ownedAttributes = new Map([
      ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
      ['age', { typ: Age, flags: new AttributeFlags() }],
    ]);
  }
}

// 3. Connect to database
const db = new Database({
  address: 'localhost:1729',
  database: 'mydb',
  username: 'admin',
  password: 'password',
});

await db.connect();

// 4. CRUD operations
const manager = Person.manager(db);
await manager.insert(new Person({ name: new Name('Alice'), age: new Age(30) }));

const people = await manager.query()
  .filter({ age__gt: 25 })
  .orderBy('name')
  .all();

await db.close();
```

## Features

### Attribute Types

All TypeDB value types are supported:

| TypeScript Class | TypeDB Type | Description |
|-----------------|-------------|-------------|
| `StringAttribute` | `string` | Unicode text |
| `IntegerAttribute` | `integer` | 64-bit signed integer |
| `DoubleAttribute` | `double` | 64-bit floating point |
| `BooleanAttribute` | `boolean` | true/false |
| `DateTimeAttribute` | `datetime` | Date and time (no timezone) |
| `DateTimeTZAttribute` | `datetime-tz` | Date and time with timezone |
| `DateAttribute` | `date` | Date only |
| `DecimalAttribute` | `decimal` | Arbitrary-precision decimal |
| `DurationAttribute` | `duration` | ISO 8601 duration |

### Flag System

TypeDB annotations are supported via the Flag system:

```typescript
import { Flag, Key, Unique, Card, AttributeFlags } from '@type-bridge/type-bridge';

// @key - Unique identifier
const keyFlag = Flag(Key);

// @unique - Unique constraint
const uniqueFlag = Flag(Unique);

// @card(min..max) - Cardinality constraints
const atLeastTwo = Flag(new Card({ min: 2 }));        // @card(2..)
const exactlyOne = Flag(new Card(1, 1));              // @card(1..1)
const optionalMultiple = Flag(new Card(0, 5));        // @card(0..5)
```

### Entity & Relation Models

Define type-safe entities and relations:

```typescript
// Entity with typed attributes
class Person extends Entity {
  static override flags = new TypeFlags({ name: 'person' });
  declare name: Name;
  declare email: Email;
}

// Relation with role players
class Employment extends Relation {
  static override flags = new TypeFlags({ name: 'employment' });

  static override roles = new Map([
    ['employee', new Role('employee', [Person])],
    ['employer', new Role('employer', [Company])],
  ]);
}
```

### CRUD Operations

Full CRUD support via EntityManager and RelationManager:

```typescript
const manager = Person.manager(db);

// Create
await manager.insert(person);
await manager.insertMany([person1, person2]);

// Read
const all = await manager.all();
const one = await manager.get({ name: 'Alice' });
const first = await manager.first({ age__gt: 30 });

// Update
await manager.update({ name: 'Alice' }, { age: new Age(31) });

// Delete
await manager.delete({ name: 'Alice' });

// Idempotent upsert
await manager.put(person);
```

### Chainable Query Builder

Build complex queries with a fluent API:

```typescript
const results = await Person.manager(db)
  .query()
  .filter({ age__gte: 18, age__lte: 65 })
  .filter({ status: 'active' })
  .orderBy('name', '-age')  // '-' prefix for descending
  .offset(10)
  .limit(20)
  .all();

// Count
const count = await manager.query().filter({ status: 'active' }).count();

// Delete matching
const deleted = await manager.query().filter({ status: 'inactive' }).delete();
```

### Filter Operators

Django-style lookup operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `exact` / `eq` | Exact match (default) | `{ name: 'Alice' }` |
| `gt` | Greater than | `{ age__gt: 30 }` |
| `gte` | Greater than or equal | `{ age__gte: 18 }` |
| `lt` | Less than | `{ age__lt: 65 }` |
| `lte` | Less than or equal | `{ age__lte: 100 }` |
| `contains` | String contains | `{ name__contains: 'ali' }` |
| `in` | Value in list | `{ status__in: ['active', 'pending'] }` |

### Expression System

Build type-safe query expressions:

```typescript
import {
  ComparisonExpr,
  StringExpr,
  AggregateExpr,
} from '@type-bridge/type-bridge';

// Comparison expressions
const ageExpr = ComparisonExpr.gt(Age, new Age(30));
const salaryExpr = ComparisonExpr.gte(Salary, new Salary(50000));

// String expressions
const nameExpr = StringExpr.contains(Name, new Name('alice'));
const emailExpr = StringExpr.endsWith(Email, new Email('.com'));

// Combine with logical operators
const combined = ageExpr.and(salaryExpr).or(nameExpr);

// Aggregate expressions
const totalSalary = AggregateExpr.sum(Salary, 'total');
const avgAge = AggregateExpr.mean(Age, 'average');
```

### Transaction Support

Share transactions across operations:

```typescript
await db.transaction(async (tx) => {
  const personManager = Person.manager(tx);
  const employmentManager = Employment.manager(tx);

  await personManager.insert(person);
  await employmentManager.insert(employment);
  // Both committed together
});
```

## API Reference

See the [docs/](./docs/) directory for detailed API documentation:

- [Attributes](./docs/attributes.md) - Attribute types and flags
- [Models](./docs/models.md) - Entity and Relation definitions
- [CRUD](./docs/crud.md) - CRUD operations and query builders
- [Expressions](./docs/expressions.md) - Query expression system
- [Database](./docs/database.md) - Connection and transaction management
- [Query Builder](./docs/query.md) - Low-level query construction

## Project Structure

```
src/
├── index.ts              # Public API exports
├── database.ts           # Database connection
├── query.ts              # Query builder
├── validation.ts         # Reserved word validation
├── reserved-words.ts     # TypeQL reserved words
├── attribute/            # Attribute system
│   ├── base.ts           # Abstract Attribute class
│   ├── string.ts         # StringAttribute
│   ├── integer.ts        # IntegerAttribute
│   ├── double.ts         # DoubleAttribute
│   ├── boolean.ts        # BooleanAttribute
│   ├── datetime.ts       # DateTimeAttribute
│   ├── datetime-tz.ts    # DateTimeTZAttribute
│   ├── date.ts           # DateAttribute
│   ├── decimal.ts        # DecimalAttribute
│   ├── duration.ts       # DurationAttribute
│   └── flags.ts          # TypeFlags, AttributeFlags, Card
├── models/               # Entity and Relation classes
│   ├── base.ts           # TypeDBType base class
│   ├── entity.ts         # Entity class
│   ├── relation.ts       # Relation class
│   ├── role.ts           # Role definitions
│   └── utils.ts          # Model utilities
├── crud/                 # CRUD operations
│   ├── exceptions.ts     # CRUD exceptions
│   ├── utils.ts          # Shared utilities
│   ├── entity/           # Entity CRUD
│   │   ├── manager.ts    # EntityManager
│   │   └── query.ts      # EntityQuery
│   └── relation/         # Relation CRUD
│       ├── manager.ts    # RelationManager
│       └── query.ts      # RelationQuery
└── expressions/          # Expression system
    ├── base.ts           # Expression, BooleanExpr
    ├── comparison.ts     # ComparisonExpr, InExpr, RangeExpr
    ├── string.ts         # StringExpr, CaseInsensitiveExpr
    └── aggregate.ts      # AggregateExpr, GroupByExpr
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## Compatibility

- TypeScript 5.0+
- Node.js 18+
- TypeDB 3.x (via `typedb-driver-http`)

## License

MIT
