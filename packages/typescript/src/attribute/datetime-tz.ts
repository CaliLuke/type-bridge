/**
 * DateTimeTZ attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * DateTime with timezone attribute type that accepts Date values.
 *
 * Note: TypeDB datetime-tz preserves timezone information.
 *
 * @example
 * class EventTime extends DateTimeTZAttribute {}
 *
 * const eventTime = new EventTime(new Date());
 * console.log(eventTime.value); // Date object
 */
export class DateTimeTZAttribute extends Attribute<Date> {
  static readonly valueType = 'datetime-tz';

  /** Timezone offset string (e.g., '+09:00', 'Z') */
  private _timezone: string;

  constructor(value: Date | string | number, timezone?: string) {
    super(value instanceof Date ? value : new Date(value));
    // Default to local timezone offset
    this._timezone = timezone ?? this.getLocalTimezoneOffset();
  }

  override get value(): Date {
    return this._value ?? new Date(0);
  }

  /** Get the timezone string */
  get timezone(): string {
    return this._timezone;
  }

  /** Get ISO string representation with timezone */
  toISOString(): string {
    return this.value.toISOString();
  }

  /** Get Unix timestamp in milliseconds */
  getTime(): number {
    return this.value.getTime();
  }

  /** Get local timezone offset string (e.g., '+09:00') */
  private getLocalTimezoneOffset(): string {
    const offset = -this.value.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /** Check if before another datetime */
  isBefore(other: Date | DateTimeTZAttribute): boolean {
    const otherValue = other instanceof DateTimeTZAttribute ? other.value : other;
    return this.value < otherValue;
  }

  /** Check if after another datetime */
  isAfter(other: Date | DateTimeTZAttribute): boolean {
    const otherValue = other instanceof DateTimeTZAttribute ? other.value : other;
    return this.value > otherValue;
  }

  /** Check if same datetime */
  isSame(other: Date | DateTimeTZAttribute): boolean {
    const otherValue = other instanceof DateTimeTZAttribute ? other.value : other;
    return this.value.getTime() === otherValue.getTime();
  }
}

// Re-export as DateTimeTZ for convenience
export { DateTimeTZAttribute as DateTimeTZ };
