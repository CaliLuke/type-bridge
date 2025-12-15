/**
 * Double attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Double attribute type that accepts floating-point number values.
 *
 * @example
 * class Price extends DoubleAttribute {}
 * class Rating extends DoubleAttribute {}
 *
 * const price = new Price(19.99);
 * console.log(price.value); // 19.99
 */
export class DoubleAttribute extends Attribute<number> {
  static readonly valueType = 'double';

  constructor(value: number) {
    super(value);
  }

  override get value(): number {
    return this._value ?? 0.0;
  }

  /** Convert to number */
  toNumber(): number {
    return this.value;
  }

  /** Add two doubles */
  add(other: number | DoubleAttribute): DoubleAttribute {
    const otherValue = other instanceof DoubleAttribute ? other.value : other;
    return new DoubleAttribute(this.value + otherValue);
  }

  /** Subtract two doubles */
  subtract(other: number | DoubleAttribute): DoubleAttribute {
    const otherValue = other instanceof DoubleAttribute ? other.value : other;
    return new DoubleAttribute(this.value - otherValue);
  }

  /** Multiply two doubles */
  multiply(other: number | DoubleAttribute): DoubleAttribute {
    const otherValue = other instanceof DoubleAttribute ? other.value : other;
    return new DoubleAttribute(this.value * otherValue);
  }

  /** Divide two doubles */
  divide(other: number | DoubleAttribute): DoubleAttribute {
    const otherValue = other instanceof DoubleAttribute ? other.value : other;
    return new DoubleAttribute(this.value / otherValue);
  }

  /** Negate the double */
  negate(): DoubleAttribute {
    return new DoubleAttribute(-this.value);
  }

  /** Absolute value */
  abs(): DoubleAttribute {
    return new DoubleAttribute(Math.abs(this.value));
  }

  /** Round to nearest integer */
  round(): DoubleAttribute {
    return new DoubleAttribute(Math.round(this.value));
  }

  /** Floor */
  floor(): DoubleAttribute {
    return new DoubleAttribute(Math.floor(this.value));
  }

  /** Ceiling */
  ceil(): DoubleAttribute {
    return new DoubleAttribute(Math.ceil(this.value));
  }
}

// Re-export as Double for convenience
export { DoubleAttribute as Double };
