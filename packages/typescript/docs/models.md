# Models

Models represent TypeDB entities and relations in TypeScript. This document covers the Entity and Relation classes.

## Table of Contents

- [Entity](#entity)
- [Relation](#relation)
- [Role](#role)
- [Inheritance](#inheritance)
- [Schema Generation](#schema-generation)
- [Serialization](#serialization)

## Entity

Entities are independent objects in TypeDB that own attributes.

### Basic Definition

```typescript
import {
  Entity,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
} from 'type-bridge-ts';

// Define attribute types
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

// Define entity
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
```

**TypeDB Schema:**
```typeql
define
entity person,
  owns name @key,
  owns age;
```

### Using defineEntity Helper

For a more concise definition:

```typescript
import { defineEntity, TypeFlags, AttributeFlags } from 'type-bridge-ts';

const Person = defineEntity({
  flags: new TypeFlags({ name: 'person' }),
  attributes: {
    name: { typ: Name, flags: new AttributeFlags({ isKey: true }) },
    age: { typ: Age, flags: new AttributeFlags() },
    email: { typ: Email, flags: new AttributeFlags({ isUnique: true }) },
  },
});
```

### Creating Instances

```typescript
// With attribute instances
const person = new Person({
  name: new Name('Alice'),
  age: new Age(30),
});

// With raw values (auto-wrapped)
const person2 = new Person({
  name: 'Bob',   // Automatically becomes Name('Bob')
  age: 25,       // Automatically becomes Age(25)
});

// Accessing values
console.log(person.name.value);  // 'Alice'
console.log(person.age.value);   // 30
```

### Optional Attributes

```typescript
class Person extends Entity {
  static override flags = new TypeFlags({ name: 'person' });

  declare name: Name;
  declare email?: Email;  // Optional

  static {
    this.ownedAttributes = new Map([
      ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
      // Cardinality 0..1 makes it optional
      ['email', { typ: Email, flags: new AttributeFlags({ cardMin: 0, cardMax: 1 }) }],
    ]);
  }
}

// Create without optional attribute
const person = new Person({ name: 'Alice' });
console.log(person.email);  // undefined
```

### Multi-Value Attributes

```typescript
class Person extends Entity {
  static override flags = new TypeFlags({ name: 'person' });

  declare name: Name;
  declare phones: Phone[];  // Multiple values

  static {
    this.ownedAttributes = new Map([
      ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
      // cardMax > 1 or undefined allows multiple
      ['phones', { typ: Phone, flags: new AttributeFlags({ cardMin: 1 }) }],
    ]);
  }
}

const person = new Person({
  name: 'Alice',
  phones: [new Phone('+1-555-0100'), new Phone('+1-555-0101')],
});
```

### Static Methods

```typescript
// Get the TypeDB type name
Person.getTypeName();  // 'person'

// Get supertype (if any)
Person.getSupertype();  // undefined or parent type name

// Check if abstract
Person.isAbstract();  // false

// Get owned attributes
Person.getOwnedAttributes();  // Map of this class's attributes only

// Get all attributes (including inherited)
Person.getAllAttributes();  // Map of all attributes

// Get entity manager
Person.manager(connection);  // EntityManager<Person>
```

## Relation

Relations connect entities through role players.

### Basic Definition

```typescript
import {
  Relation,
  Role,
  TypeFlags,
  AttributeFlags,
} from 'type-bridge-ts';

class Employment extends Relation {
  static override flags = new TypeFlags({ name: 'employment' });

  declare employee: Person;
  declare employer: Company;
  declare startDate?: StartDate;

  static override roles = new Map([
    ['employee', new Role('employee', [Person])],
    ['employer', new Role('employer', [Company])],
  ]);

  static {
    this.ownedAttributes = new Map([
      ['startDate', { typ: StartDate, flags: new AttributeFlags() }],
    ]);
  }
}
```

**TypeDB Schema:**
```typeql
define
relation employment,
  relates employee,
  relates employer,
  owns start-date;

entity person, plays employment:employee;
entity company, plays employment:employer;
```

### Using defineRelation Helper

```typescript
import { defineRelation, TypeFlags, AttributeFlags, Role } from 'type-bridge-ts';

const Employment = defineRelation({
  flags: new TypeFlags({ name: 'employment' }),
  roles: {
    employee: new Role('employee', [Person]),
    employer: new Role('employer', [Company]),
  },
  attributes: {
    startDate: { typ: StartDate, flags: new AttributeFlags() },
    salary: { typ: Salary, flags: new AttributeFlags() },
  },
});
```

### Creating Relation Instances

```typescript
const alice = new Person({ name: 'Alice' });
const acme = new Company({ name: 'ACME Corp' });

const employment = new Employment({
  employee: alice,
  employer: acme,
  startDate: new StartDate(new Date('2024-01-15')),
});

// Access role players
console.log(employment.employee.name.value);  // 'Alice'
console.log(employment.employer.name.value);  // 'ACME Corp'
```

### Relations with Multiple Player Types

A role can accept multiple entity types:

```typescript
// Organization can be either Person or Company
class Membership extends Relation {
  static override flags = new TypeFlags({ name: 'membership' });

  declare member: Person;
  declare organization: Person | Company;

  static override roles = new Map([
    ['member', new Role('member', [Person])],
    ['organization', Role.multi('organization', Person, Company)],
  ]);
}
```

## Role

Roles define the participation of entities in relations.

### Basic Role

```typescript
import { Role } from 'type-bridge-ts';

// Single player type
const employeeRole = new Role('employee', [Person]);

// Multiple player types
const ownerRole = Role.multi('owner', Person, Company);
```

### Role Properties

```typescript
const role = new Role('employee', [Person]);

console.log(role.roleName);     // 'employee'
console.log(role.playerTypes);  // [Person]
```

### Role Validation

```typescript
const role = new Role('employee', [Person]);

// Validate player instance
role.validatePlayer(new Person({ name: 'Alice' }));  // OK

role.validatePlayer(new Company({ name: 'ACME' }));  // Throws error!
```

## Inheritance

### Entity Inheritance

```typescript
// Base entity (abstract)
class LivingThing extends Entity {
  static override flags = new TypeFlags({
    name: 'living-thing',
    abstract: true,
  });

  declare name: Name;

  static {
    this.ownedAttributes = new Map([
      ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
    ]);
  }
}

// Derived entity
class Person extends LivingThing {
  static override flags = new TypeFlags({
    name: 'person',
    supertype: 'living-thing',
  });

  declare age: Age;

  static {
    this.ownedAttributes = new Map([
      ['age', { typ: Age, flags: new AttributeFlags() }],
    ]);
  }
}
```

**TypeDB Schema:**
```typeql
define
entity living-thing @abstract,
  owns name @key;

entity person sub living-thing,
  owns age;
```

### Getting All Attributes

```typescript
// getOwnedAttributes() returns only this class's attributes
Person.getOwnedAttributes();  // Map { 'age' => ... }

// getAllAttributes() includes inherited attributes
Person.getAllAttributes();  // Map { 'name' => ..., 'age' => ... }
```

### Relation Inheritance

```typescript
class Contract extends Relation {
  static override flags = new TypeFlags({
    name: 'contract',
    abstract: true,
  });
}

class EmploymentContract extends Contract {
  static override flags = new TypeFlags({
    name: 'employment-contract',
    supertype: 'contract',
  });
}
```

## Schema Generation

### Entity Schema

```typescript
const person = new Person({ name: 'Alice', age: 30 });

// Generate schema definition
const schema = Person.toSchemaDefinition();
console.log(schema);
// entity person,
//   owns name @key,
//   owns age;
```

### Relation Schema

```typescript
const schema = Employment.toSchemaDefinition();
console.log(schema);
// relation employment,
//   relates employee,
//   relates employer,
//   owns start-date;
```

### Insert Query Generation

```typescript
const person = new Person({ name: 'Alice', age: 30 });

// Generate insert query
const query = person.toInsertQuery('$p');
console.log(query);
// $p isa person, has name "Alice", has age 30
```

## Serialization

### toDict()

Convert model to plain object:

```typescript
const person = new Person({
  name: 'Alice',
  age: 30,
});

const dict = person.toDict();
console.log(dict);
// { name: 'Alice', age: 30 }

// With aliases
const dictWithAliases = person.toDict(true);
```

### fromDict()

Create model from plain object:

```typescript
const person = Person.fromDict({
  name: 'Alice',
  age: 30,
});

console.log(person.name.value);  // 'Alice'
console.log(person.age.value);   // 30

// Strict mode (throws on unknown fields)
const person2 = Person.fromDict({ name: 'Bob', unknown: 'field' }, true);
// Throws error!

// Non-strict mode (ignores unknown fields)
const person3 = Person.fromDict({ name: 'Bob', unknown: 'field' }, false);
// OK, 'unknown' is ignored
```

### toString()

Human-readable representation:

```typescript
const person = new Person({ name: 'Alice', age: 30 });
console.log(person.toString());
// Person(name=Alice, age=30)

const employment = new Employment({
  employee: alice,
  employer: acme,
});
console.log(employment.toString());
// Employment(employee=Person(...), employer=Company(...))
```

## Complete Example

```typescript
import {
  Entity,
  Relation,
  Role,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
  DateAttribute,
} from 'type-bridge-ts';

// Attributes
class PersonId extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'person-id' });
}

class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

class CompanyName extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'company-name' });
}

class StartDate extends DateAttribute {
  static override flags = new AttributeFlags({ name: 'start-date' });
}

class Salary extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'salary' });
}

// Entities
class Person extends Entity {
  static override flags = new TypeFlags({ name: 'person' });

  declare id: PersonId;
  declare name: Name;
  declare age?: Age;

  static {
    this.ownedAttributes = new Map([
      ['id', { typ: PersonId, flags: new AttributeFlags({ isKey: true }) }],
      ['name', { typ: Name, flags: new AttributeFlags() }],
      ['age', { typ: Age, flags: new AttributeFlags({ cardMin: 0, cardMax: 1 }) }],
    ]);
  }
}

class Company extends Entity {
  static override flags = new TypeFlags({ name: 'company' });

  declare name: CompanyName;

  static {
    this.ownedAttributes = new Map([
      ['name', { typ: CompanyName, flags: new AttributeFlags({ isKey: true }) }],
    ]);
  }
}

// Relation
class Employment extends Relation {
  static override flags = new TypeFlags({ name: 'employment' });

  declare employee: Person;
  declare employer: Company;
  declare startDate: StartDate;
  declare salary?: Salary;

  static override roles = new Map([
    ['employee', new Role('employee', [Person])],
    ['employer', new Role('employer', [Company])],
  ]);

  static {
    this.ownedAttributes = new Map([
      ['startDate', { typ: StartDate, flags: new AttributeFlags() }],
      ['salary', { typ: Salary, flags: new AttributeFlags({ cardMin: 0, cardMax: 1 }) }],
    ]);
  }
}

// Usage
const alice = new Person({
  id: 'P001',
  name: 'Alice',
  age: 30,
});

const acme = new Company({
  name: 'ACME Corp',
});

const employment = new Employment({
  employee: alice,
  employer: acme,
  startDate: new Date('2024-01-15'),
  salary: 75000,
});

// Serialize
console.log(alice.toDict());
// { id: 'P001', name: 'Alice', age: 30 }

console.log(employment.toString());
// Employment(employee=Person(...), employer=Company(...), startDate=2024-01-15, salary=75000)
```
