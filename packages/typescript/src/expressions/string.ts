/**
 * String expressions for TypeQL queries.
 *
 * Supports string operations like contains, like (regex), startsWith, endsWith.
 */

import type { Attribute } from '../attribute/base.js';
import { StringAttribute } from '../attribute/string.js';
import { Expression, formatExprValue, getAttrName } from './base.js';

/**
 * String operation types.
 */
export type StringOperation = 'contains' | 'like' | 'regex' | 'starts_with' | 'ends_with';

/**
 * String expression for string attribute queries.
 *
 * @example
 * ```typescript
 * // Name contains "alice"
 * const expr = new StringExpr(Name, 'contains', new Name('alice'));
 * expr.toTypeql('e');
 * // Output: "$e has name $e_name; $e_name contains \"alice\""
 *
 * // Email matches pattern
 * const expr = new StringExpr(Email, 'like', new Email('.*@example.com'));
 * expr.toTypeql('e');
 * // Output: "$e has email $e_email; $e_email like \".*@example.com\""
 * ```
 */
export class StringExpr extends Expression {
  constructor(
    public readonly attributeType: typeof StringAttribute,
    public readonly operation: StringOperation,
    public readonly pattern: StringAttribute
  ) {
    super();
  }

  /**
   * Convert to TypeQL pattern with proper variable scoping.
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;
    const patternValue = formatExprValue(this.pattern);

    switch (this.operation) {
      case 'contains':
        return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} contains ${patternValue}`;

      case 'like':
      case 'regex':
        return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} like ${patternValue}`;

      case 'starts_with':
        // Convert to regex pattern: ^pattern.*
        const startPattern = `"^${this.escapeRegex(this.pattern.value)}.*"`;
        return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} like ${startPattern}`;

      case 'ends_with':
        // Convert to regex pattern: .*pattern$
        const endPattern = `".*${this.escapeRegex(this.pattern.value)}$"`;
        return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} like ${endPattern}`;

      default:
        throw new Error(`Unknown string operation: ${this.operation}`);
    }
  }

  /**
   * Escape special regex characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }

  /**
   * Create a contains expression.
   */
  static contains(
    attrType: typeof StringAttribute,
    pattern: StringAttribute
  ): StringExpr {
    return new StringExpr(attrType, 'contains', pattern);
  }

  /**
   * Create a like (regex) expression.
   */
  static like(
    attrType: typeof StringAttribute,
    pattern: StringAttribute
  ): StringExpr {
    return new StringExpr(attrType, 'like', pattern);
  }

  /**
   * Create a starts with expression.
   */
  static startsWith(
    attrType: typeof StringAttribute,
    pattern: StringAttribute
  ): StringExpr {
    return new StringExpr(attrType, 'starts_with', pattern);
  }

  /**
   * Create an ends with expression.
   */
  static endsWith(
    attrType: typeof StringAttribute,
    pattern: StringAttribute
  ): StringExpr {
    return new StringExpr(attrType, 'ends_with', pattern);
  }
}

/**
 * Expression for case-insensitive string matching.
 *
 * Uses regex with case-insensitive flag.
 *
 * @example
 * ```typescript
 * const expr = new CaseInsensitiveExpr(Name, 'ALICE');
 * expr.toTypeql('e');
 * // Output: "$e has name $e_name; $e_name like \"(?i)ALICE\""
 * ```
 */
export class CaseInsensitiveExpr extends Expression {
  constructor(
    public readonly attributeType: typeof StringAttribute,
    public readonly pattern: string
  ) {
    super();
  }

  /**
   * Convert to TypeQL pattern with case-insensitive regex.
   */
  toTypeql(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;
    const escapedPattern = this.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return `$${varPrefix} has ${attrName} ${attrVar};\n${attrVar} like "(?i)${escapedPattern}"`;
  }

  /**
   * Get attribute types used in this expression.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }
}
