/**
 * String attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * String attribute type that accepts string values.
 *
 * @example
 * class Name extends StringAttribute {}
 * class Email extends StringAttribute {}
 *
 * const name = new Name("Alice");
 * console.log(name.value); // "Alice"
 */
export class StringAttribute extends Attribute<string> {
  static readonly valueType = 'string';

  constructor(value: string) {
    super(value);
  }

  override get value(): string {
    return this._value ?? '';
  }

  override toString(): string {
    return this.value;
  }

  /** Concatenate strings */
  concat(other: string | StringAttribute): StringAttribute {
    const otherValue = other instanceof StringAttribute ? other.value : other;
    return new StringAttribute(this.value + otherValue);
  }

  // ========================================================================
  // String Query Expression Class Methods (Type-Safe API)
  // ========================================================================

  /**
   * Create contains string expression.
   *
   * @example
   * Email.contains(new Email("@company.com"))  // email contains "@company.com"
   */
  static contains(value: StringAttribute): StringExpr {
    return new StringExpr(this, 'contains', value);
  }

  /**
   * Create regex pattern matching expression.
   *
   * @example
   * Name.like(new Name("^A.*"))  // name starts with 'A'
   */
  static like(pattern: StringAttribute): StringExpr {
    return new StringExpr(this, 'like', pattern);
  }

  /**
   * Create regex pattern matching expression (alias for like).
   *
   * @example
   * Email.regex(new Email(".*@gmail\\.com"))  // email matches pattern
   */
  static regex(pattern: StringAttribute): StringExpr {
    return new StringExpr(this, 'regex', pattern);
  }
}

/** String operation types */
export type StringOperation = 'contains' | 'like' | 'regex';

/**
 * String expression for attribute queries.
 */
export class StringExpr {
  constructor(
    public readonly attributeType: typeof StringAttribute,
    public readonly operation: StringOperation,
    public readonly pattern: StringAttribute
  ) {}

  /**
   * Convert to TypeQL pattern.
   */
  toTypeql(varName: string): string {
    const attrName = this.attributeType.getAttributeName();
    const patternValue = `"${this.pattern.value}"`;

    switch (this.operation) {
      case 'contains':
        return `$${varName} has ${attrName} $attr; $attr contains ${patternValue}`;
      case 'like':
      case 'regex':
        return `$${varName} has ${attrName} $attr; $attr like ${patternValue}`;
      default:
        throw new Error(`Unknown string operation: ${this.operation}`);
    }
  }
}

// Re-export as String for convenience (though String is a reserved word in TS)
export { StringAttribute as String };
