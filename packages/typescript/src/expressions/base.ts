/**
 * Base Expression classes for building type-safe TypeQL queries.
 *
 * Expressions provide a fluent API for constructing query filters
 * that can be combined using logical operators.
 *
 * Key pattern: Variable scoping with `${varPrefix}_${attrName}` to prevent
 * implicit equality constraints in TypeDB.
 */

import type { Attribute } from '../attribute/base.js';
import type { AttributeFlags } from '../attribute/flags.js';

/**
 * Abstract base class for all query expressions.
 *
 * Expressions generate TypeQL patterns and can be combined using
 * logical operators (and, or, not).
 */
export abstract class Expression {
  /**
   * Convert expression to TypeQL pattern string.
   *
   * @param varPrefix - Variable prefix for scoping (e.g., 'e' for '$e')
   * @returns TypeQL pattern string
   */
  abstract toTypeql(varPrefix: string): string;

  /**
   * Get all attribute types used in this expression.
   *
   * @returns Array of attribute constructor functions
   */
  abstract getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>>;

  /**
   * Combine with another expression using AND.
   *
   * @param other - Expression to combine with
   * @returns BooleanExpr representing the AND combination
   */
  and(other: Expression): BooleanExpr {
    return new BooleanExpr('and', [this, other]);
  }

  /**
   * Alias for and() method.
   */
  and_(other: Expression): BooleanExpr {
    return this.and(other);
  }

  /**
   * Combine with another expression using OR.
   *
   * @param other - Expression to combine with
   * @returns BooleanExpr representing the OR combination
   */
  or(other: Expression): BooleanExpr {
    return new BooleanExpr('or', [this, other]);
  }

  /**
   * Alias for or() method.
   */
  or_(other: Expression): BooleanExpr {
    return this.or(other);
  }

  /**
   * Negate this expression.
   *
   * @returns BooleanExpr representing NOT this expression
   */
  not(): BooleanExpr {
    return new BooleanExpr('not', [this]);
  }

  /**
   * Alias for not() method.
   */
  not_(): BooleanExpr {
    return this.not();
  }
}

/**
 * Boolean operator types.
 */
export type BooleanOperator = 'and' | 'or' | 'not';

/**
 * Boolean expression for combining expressions with logical operators.
 *
 * @example
 * ```typescript
 * // AND combination
 * const expr = new BooleanExpr('and', [ageExpr, nameExpr]);
 *
 * // OR combination
 * const expr = new BooleanExpr('or', [ageExpr, nameExpr]);
 *
 * // NOT
 * const expr = new BooleanExpr('not', [ageExpr]);
 * ```
 */
export class BooleanExpr extends Expression {
  constructor(
    public readonly operator: BooleanOperator,
    public readonly operands: Expression[]
  ) {
    super();
    if (operator === 'not' && operands.length !== 1) {
      throw new Error('NOT operator requires exactly one operand');
    }
    if (operator !== 'not' && operands.length < 2) {
      throw new Error(`${operator.toUpperCase()} operator requires at least two operands`);
    }
  }

  /**
   * Convert to TypeQL pattern.
   *
   * AND: combines patterns directly
   * OR: uses TypeDB's { } or { } syntax
   * NOT: uses TypeDB's not { } syntax
   */
  toTypeql(varPrefix: string): string {
    switch (this.operator) {
      case 'and':
        return this.operands.map((op) => op.toTypeql(varPrefix)).join(';\n');

      case 'or': {
        const branches = this.operands.map(
          (op) => `{ ${op.toTypeql(varPrefix)}; }`
        );
        return branches.join(' or ');
      }

      case 'not':
        return `not { ${this.operands[0]!.toTypeql(varPrefix)}; }`;

      default:
        throw new Error(`Unknown boolean operator: ${this.operator}`);
    }
  }

  /**
   * Get all attribute types from all operands.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    const types: Array<new (value: unknown) => Attribute<unknown>> = [];
    for (const operand of this.operands) {
      types.push(...operand.getAttributeTypes());
    }
    return types;
  }
}

/**
 * Format a value for use in TypeQL queries.
 *
 * @param value - The value to format
 * @returns Formatted string for TypeQL
 */
export function formatExprValue(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error('Cannot format null or undefined value');
  }

  // Handle Attribute instances
  if (typeof value === 'object' && 'value' in value) {
    return formatExprValue((value as { value: unknown }).value);
  }

  if (typeof value === 'string') {
    // Escape backslashes and quotes
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

/**
 * Get the attribute name from an attribute type.
 */
export function getAttrName(
  attrType: new (value: unknown) => Attribute<unknown>
): string {
  const proto = attrType as unknown as {
    getAttributeName?: () => string;
    flags?: AttributeFlags;
    name?: string;
  };

  if (typeof proto.getAttributeName === 'function') {
    return proto.getAttributeName();
  }

  if (proto.flags?.name) {
    return proto.flags.name;
  }

  // Fall back to class name conversion
  const className = proto.name || attrType.name;
  return className
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/attribute$/, '')
    .replace(/_+$/, '');
}
