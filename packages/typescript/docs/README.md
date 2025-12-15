# type-bridge-ts Documentation

This directory contains detailed API documentation for the `type-bridge-ts` TypeScript ORM for TypeDB.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Attributes](./attributes.md) | Attribute types, value mapping, and flag system |
| [Models](./models.md) | Entity and Relation class definitions |
| [CRUD](./crud.md) | EntityManager, RelationManager, and query builders |
| [Expressions](./expressions.md) | Query expression system for type-safe filters |
| [Database](./database.md) | Connection management and transactions |
| [Query Builder](./query.md) | Low-level TypeQL query construction |

## Quick Links

### Getting Started
- [Installation](../README.md#installation)
- [Quick Start](../README.md#quick-start)

### Core Concepts
- [Attribute Types](./attributes.md#attribute-types)
- [Flag System](./attributes.md#flag-system)
- [Entity Definition](./models.md#entity)
- [Relation Definition](./models.md#relation)

### CRUD Operations
- [EntityManager](./crud.md#entitymanager)
- [EntityQuery](./crud.md#entityquery)
- [RelationManager](./crud.md#relationmanager)
- [Filter Operators](./crud.md#filter-operators)

### Advanced
- [Expression System](./expressions.md)
- [Transaction Management](./database.md#transactions)
- [Query Builder](./query.md)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
├─────────────────────────────────────────────────────────────────┤
│  Entity/Relation Models                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Person  │  │ Company  │  │Employment│  │   ...    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  CRUD Layer                                                      │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  EntityManager  │  │ RelationManager │                       │
│  ├─────────────────┤  ├─────────────────┤                       │
│  │  EntityQuery    │  │ RelationQuery   │                       │
│  └─────────────────┘  └─────────────────┘                       │
├─────────────────────────────────────────────────────────────────┤
│  Expression System                                               │
│  ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐    │
│  │Comparison  │  │  String  │  │  Boolean  │  │ Aggregate │    │
│  │   Expr     │  │   Expr   │  │   Expr    │  │   Expr    │    │
│  └────────────┘  └──────────┘  └───────────┘  └───────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Query Builder                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Query / QueryBuilder                                     │   │
│  │  match() -> fetch() -> sort() -> limit() -> build()      │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────────┐          │
│  │ Database │  │ Transaction │  │ TransactionContext│          │
│  └──────────┘  └─────────────┘  └───────────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  typedb-driver-http                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  HTTP connection to TypeDB 3.x                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## TypeDB Type Mapping

| TypeScript | TypeDB | Notes |
|------------|--------|-------|
| `StringAttribute` | `attribute ... value string` | Unicode text |
| `IntegerAttribute` | `attribute ... value integer` | 64-bit signed |
| `DoubleAttribute` | `attribute ... value double` | 64-bit float |
| `BooleanAttribute` | `attribute ... value boolean` | true/false |
| `DateTimeAttribute` | `attribute ... value datetime` | No timezone |
| `DateTimeTZAttribute` | `attribute ... value datetime-tz` | With timezone |
| `DateAttribute` | `attribute ... value date` | Date only |
| `DecimalAttribute` | `attribute ... value decimal` | Arbitrary precision |
| `DurationAttribute` | `attribute ... value duration` | ISO 8601 |
| `Entity` | `entity ...` | Independent object |
| `Relation` | `relation ...` | Connection with roles |
| `Role` | `relates ...` | Role player definition |

## Python Compatibility

This library is a TypeScript port of the Python [type_bridge](https://github.com/ds1sqe/type_bridge) library. The API is designed to be as similar as possible while being idiomatic TypeScript.

### Key Differences from Python

| Python | TypeScript | Notes |
|--------|------------|-------|
| `String` | `StringAttribute` | Avoid conflict with built-in |
| `Integer` | `IntegerAttribute` | Consistency with other types |
| `@dataclass` | `class` with properties | Standard TS patterns |
| `None` | `undefined` | TypeScript convention |
| Context managers | `async/await` with callbacks | Transaction pattern |
| Type hints | TypeScript generics | Full type safety |
