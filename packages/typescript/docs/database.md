# Database

This document covers database connection management and transactions.

## Table of Contents

- [Database Connection](#database-connection)
- [Configuration](#configuration)
- [Query Execution](#query-execution)
- [Transactions](#transactions)
- [Connection Types](#connection-types)
- [Error Handling](#error-handling)

## Database Connection

### Creating a Connection

```typescript
import { Database } from 'type-bridge-ts';

const db = new Database({
  address: 'localhost:1729',
  database: 'my_database',
  username: 'admin',
  password: 'password',
});
```

### Connecting and Disconnecting

```typescript
// Connect to TypeDB
await db.connect();

// ... perform operations ...

// Always close when done
await db.close();
```

### Using with try/finally

```typescript
const db = new Database({ /* config */ });

try {
  await db.connect();

  // Perform operations
  const manager = Person.manager(db);
  const people = await manager.all();

} finally {
  await db.close();
}
```

## Configuration

### DatabaseConfig Interface

```typescript
interface DatabaseConfig {
  address: string;      // TypeDB server address (host:port)
  database: string;     // Database name
  username?: string;    // Optional username
  password?: string;    // Optional password
}
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `address` | `string` | Yes | Server address (e.g., `localhost:1729`) |
| `database` | `string` | Yes | Database name |
| `username` | `string` | No | Authentication username |
| `password` | `string` | No | Authentication password |

### Examples

```typescript
// Local development
const devDb = new Database({
  address: 'localhost:1729',
  database: 'dev_db',
});

// Production with authentication
const prodDb = new Database({
  address: 'typedb.example.com:1729',
  database: 'production',
  username: process.env.TYPEDB_USER,
  password: process.env.TYPEDB_PASS,
});
```

## Query Execution

### executeQuery()

Execute raw TypeQL queries:

```typescript
import { Database } from 'type-bridge-ts';

const db = new Database({ /* config */ });
await db.connect();

// Read query
const result = await db.executeQuery(
  'match $p isa person; fetch { $p.* };',
  'read'
);
console.log(result.documents);

// Write query
await db.executeQuery(
  'insert $p isa person, has name "Alice";',
  'write'
);
```

### Query Result

```typescript
interface QueryResult {
  documents: unknown[];  // Fetched documents (for fetch queries)
  rows: Record<string, unknown>[];  // Row results (for reduce queries)
}
```

### Transaction Types

| Type | Description |
|------|-------------|
| `'read'` | Read-only operations (match, fetch) |
| `'write'` | Write operations (insert, delete, update) |
| `'schema'` | Schema operations (define, undefine) |

## Transactions

### Basic Transaction

```typescript
await db.transaction(async (tx) => {
  // All operations within this callback share the same transaction
  const personManager = Person.manager(tx);
  const companyManager = Company.manager(tx);

  await personManager.insert(new Person({ name: 'Alice' }));
  await companyManager.insert(new Company({ name: 'ACME' }));

  // Committed automatically when callback completes
});
```

### Transaction with Explicit Control

```typescript
const tx = await db.startTransaction();

try {
  await tx.execute('insert $p isa person, has name "Alice";');
  await tx.execute('insert $c isa company, has name "ACME";');

  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

### TransactionContext

Share a transaction across multiple managers:

```typescript
await db.transaction(async (ctx) => {
  // ctx is a TransactionContext

  const personManager = Person.manager(ctx);
  const employmentManager = Employment.manager(ctx);

  const alice = new Person({ name: 'Alice', age: 30 });
  await personManager.insert(alice);

  const acme = await Company.manager(ctx).first({ name: 'ACME' });

  if (acme) {
    await employmentManager.insert(new Employment({
      employee: alice,
      employer: acme,
    }));
  }

  // All operations committed together
});
```

### Transaction Isolation

Each transaction provides isolation:

```typescript
// Transaction 1
await db.transaction(async (tx1) => {
  await Person.manager(tx1).insert(new Person({ name: 'Alice' }));

  // Transaction 2 doesn't see Alice yet
  await db.transaction(async (tx2) => {
    const count = await Person.manager(tx2).query().count();
    // count does not include Alice
  });

  // Alice is committed when tx1 completes
});

// Now Alice is visible to all
```

## Connection Types

The `Connection` type represents any valid connection:

```typescript
type Connection = Database | Transaction | TransactionContext;
```

### Using with Managers

Managers accept any connection type:

```typescript
// With Database (auto-transaction per operation)
const manager1 = Person.manager(db);

// With Transaction
const tx = await db.startTransaction();
const manager2 = Person.manager(tx);

// With TransactionContext
await db.transaction(async (ctx) => {
  const manager3 = Person.manager(ctx);
});
```

### Helper Function

The `executeQuery` helper works with any connection:

```typescript
import { executeQuery } from 'type-bridge-ts';

// Works with Database
await executeQuery(db, 'match $p isa person; fetch { $p.* };', 'read');

// Works with Transaction
await executeQuery(tx, 'insert $p isa person, has name "Bob";', 'write');

// Works with TransactionContext
await db.transaction(async (ctx) => {
  await executeQuery(ctx, 'match $p isa person; fetch { $p.* };', 'read');
});
```

## Error Handling

### TypeDBError

Base error class for TypeDB operations:

```typescript
import { TypeDBError } from 'type-bridge-ts';

try {
  await db.executeQuery('invalid query', 'read');
} catch (error) {
  if (error instanceof TypeDBError) {
    console.log('TypeDB error:', error.message);
  }
}
```

### Connection Errors

```typescript
const db = new Database({
  address: 'invalid:9999',
  database: 'test',
});

try {
  await db.connect();
} catch (error) {
  console.log('Connection failed:', error.message);
}
```

### Transaction Errors

```typescript
await db.transaction(async (tx) => {
  try {
    await Person.manager(tx).insert(invalidPerson);
  } catch (error) {
    // Transaction is automatically rolled back
    console.log('Operation failed:', error.message);
    throw error;  // Re-throw to prevent commit
  }
});
```

## Complete Example

```typescript
import {
  Database,
  Entity,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
  TypeDBError,
} from 'type-bridge-ts';

// Define models
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

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

async function main() {
  const db = new Database({
    address: process.env.TYPEDB_ADDRESS || 'localhost:1729',
    database: process.env.TYPEDB_DATABASE || 'example',
    username: process.env.TYPEDB_USER,
    password: process.env.TYPEDB_PASS,
  });

  try {
    await db.connect();
    console.log('Connected to TypeDB');

    // Single operations (auto-transaction)
    const manager = Person.manager(db);

    // Insert
    await manager.insert(new Person({ name: 'Alice', age: 30 }));
    console.log('Inserted Alice');

    // Query
    const people = await manager.all();
    console.log(`Found ${people.length} people`);

    // Transaction for multiple operations
    await db.transaction(async (tx) => {
      const txManager = Person.manager(tx);

      await txManager.insert(new Person({ name: 'Bob', age: 25 }));
      await txManager.insert(new Person({ name: 'Carol', age: 35 }));

      console.log('Inserted Bob and Carol in transaction');
    });

    // Raw query
    const result = await db.executeQuery(
      'match $p isa person, has name $n; fetch { $n };',
      'read'
    );
    console.log('Names:', result.documents);

  } catch (error) {
    if (error instanceof TypeDBError) {
      console.error('TypeDB error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);

  } finally {
    await db.close();
    console.log('Disconnected from TypeDB');
  }
}

main();
```
