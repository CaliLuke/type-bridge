/**
 * Boolean attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Boolean attribute type that accepts boolean values.
 *
 * @example
 * class IsActive extends BooleanAttribute {}
 * class IsVerified extends BooleanAttribute {}
 *
 * const active = new IsActive(true);
 * console.log(active.value); // true
 */
export class BooleanAttribute extends Attribute<boolean> {
  static readonly valueType = 'boolean';

  constructor(value: boolean) {
    super(value);
  }

  override get value(): boolean {
    return this._value ?? false;
  }

  /** Convert to boolean */
  toBoolean(): boolean {
    return this.value;
  }

  /** Logical NOT */
  not(): BooleanAttribute {
    return new BooleanAttribute(!this.value);
  }

  /** Logical AND */
  and(other: boolean | BooleanAttribute): BooleanAttribute {
    const otherValue = other instanceof BooleanAttribute ? other.value : other;
    return new BooleanAttribute(this.value && otherValue);
  }

  /** Logical OR */
  or(other: boolean | BooleanAttribute): BooleanAttribute {
    const otherValue = other instanceof BooleanAttribute ? other.value : other;
    return new BooleanAttribute(this.value || otherValue);
  }
}

// Re-export as Boolean for convenience (though Boolean is a reserved word in TS)
export { BooleanAttribute as Boolean };
