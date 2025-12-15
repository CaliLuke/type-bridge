/**
 * Duration attribute type for TypeDB.
 */

import { Attribute } from './base.js';

/**
 * Duration attribute type for ISO 8601 duration values.
 *
 * Durations are stored as ISO 8601 duration strings (e.g., "P1Y2M3D", "PT1H30M").
 *
 * @example
 * class ContractLength extends DurationAttribute {}
 * class SessionTimeout extends DurationAttribute {}
 *
 * const duration = new DurationAttribute("P1Y6M"); // 1 year, 6 months
 * console.log(duration.value); // "P1Y6M"
 */
export class DurationAttribute extends Attribute<string> {
  static readonly valueType = 'duration';

  constructor(value: string) {
    // Validate ISO 8601 duration format
    if (!DurationAttribute.isValidDuration(value)) {
      throw new Error(
        `Invalid ISO 8601 duration format: ${value}. ` +
          'Expected format like "P1Y2M3D" or "PT1H30M45S".'
      );
    }
    super(value);
  }

  override get value(): string {
    return this._value ?? 'PT0S';
  }

  /**
   * Validate ISO 8601 duration format.
   * Supports formats like:
   * - P1Y (1 year)
   * - P2M (2 months)
   * - P3D (3 days)
   * - PT1H (1 hour)
   * - PT30M (30 minutes)
   * - PT45S (45 seconds)
   * - P1Y2M3DT4H5M6S (combined)
   */
  static isValidDuration(value: string): boolean {
    const durationRegex = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
    return durationRegex.test(value) && value !== 'P' && value !== 'PT';
  }

  /**
   * Create a duration from components.
   */
  static fromComponents(components: {
    years?: number;
    months?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
  }): DurationAttribute {
    let duration = 'P';

    if (components.years) duration += `${components.years}Y`;
    if (components.months) duration += `${components.months}M`;
    if (components.days) duration += `${components.days}D`;

    const hasTime = components.hours || components.minutes || components.seconds;
    if (hasTime) {
      duration += 'T';
      if (components.hours) duration += `${components.hours}H`;
      if (components.minutes) duration += `${components.minutes}M`;
      if (components.seconds) duration += `${components.seconds}S`;
    }

    // Default to zero duration if nothing specified
    if (duration === 'P') {
      duration = 'PT0S';
    }

    return new DurationAttribute(duration);
  }

  /**
   * Parse the duration into components.
   */
  toComponents(): {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const match = this.value.match(
      /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
    );

    if (!match) {
      return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      years: parseInt(match[1] ?? '0', 10),
      months: parseInt(match[2] ?? '0', 10),
      days: parseInt(match[3] ?? '0', 10),
      hours: parseInt(match[4] ?? '0', 10),
      minutes: parseInt(match[5] ?? '0', 10),
      seconds: parseFloat(match[6] ?? '0'),
    };
  }
}

// Re-export as Duration for convenience
export { DurationAttribute as Duration };
