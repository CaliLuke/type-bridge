/**
 * Comparison expressions for TypeQL queries.
 *
 * Supports comparison operators (>, <, >=, <=, ==, !=) and
 * attribute existence checks.
 */

import type { Attribute } from '../attribute/base.js';
import { Expression, formatExprValue, getAttrName } from './base.js';

/**
 * Comparison operators for TypeQL queries.
 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Comparison expression for attribute queries.
 *
 * Uses variable scoping pattern `${varPrefix}_${attrName}` to prevent
 * implicit equality constraints in TypeDB.
 *
 * @example
 * ```typescript
 * // Age greater than 30
 * const expr = new ComparisonExpr(Age, '>', new Age(30));
 * expr.toTypeql('e');
 * // Output: "$e has age $e_age; $e_age > 30"
 *
 * // Name equals "Alice"
 * const expr = new ComparisonExpr(Name, '==', new Name('Alice'));
 * expr.toTypeql('person');
 * // Output: "$person has name $person_name; $person_name == \"Alice\""
 * ```
 */
export class ComparisonExpr<T> extends Expression {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>,
    public readonly operator: ComparisonOperator,
    public readonly value: Attribute<T>
  ) {
    super();
  }

  /**
   * Convert to TypeQL pattern with proper variable scoping.
   *
   * Pattern: `$varPrefix has attrName $varPrefix_attrName; $varPrefix_attrName op value`
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;
    const formattedValue = formatExprValue(this.value);

    return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} ${this.operator} ${formattedValue}`;
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }

  /**
   * Create a greater than expression.
   */
  static gt<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '>', value);
  }

  /**
   * Create a greater than or equal expression.
   */
  static gte<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '>=', value);
  }

  /**
   * Create a less than expression.
   */
  static lt<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '<', value);
  }

  /**
   * Create a less than or equal expression.
   */
  static lte<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '<=', value);
  }

  /**
   * Create an equals expression.
   */
  static eq<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '==', value);
  }

  /**
   * Create a not equals expression.
   */
  static ne<T>(
    attrType: new (value: T) => Attribute<T>,
    value: Attribute<T>
  ): ComparisonExpr<T> {
    return new ComparisonExpr(attrType, '!=', value);
  }
}

/**
 * Expression for checking attribute existence.
 *
 * @example
 * ```typescript
 * // Has email attribute
 * const expr = new AttributeExistsExpr(Email);
 * expr.toTypeql('e');
 * // Output: "$e has email $e_email"
 *
 * // Does NOT have email
 * const expr = new AttributeExistsExpr(Email).not();
 * expr.toTypeql('e');
 * // Output: "not { $e has email $e_email; }"
 * ```
 */
export class AttributeExistsExpr<T> extends Expression {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>
  ) {
    super();
  }

  /**
   * Convert to TypeQL pattern.
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;

    return `$${varPrefix} has ${attrName} ${attrVar}`;
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }
}

/**
 * Expression for checking if attribute value is in a set.
 *
 * @example
 * ```typescript
 * // Status in ['active', 'pending']
 * const expr = new InExpr(Status, [new Status('active'), new Status('pending')]);
 * expr.toTypeql('e');
 * // Output: "{ $e has status $e_status; $e_status == \"active\"; } or { $e has status $e_status; $e_status == \"pending\"; }"
 * ```
 */
export class InExpr<T> extends Expression {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>,
    public readonly values: Attribute<T>[]
  ) {
    super();
    if (values.length === 0) {
      throw new Error('InExpr requires at least one value');
    }
  }

  /**
   * Convert to TypeQL pattern using OR branches.
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;

    const branches = this.values.map((val) => {
      const formattedValue = formatExprValue(val);
      return `{ $${varPrefix} has ${attrName} ${attrVar}; ${attrVar} == ${formattedValue}; }`;
    });

    return branches.join(' or ');
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }
}

/**
 * Expression for range checks (between).
 *
 * @example
 * ```typescript
 * // Age between 18 and 65
 * const expr = new RangeExpr(Age, new Age(18), new Age(65));
 * expr.toTypeql('e');
 * // Output: "$e has age $e_age; $e_age >= 18; $e_age <= 65"
 * ```
 */
export class RangeExpr<T> extends Expression {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>,
    public readonly minValue: Attribute<T>,
    public readonly maxValue: Attribute<T>,
    public readonly inclusive: boolean = true
  ) {
    super();
  }

  /**
   * Convert to TypeQL pattern.
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;
    const minFormatted = formatExprValue(this.minValue);
    const maxFormatted = formatExprValue(this.maxValue);

    const minOp = this.inclusive ? '>=' : '>';
    const maxOp = this.inclusive ? '<=' : '<';

    return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} ${minOp} ${minFormatted};\n${attrVar} ${maxOp} ${maxFormatted}`;
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }
}
