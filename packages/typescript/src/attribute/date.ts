/**
 * Date attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Date attribute type that accepts Date values (date only, no time).
 *
 * @example
 * class BirthDate extends DateAttribute {}
 * class HireDate extends DateAttribute {}
 *
 * const birthDate = new BirthDate(new Date('1990-01-15'));
 * console.log(birthDate.value); // Date object
 */
export class DateAttribute extends Attribute<Date> {
  static readonly valueType = 'date';

  constructor(value: Date | string) {
    // Normalize to midnight UTC to represent date-only
    const date = value instanceof Date ? value : new Date(value);
    const normalizedDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    super(normalizedDate);
  }

  override get value(): Date {
    return this._value ?? new Date(0);
  }

  /** Get ISO date string (YYYY-MM-DD) */
  toISODateString(): string {
    return this.value.toISOString().split('T')[0] ?? '';
  }

  /** Get year */
  getYear(): number {
    return this.value.getUTCFullYear();
  }

  /** Get month (1-12) */
  getMonth(): number {
    return this.value.getUTCMonth() + 1;
  }

  /** Get day of month (1-31) */
  getDay(): number {
    return this.value.getUTCDate();
  }

  /** Check if before another date */
  isBefore(other: Date | DateAttribute): boolean {
    const otherValue = other instanceof DateAttribute ? other.value : other;
    return this.value < otherValue;
  }

  /** Check if after another date */
  isAfter(other: Date | DateAttribute): boolean {
    const otherValue = other instanceof DateAttribute ? other.value : other;
    return this.value > otherValue;
  }

  /** Check if same date */
  isSame(other: Date | DateAttribute): boolean {
    const otherValue = other instanceof DateAttribute ? other.value : other;
    return this.toISODateString() ===
      (otherValue instanceof Date ? otherValue.toISOString().split('T')[0] : '');
  }
}

// Note: Not aliasing as "Date" to avoid conflict with built-in Date type
