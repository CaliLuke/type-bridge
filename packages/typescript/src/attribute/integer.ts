/**
 * Integer attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Integer attribute type that accepts number values.
 *
 * @example
 * class Age extends IntegerAttribute {}
 * class Count extends IntegerAttribute {}
 *
 * const age = new Age(30);
 * console.log(age.value); // 30
 */
export class IntegerAttribute extends Attribute<number> {
  static readonly valueType = 'integer';

  constructor(value: number) {
    super(Math.floor(value)); // Ensure integer
  }

  override get value(): number {
    return this._value ?? 0;
  }

  /** Convert to number */
  toNumber(): number {
    return this.value;
  }

  /** Add two integers */
  add(other: number | IntegerAttribute): IntegerAttribute {
    const otherValue = other instanceof IntegerAttribute ? other.value : other;
    return new IntegerAttribute(this.value + otherValue);
  }

  /** Subtract two integers */
  subtract(other: number | IntegerAttribute): IntegerAttribute {
    const otherValue = other instanceof IntegerAttribute ? other.value : other;
    return new IntegerAttribute(this.value - otherValue);
  }

  /** Multiply two integers */
  multiply(other: number | IntegerAttribute): IntegerAttribute {
    const otherValue = other instanceof IntegerAttribute ? other.value : other;
    return new IntegerAttribute(this.value * otherValue);
  }

  /** Floor division */
  divide(other: number | IntegerAttribute): IntegerAttribute {
    const otherValue = other instanceof IntegerAttribute ? other.value : other;
    return new IntegerAttribute(Math.floor(this.value / otherValue));
  }

  /** Modulo operation */
  mod(other: number | IntegerAttribute): IntegerAttribute {
    const otherValue = other instanceof IntegerAttribute ? other.value : other;
    return new IntegerAttribute(this.value % otherValue);
  }

  /** Negate the integer */
  negate(): IntegerAttribute {
    return new IntegerAttribute(-this.value);
  }

  /** Absolute value */
  abs(): IntegerAttribute {
    return new IntegerAttribute(Math.abs(this.value));
  }
}

// Re-export as Integer for convenience
export { IntegerAttribute as Integer };
