/**
 * Decimal attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Decimal attribute type for arbitrary-precision decimal numbers.
 *
 * Note: JavaScript doesn't have native arbitrary-precision decimals,
 * so values are stored as strings to preserve precision. Use a library
 * like decimal.js for calculations if needed.
 *
 * @example
 * class Amount extends DecimalAttribute {}
 * class TaxRate extends DecimalAttribute {}
 *
 * const amount = new Amount("123.456789012345");
 * console.log(amount.value); // "123.456789012345"
 */
export class DecimalAttribute extends Attribute<string> {
  static readonly valueType = 'decimal';

  constructor(value: string | number) {
    // Store as string to preserve precision
    super(typeof value === 'number' ? value.toString() : value);
  }

  override get value(): string {
    return this._value ?? '0';
  }

  /** Get numeric value (may lose precision for very large/precise numbers) */
  toNumber(): number {
    return parseFloat(this.value);
  }

  /** Check if the decimal is zero */
  isZero(): boolean {
    return parseFloat(this.value) === 0;
  }

  /** Check if the decimal is positive */
  isPositive(): boolean {
    return parseFloat(this.value) > 0;
  }

  /** Check if the decimal is negative */
  isNegative(): boolean {
    return parseFloat(this.value) < 0;
  }
}

// Re-export as Decimal for convenience
export { DecimalAttribute as Decimal };
