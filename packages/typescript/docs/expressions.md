# Expressions

The expression system provides type-safe query building with proper variable scoping. This document covers all expression types.

## Table of Contents

- [Overview](#overview)
- [Base Expression](#base-expression)
- [Comparison Expressions](#comparison-expressions)
- [String Expressions](#string-expressions)
- [Boolean Expressions](#boolean-expressions)
- [Aggregate Expressions](#aggregate-expressions)
- [TypeQL Generation](#typeql-generation)

## Overview

Expressions generate TypeQL patterns for queries. The key feature is **variable scoping** - using `${varPrefix}_${attrName}` pattern to prevent implicit equality constraints in TypeDB.

```typescript
import {
  ComparisonExpr,
  StringExpr,
  AggregateExpr,
  BooleanExpr,
} from 'type-bridge-ts';

// Create expressions
const ageExpr = ComparisonExpr.gt(Age, new Age(30));
const nameExpr = StringExpr.contains(Name, new Name('alice'));

// Combine expressions
const combined = ageExpr.and(nameExpr);

// Generate TypeQL
console.log(combined.toTypeql('e'));
// $e has age $e_age;
// $e_age > 30;
// $e has name $e_name;
// $e_name contains "alice"
```

## Base Expression

All expressions extend the abstract `Expression` class.

### Methods

#### toTypeql(varPrefix: string)

Generate TypeQL pattern string.

```typescript
const expr = ComparisonExpr.gt(Age, new Age(30));
console.log(expr.toTypeql('e'));
// $e has age $e_age;
// $e_age > 30
```

#### getAttributeTypes()

Get attribute types used in the expression.

```typescript
const types = expr.getAttributeTypes();
// Returns array of attribute constructors
```

#### and(other: Expression)

Combine with AND operator.

```typescript
const combined = expr1.and(expr2);
```

#### or(other: Expression)

Combine with OR operator.

```typescript
const combined = expr1.or(expr2);
```

#### not()

Negate the expression.

```typescript
const negated = expr.not();
```

### Python-style Aliases

For compatibility with Python conventions:

```typescript
expr.and_(other);  // Same as and()
expr.or_(other);   // Same as or()
expr.not_();       // Same as not()
```

## Comparison Expressions

### ComparisonExpr

Compare attribute values with operators.

```typescript
import { ComparisonExpr } from 'type-bridge-ts';

// Using constructor
const expr = new ComparisonExpr(Age, '>', new Age(30));

// Using static factory methods (recommended)
const gt = ComparisonExpr.gt(Age, new Age(30));    // >
const gte = ComparisonExpr.gte(Age, new Age(30));  // >=
const lt = ComparisonExpr.lt(Age, new Age(30));    // <
const lte = ComparisonExpr.lte(Age, new Age(30));  // <=
const eq = ComparisonExpr.eq(Age, new Age(30));    // ==
const ne = ComparisonExpr.ne(Age, new Age(30));    // !=
```

#### Operators

| Operator | Method | Description |
|----------|--------|-------------|
| `>` | `gt()` | Greater than |
| `>=` | `gte()` | Greater than or equal |
| `<` | `lt()` | Less than |
| `<=` | `lte()` | Less than or equal |
| `==` | `eq()` | Equal |
| `!=` | `ne()` | Not equal |

#### TypeQL Output

```typescript
const expr = ComparisonExpr.gt(Age, new Age(30));
console.log(expr.toTypeql('person'));
// $person has age $person_age;
// $person_age > 30
```

### AttributeExistsExpr

Check if an entity has an attribute.

```typescript
import { AttributeExistsExpr } from 'type-bridge-ts';

// Has email attribute
const hasEmail = new AttributeExistsExpr(Email);
console.log(hasEmail.toTypeql('e'));
// $e has email $e_email

// Does NOT have email
const noEmail = hasEmail.not();
console.log(noEmail.toTypeql('e'));
// not { $e has email $e_email; }
```

### InExpr

Check if value is in a set.

```typescript
import { InExpr } from 'type-bridge-ts';

const statusExpr = new InExpr(Status, [
  new Status('active'),
  new Status('pending'),
  new Status('review'),
]);

console.log(statusExpr.toTypeql('e'));
// { $e has status $e_status; $e_status == "active"; } or
// { $e has status $e_status; $e_status == "pending"; } or
// { $e has status $e_status; $e_status == "review"; }
```

### RangeExpr

Check if value is within a range.

```typescript
import { RangeExpr } from 'type-bridge-ts';

// Inclusive range: 18 <= age <= 65
const ageRange = new RangeExpr(Age, new Age(18), new Age(65));
console.log(ageRange.toTypeql('e'));
// $e has age $e_age;
// $e_age >= 18;
// $e_age <= 65

// Exclusive range: 18 < age < 65
const exclusiveRange = new RangeExpr(Age, new Age(18), new Age(65), false);
console.log(exclusiveRange.toTypeql('e'));
// $e has age $e_age;
// $e_age > 18;
// $e_age < 65
```

## String Expressions

### StringExpr

String-specific operations.

```typescript
import { StringExpr } from 'type-bridge-ts';

// Contains
const contains = StringExpr.contains(Name, new Name('alice'));
console.log(contains.toTypeql('e'));
// $e has name $e_name;
// $e_name contains "alice"

// Like (regex)
const like = StringExpr.like(Email, new Email('.*@example\\.com'));
console.log(like.toTypeql('e'));
// $e has email $e_email;
// $e_email like ".*@example\.com"

// Starts with
const startsWith = StringExpr.startsWith(Name, new Name('Dr.'));
console.log(startsWith.toTypeql('e'));
// $e has name $e_name;
// $e_name like "^Dr\..*"

// Ends with
const endsWith = StringExpr.endsWith(Email, new Email('.com'));
console.log(endsWith.toTypeql('e'));
// $e has email $e_email;
// $e_email like ".*\.com$"
```

#### Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| `contains` | `contains()` | Substring match |
| `like` | `like()` | Regex pattern |
| `starts_with` | `startsWith()` | Prefix match |
| `ends_with` | `endsWith()` | Suffix match |

### CaseInsensitiveExpr

Case-insensitive string matching.

```typescript
import { CaseInsensitiveExpr } from 'type-bridge-ts';

const expr = new CaseInsensitiveExpr(Name, 'ALICE');
console.log(expr.toTypeql('e'));
// $e has name $e_name;
// $e_name like "(?i)ALICE"
```

## Boolean Expressions

### BooleanExpr

Combine expressions with logical operators.

```typescript
import { BooleanExpr } from 'type-bridge-ts';

// AND
const andExpr = new BooleanExpr('and', [expr1, expr2]);

// OR
const orExpr = new BooleanExpr('or', [expr1, expr2]);

// NOT
const notExpr = new BooleanExpr('not', [expr1]);
```

### Fluent API

More commonly, use the fluent methods:

```typescript
// AND
const combined = expr1.and(expr2);

// OR
const either = expr1.or(expr2);

// NOT
const negated = expr1.not();

// Complex combinations
const complex = expr1
  .and(expr2)
  .or(expr3.not())
  .and(expr4);
```

### TypeQL Output

```typescript
// AND - combines patterns
const andExpr = expr1.and(expr2);
console.log(andExpr.toTypeql('e'));
// $e has age $e_age;
// $e_age > 30;
// $e has name $e_name;
// $e_name contains "alice"

// OR - uses TypeDB or syntax
const orExpr = expr1.or(expr2);
console.log(orExpr.toTypeql('e'));
// { $e has age $e_age; $e_age > 30; } or { $e has name $e_name; $e_name contains "alice"; }

// NOT - uses TypeDB not syntax
const notExpr = expr1.not();
console.log(notExpr.toTypeql('e'));
// not { $e has age $e_age; $e_age > 30; }
```

## Aggregate Expressions

### AggregateExpr

Compute aggregates over attribute values.

```typescript
import { AggregateExpr } from 'type-bridge-ts';

// Sum
const total = AggregateExpr.sum(Salary);

// Count
const count = AggregateExpr.count(Name);

// Min/Max
const youngest = AggregateExpr.min(Age);
const oldest = AggregateExpr.max(Age);

// Mean (average)
const avgSalary = AggregateExpr.mean(Salary);

// Median
const medianAge = AggregateExpr.median(Age);

// Standard deviation
const stdSalary = AggregateExpr.std(Salary);
```

#### Available Functions

| Function | Method | Description |
|----------|--------|-------------|
| `sum` | `sum()` | Sum of values |
| `count` | `count()` | Count of values |
| `min` | `min()` | Minimum value |
| `max` | `max()` | Maximum value |
| `mean` | `mean()` | Average value |
| `median` | `median()` | Median value |
| `std` | `std()` | Standard deviation |

#### Custom Aliases

```typescript
const totalSalary = AggregateExpr.sum(Salary, 'total_salary');
console.log(totalSalary.resultVar);  // 'total_salary'
```

#### TypeQL Output

```typescript
const agg = AggregateExpr.sum(Salary, 'total');

// Bind clause
console.log(agg.toBindClause('e'));
// $e has salary $e_salary

// Reduce clause
console.log(agg.toReduceClause('e'));
// reduce $total = sum($e_salary)

// Complete
console.log(agg.toTypeql('e'));
// $e has salary $e_salary;
// reduce $total = sum($e_salary);
```

### CountExpr

Simple entity count (not attribute count).

```typescript
import { CountExpr } from 'type-bridge-ts';

const count = new CountExpr();
console.log(count.toReduceClause());
// reduce $count = count;

// With custom alias
const total = CountExpr.create('total_count');
console.log(total.toReduceClause());
// reduce $total_count = count;
```

### GroupByExpr

Group aggregates by an attribute.

```typescript
import { GroupByExpr, AggregateExpr } from 'type-bridge-ts';

// Average salary by department
const groupBy = new GroupByExpr(Department, [
  AggregateExpr.mean(Salary, 'avg_salary'),
  AggregateExpr.count(Name, 'employee_count'),
]);

// Bind clause
console.log(groupBy.toBindClause('e'));
// $e has department $e_department;
// $e has salary $e_salary;
// $e has name $e_name

// Reduce clause
console.log(groupBy.toReduceClause('e'));
// reduce $avg_salary = mean($e_salary), $employee_count = count($e_name) within $e_department;

// Complete
console.log(groupBy.toTypeql('e'));
// $e has department $e_department;
// $e has salary $e_salary;
// $e has name $e_name;
// reduce $avg_salary = mean($e_salary), $employee_count = count($e_name) within $e_department;
```

## TypeQL Generation

### Variable Scoping

The key pattern is `${varPrefix}_${attrName}` to prevent implicit equality:

```typescript
// Without scoping (BAD - causes implicit equality in TypeDB)
// $e has age 30;
// $e has age $age; $age > 20;
// This would fail because $age can't be both 30 and >20

// With scoping (GOOD)
const expr = ComparisonExpr.gt(Age, new Age(30));
console.log(expr.toTypeql('e'));
// $e has age $e_age;
// $e_age > 30
// The variable $e_age is unique to this expression
```

### formatExprValue

Format values for TypeQL:

```typescript
import { formatExprValue } from 'type-bridge-ts';

formatExprValue('hello');           // "hello"
formatExprValue('say "hi"');        // "say \"hi\""
formatExprValue(42);                // 42
formatExprValue(3.14);              // 3.14
formatExprValue(true);              // true
formatExprValue(new Date(...));     // 2024-01-15T00:00:00.000Z
formatExprValue(new Name('Alice')); // "Alice" (extracts value)
```

### getAttrName

Get TypeDB attribute name from attribute type:

```typescript
import { getAttrName } from 'type-bridge-ts';

class PersonName extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'person-name' });
}

console.log(getAttrName(PersonName));  // 'person-name'
```

## Complete Example

```typescript
import {
  ComparisonExpr,
  StringExpr,
  RangeExpr,
  InExpr,
  AttributeExistsExpr,
  AggregateExpr,
  GroupByExpr,
} from 'type-bridge-ts';

// Complex filter expression
const filter = ComparisonExpr.gte(Age, new Age(18))
  .and(ComparisonExpr.lte(Age, new Age(65)))
  .and(StringExpr.contains(Email, new Email('@company.com')))
  .and(new InExpr(Status, [
    new Status('active'),
    new Status('pending'),
  ]))
  .and(new AttributeExistsExpr(Phone));

console.log('Filter Query:');
console.log(filter.toTypeql('e'));
// $e has age $e_age;
// $e_age >= 18;
// $e has age $e_age;
// $e_age <= 65;
// $e has email $e_email;
// $e_email contains "@company.com";
// { $e has status $e_status; $e_status == "active"; } or { $e has status $e_status; $e_status == "pending"; };
// $e has phone $e_phone

// Aggregate expression
const avgSalaryByDept = new GroupByExpr(Department, [
  AggregateExpr.mean(Salary, 'avg_salary'),
  AggregateExpr.min(Salary, 'min_salary'),
  AggregateExpr.max(Salary, 'max_salary'),
  AggregateExpr.count(Name, 'headcount'),
]);

console.log('Aggregate Query:');
console.log(avgSalaryByDept.toTypeql('e'));

// OR condition
const seniorOrManager = ComparisonExpr.gte(Age, new Age(50))
  .or(StringExpr.contains(Title, new Title('Manager')));

console.log('OR Query:');
console.log(seniorOrManager.toTypeql('e'));

// NOT condition
const notInactive = ComparisonExpr.eq(Status, new Status('inactive')).not();

console.log('NOT Query:');
console.log(notInactive.toTypeql('e'));
```
