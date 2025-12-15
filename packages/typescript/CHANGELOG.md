# Changelog

All notable changes to `@type-bridge/type-bridge` will be documented in this file.

## [0.1.0] - 2025-12-15

### Initial Release

First public release of the TypeScript ORM for TypeDB.

### Features

#### Attribute System
- **All TypeDB value types supported**
  - `StringAttribute` - Unicode text
  - `IntegerAttribute` - 64-bit signed integer
  - `DoubleAttribute` - 64-bit floating point
  - `BooleanAttribute` - true/false
  - `DateTimeAttribute` - Date and time (no timezone)
  - `DateTimeTZAttribute` - Date and time with timezone
  - `DateAttribute` - Date only
  - `DecimalAttribute` - Arbitrary-precision decimal
  - `DurationAttribute` - ISO 8601 duration

#### Flag System
- **TypeDB annotations via Flag system**
  - `@key` - Unique identifier
  - `@unique` - Unique constraint
  - `@card(min..max)` - Cardinality constraints

#### Entity & Relation Models
- **Type-safe entity definitions**
  - Typed attribute ownership
  - Inheritance support
- **Relation definitions with roles**
  - Role player types
  - Multiple role players per role

#### CRUD Operations
- **Full CRUD via EntityManager and RelationManager**
  - `insert()` / `insertMany()` - Create
  - `all()` / `get()` / `first()` - Read
  - `update()` - Update
  - `delete()` - Delete
  - `put()` - Idempotent upsert

#### Query Builder
- **Chainable query API**
  - `filter()` - Django-style filters
  - `orderBy()` - Sorting with ascending/descending
  - `offset()` / `limit()` - Pagination
  - `count()` - Count results
  - `delete()` - Bulk delete

#### Filter Operators
- **Django-style lookup operators**
  - `exact` / `eq` - Exact match
  - `gt`, `gte`, `lt`, `lte` - Comparisons
  - `contains` - String contains
  - `in` - Value in list

#### Expression System
- **Type-safe query expressions**
  - `ComparisonExpr` - Comparison operations
  - `StringExpr` - String-specific operations
  - `AggregateExpr` - Aggregation functions (sum, mean, max, min, etc.)
  - Boolean operators (`and`, `or`, `not`)

#### Transaction Support
- **Shared transactions across operations**
  - `db.transaction()` context manager
  - Auto-commit on success, rollback on error

### Package Info

- **Package name**: `@type-bridge/type-bridge`
- **npm**: https://www.npmjs.com/package/@type-bridge/type-bridge
- **Repository**: https://github.com/ds1sqe/type-bridge/tree/master/packages/typescript

### Requirements

- TypeScript 5.0+
- Node.js 18+
- TypeDB 3.x (via `typedb-driver-http`)
