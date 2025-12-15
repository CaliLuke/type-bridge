# Attributes

Attributes in TypeDB are reusable value types that can be owned by entities and relations. This document covers the attribute system in `type-bridge-ts`.

## Table of Contents

- [Attribute Types](#attribute-types)
- [Creating Attributes](#creating-attributes)
- [Attribute Operations](#attribute-operations)
- [Flag System](#flag-system)
- [AttributeFlags](#attributeflags)
- [TypeFlags](#typeflags)
- [Type Name Configuration](#type-name-configuration)

## Attribute Types

### StringAttribute

For text values.

```typescript
import { StringAttribute, AttributeFlags } from 'type-bridge-ts';

class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

const name = new Name('Alice');
console.log(name.value);        // 'Alice'
console.log(name.toString());   // 'Alice'

// String operations
const greeting = name.concat(' Smith');  // Name('Alice Smith')
```

**TypeDB Schema:**
```typeql
define
attribute name, value string;
```

### IntegerAttribute

For 64-bit signed integers.

```typescript
import { IntegerAttribute, AttributeFlags } from 'type-bridge-ts';

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

const age = new Age(30);
console.log(age.value);  // 30
```

**TypeDB Schema:**
```typeql
define
attribute age, value integer;
```

### DoubleAttribute

For 64-bit floating-point numbers.

```typescript
import { DoubleAttribute, AttributeFlags } from 'type-bridge-ts';

class Price extends DoubleAttribute {
  static override flags = new AttributeFlags({ name: 'price' });
}

const price = new Price(19.99);
console.log(price.value);  // 19.99
```

**TypeDB Schema:**
```typeql
define
attribute price, value double;
```

### BooleanAttribute

For boolean values.

```typescript
import { BooleanAttribute, AttributeFlags } from 'type-bridge-ts';

class Active extends BooleanAttribute {
  static override flags = new AttributeFlags({ name: 'active' });
}

const active = new Active(true);
console.log(active.value);  // true
```

**TypeDB Schema:**
```typeql
define
attribute active, value boolean;
```

### DateTimeAttribute

For date and time without timezone.

```typescript
import { DateTimeAttribute, AttributeFlags } from 'type-bridge-ts';

class CreatedAt extends DateTimeAttribute {
  static override flags = new AttributeFlags({ name: 'created-at' });
}

const createdAt = new CreatedAt(new Date('2024-01-15T10:30:00'));
console.log(createdAt.value);  // Date object
```

**TypeDB Schema:**
```typeql
define
attribute created-at, value datetime;
```

### DateTimeTZAttribute

For date and time with timezone.

```typescript
import { DateTimeTZAttribute, AttributeFlags } from 'type-bridge-ts';

class LastLogin extends DateTimeTZAttribute {
  static override flags = new AttributeFlags({ name: 'last-login' });
}

const lastLogin = new LastLogin(new Date('2024-01-15T10:30:00Z'));
```

**TypeDB Schema:**
```typeql
define
attribute last-login, value datetime-tz;
```

### DateAttribute

For date only (no time).

```typescript
import { DateAttribute, AttributeFlags } from 'type-bridge-ts';

class BirthDate extends DateAttribute {
  static override flags = new AttributeFlags({ name: 'birth-date' });
}

const birthDate = new BirthDate(new Date('1990-05-15'));
```

**TypeDB Schema:**
```typeql
define
attribute birth-date, value date;
```

### DecimalAttribute

For arbitrary-precision decimal numbers.

```typescript
import { DecimalAttribute, AttributeFlags } from 'type-bridge-ts';

class Balance extends DecimalAttribute {
  static override flags = new AttributeFlags({ name: 'balance' });
}

const balance = new Balance('1234567890.123456789');
console.log(balance.value);  // '1234567890.123456789'
```

**TypeDB Schema:**
```typeql
define
attribute balance, value decimal;
```

### DurationAttribute

For ISO 8601 durations.

```typescript
import { DurationAttribute, AttributeFlags } from 'type-bridge-ts';

class ContractLength extends DurationAttribute {
  static override flags = new AttributeFlags({ name: 'contract-length' });
}

const length = new ContractLength('P1Y6M');  // 1 year, 6 months
console.log(length.value);  // 'P1Y6M'
```

**TypeDB Schema:**
```typeql
define
attribute contract-length, value duration;
```

## Creating Attributes

### Basic Creation

```typescript
// Using constructor
const name = new Name('Alice');
const age = new Age(30);

// Auto-wrapping in entities (raw values are converted)
const person = new Person({
  name: 'Alice',  // Automatically wrapped as Name('Alice')
  age: 30,        // Automatically wrapped as Age(30)
});
```

### Custom Attribute Names

Override the TypeDB attribute name:

```typescript
class Email extends StringAttribute {
  // TypeDB will use 'email-address' instead of class name
  static override flags = new AttributeFlags({ name: 'email-address' });
}
```

## Attribute Operations

### Value Access

```typescript
const name = new Name('Alice');

// Get the underlying value
console.log(name.value);  // 'Alice'

// Convert to string
console.log(name.toString());  // 'Alice'
console.log(String(name));     // 'Alice'
```

### Equality Comparison

```typescript
const name1 = new Name('Alice');
const name2 = new Name('Alice');
const name3 = new Name('Bob');

console.log(name1.equals(name2));  // true (same type and value)
console.log(name1.equals(name3));  // false (different value)

// Different attribute types are never equal
class FirstName extends StringAttribute {}
class LastName extends StringAttribute {}

const first = new FirstName('Alice');
const last = new LastName('Alice');
console.log(first.equals(last));  // false (different types)
```

### String Concatenation

```typescript
const firstName = new Name('Alice');
const fullName = firstName.concat(' Smith');  // Name('Alice Smith')

// With another attribute
const lastName = new Name(' Smith');
const full = firstName.concat(lastName);  // Name('Alice Smith')
```

## Flag System

Flags define constraints and annotations for attributes.

### Key

Marks an attribute as a unique identifier (like a primary key).

```typescript
import { Flag, Key } from 'type-bridge-ts';

// Usage in entity definition
class Person extends Entity {
  static {
    this.ownedAttributes = new Map([
      ['id', { typ: PersonId, flags: new AttributeFlags({ isKey: true }) }],
    ]);
  }
}
```

**TypeDB Schema:**
```typeql
define
entity person, owns id @key;
```

### Unique

Marks an attribute as unique (no duplicates allowed).

```typescript
import { Flag, Unique } from 'type-bridge-ts';

// Usage in entity definition
class Person extends Entity {
  static {
    this.ownedAttributes = new Map([
      ['email', { typ: Email, flags: new AttributeFlags({ isUnique: true }) }],
    ]);
  }
}
```

**TypeDB Schema:**
```typeql
define
entity person, owns email @unique;
```

### Card (Cardinality)

Defines how many values an entity can have for an attribute.

```typescript
import { Card } from 'type-bridge-ts';

// At least 2 values
new Card({ min: 2 });           // @card(2..)

// Exactly 1 value
new Card(1, 1);                 // @card(1..1)

// Between 0 and 5 values
new Card(0, 5);                 // @card(0..5)

// At most 3 values
new Card({ max: 3 });           // @card(0..3)
```

**Usage:**

```typescript
class Person extends Entity {
  static {
    this.ownedAttributes = new Map([
      // Person can have 1-3 phone numbers
      ['phones', { typ: Phone, flags: new AttributeFlags({ cardMin: 1, cardMax: 3 }) }],
    ]);
  }
}
```

**TypeDB Schema:**
```typeql
define
entity person, owns phone @card(1..3);
```

## AttributeFlags

Configure attribute behavior.

```typescript
import { AttributeFlags, TypeNameCase } from 'type-bridge-ts';

const flags = new AttributeFlags({
  // Override TypeDB attribute name
  name: 'custom-name',

  // Key constraint
  isKey: true,

  // Unique constraint
  isUnique: true,

  // Cardinality
  cardMin: 0,
  cardMax: 5,

  // Name case formatting
  case: TypeNameCase.KEBAB_CASE,
});
```

### Available Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Override the TypeDB attribute name |
| `isKey` | `boolean` | Mark as key attribute |
| `isUnique` | `boolean` | Mark as unique |
| `cardMin` | `number` | Minimum cardinality |
| `cardMax` | `number` | Maximum cardinality |
| `case` | `TypeNameCase` | Name case formatting |

### toTypeqlAnnotations()

Generate TypeQL annotation strings:

```typescript
const keyFlags = new AttributeFlags({ isKey: true });
console.log(keyFlags.toTypeqlAnnotations());  // '@key'

const cardFlags = new AttributeFlags({ cardMin: 2, cardMax: 5 });
console.log(cardFlags.toTypeqlAnnotations());  // '@card(2..5)'
```

## TypeFlags

Configure entity and relation type behavior.

```typescript
import { TypeFlags, TypeNameCase } from 'type-bridge-ts';

const flags = new TypeFlags({
  // Override TypeDB type name
  name: 'person',

  // Mark as abstract type
  abstract: true,

  // Specify supertype
  supertype: 'living-thing',

  // Name case formatting
  case: TypeNameCase.KEBAB_CASE,
});
```

### Available Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Override the TypeDB type name |
| `abstract` | `boolean` | Mark as abstract type |
| `supertype` | `string` | Parent type name |
| `case` | `TypeNameCase` | Name case formatting |

## Type Name Configuration

Control how class names are converted to TypeDB type names.

### TypeNameCase Enum

```typescript
import { TypeNameCase } from 'type-bridge-ts';

// Available cases
TypeNameCase.LOWER_CASE    // 'personname'
TypeNameCase.PRESERVE      // 'PersonName'
TypeNameCase.SNAKE_CASE    // 'person_name'
TypeNameCase.KEBAB_CASE    // 'person-name'
```

### Example Usage

```typescript
class PersonName extends StringAttribute {
  static override flags = new AttributeFlags({
    case: TypeNameCase.KEBAB_CASE,  // Results in 'person-name'
  });
}

class EmailAddress extends StringAttribute {
  static override flags = new AttributeFlags({
    case: TypeNameCase.SNAKE_CASE,  // Results in 'email_address'
  });
}

// Or override explicitly
class Phone extends StringAttribute {
  static override flags = new AttributeFlags({
    name: 'phone-number',  // Explicit name takes precedence
  });
}
```

## Built-in Type Names

TypeDB has reserved type names that cannot be used:

```typescript
import { TYPEDB_BUILTIN_TYPES, isReservedWord } from 'type-bridge-ts';

// Check if a name is reserved
console.log(isReservedWord('entity'));  // true
console.log(isReservedWord('person'));  // false

// Reserved words include:
// entity, relation, attribute, role, thing
// string, integer, double, boolean, datetime, etc.
```

## Complete Example

```typescript
import {
  StringAttribute,
  IntegerAttribute,
  BooleanAttribute,
  AttributeFlags,
  TypeNameCase,
} from 'type-bridge-ts';

// Define attribute types with various configurations
class PersonId extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'person-id' });
}

class Name extends StringAttribute {
  static override flags = new AttributeFlags({
    name: 'name',
    case: TypeNameCase.LOWER_CASE,
  });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

class Email extends StringAttribute {
  static override flags = new AttributeFlags({
    name: 'email',
    // Will be marked @unique when owned
  });
}

class PhoneNumber extends StringAttribute {
  static override flags = new AttributeFlags({
    name: 'phone-number',
    // Can have multiple values
  });
}

class Active extends BooleanAttribute {
  static override flags = new AttributeFlags({ name: 'active' });
}

// Create instances
const id = new PersonId('P001');
const name = new Name('Alice');
const age = new Age(30);
const email = new Email('alice@example.com');
const phone = new PhoneNumber('+1-555-0100');
const active = new Active(true);

// Use in entities (see models.md)
```
