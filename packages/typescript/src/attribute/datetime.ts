/**
 * DateTime attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * DateTime attribute type that accepts Date values.
 *
 * Note: TypeDB datetime is stored without timezone information.
 *
 * @example
 * class CreatedAt extends DateTimeAttribute {}
 * class UpdatedAt extends DateTimeAttribute {}
 *
 * const createdAt = new CreatedAt(new Date());
 * console.log(createdAt.value); // Date object
 */
export class DateTimeAttribute extends Attribute<Date> {
  static readonly valueType = 'datetime';

  constructor(value: Date | string | number) {
    super(value instanceof Date ? value : new Date(value));
  }

  override get value(): Date {
    return this._value ?? new Date(0);
  }

  /** Get ISO string representation */
  toISOString(): string {
    return this.value.toISOString();
  }

  /** Get Unix timestamp in milliseconds */
  getTime(): number {
    return this.value.getTime();
  }

  /** Check if before another datetime */
  isBefore(other: Date | DateTimeAttribute): boolean {
    const otherValue = other instanceof DateTimeAttribute ? other.value : other;
    return this.value < otherValue;
  }

  /** Check if after another datetime */
  isAfter(other: Date | DateTimeAttribute): boolean {
    const otherValue = other instanceof DateTimeAttribute ? other.value : other;
    return this.value > otherValue;
  }

  /** Check if same datetime */
  isSame(other: Date | DateTimeAttribute): boolean {
    const otherValue = other instanceof DateTimeAttribute ? other.value : other;
    return this.value.getTime() === otherValue.getTime();
  }
}

// Re-export as DateTime for convenience
export { DateTimeAttribute as DateTime };
