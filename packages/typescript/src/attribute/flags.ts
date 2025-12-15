/**
 * Flag system for TypeDB attribute annotations.
 */

/**
 * Type name case formatting options for Entity, Relation, and Attribute types.
 */
export enum TypeNameCase {
  /** Convert class name to lowercase. Example: PersonName -> personname */
  LOWERCASE = 'lowercase',
  /** Keep class name as-is (PascalCase). Example: PersonName -> PersonName */
  CLASS_NAME = 'classname',
  /** Convert class name to snake_case. Example: PersonName -> person_name */
  SNAKE_CASE = 'snake_case',
}

/**
 * Convert a PascalCase or camelCase string to snake_case.
 */
export function toSnakeCase(name: string): string {
  // Insert an underscore before any uppercase letter that follows a lowercase letter
  // or a digit, or before uppercase letters that are followed by lowercase letters
  const s1 = name.replace(/(.+?)([A-Z][a-z]+)/g, '$1_$2');
  // Insert an underscore before any uppercase letter that follows a lowercase letter or digit
  return s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Format a class name according to the specified case style.
 */
export function formatTypeName(className: string, caseStyle: TypeNameCase): string {
  switch (caseStyle) {
    case TypeNameCase.LOWERCASE:
      return className.toLowerCase();
    case TypeNameCase.CLASS_NAME:
      return className;
    case TypeNameCase.SNAKE_CASE:
      return toSnakeCase(className);
    default:
      return className.toLowerCase();
  }
}

/**
 * Metadata flags for Entity and Relation classes.
 */
export interface TypeFlagsOptions {
  /** TypeDB type name (if undefined, uses class name with case formatting) */
  name?: string;
  /** Whether this is an abstract type */
  abstract?: boolean;
  /** Whether this is a TypeScript base class that should not appear in TypeDB schema */
  base?: boolean;
  /** Case formatting for auto-generated type names (default: CLASS_NAME) */
  case?: TypeNameCase;
}

export class TypeFlags {
  name: string | undefined;
  abstract: boolean;
  base: boolean;
  case: TypeNameCase;

  constructor(options: TypeFlagsOptions = {}) {
    this.name = options.name;
    this.abstract = options.abstract ?? false;
    this.base = options.base ?? false;
    this.case = options.case ?? TypeNameCase.CLASS_NAME;
  }
}

/**
 * Cardinality marker for multi-value attribute ownership.
 *
 * IMPORTANT: Card() should only be used with array annotations.
 * For optional single values, use `Type | undefined` instead.
 *
 * @example
 * // tags: Tag[] with at least two
 * tags: Tag[] = Flag(Card({ min: 2 }))
 *
 * // jobs: Job[] with one to five
 * jobs: Job[] = Flag(Card(1, 5))
 *
 * // INCORRECT - use Type | undefined instead:
 * // age: Age = Flag(Card({ min: 0, max: 1 })) // Wrong!
 * age?: Age // Correct
 */
export class Card {
  min: number | undefined;
  max: number | undefined;

  /**
   * Create a cardinality marker.
   *
   * Supports multiple call patterns:
   * - Card(1, 5) -> min=1, max=5
   * - Card({ min: 2 }) -> min=2, max=undefined (unbounded)
   * - Card({ max: 5 }) -> min=0, max=5 (defaults min to 0)
   * - Card({ min: 0, max: 10 }) -> min=0, max=10
   */
  constructor(minOrOptions?: number | { min?: number; max?: number }, max?: number) {
    if (typeof minOrOptions === 'number') {
      // Positional arguments: Card(1, 5) or Card(2)
      this.min = minOrOptions;
      this.max = max;
    } else if (minOrOptions !== undefined) {
      // Object argument: Card({ min: 2, max: 5 })
      // If only max is specified, default min to 0
      if (minOrOptions.min === undefined && minOrOptions.max !== undefined) {
        this.min = 0;
        this.max = minOrOptions.max;
      } else {
        this.min = minOrOptions.min;
        this.max = minOrOptions.max;
      }
    }
  }
}

/**
 * Metadata for attribute ownership and type configuration.
 */
export interface AttributeFlagsOptions {
  isKey?: boolean;
  isUnique?: boolean;
  cardMin?: number;
  cardMax?: number;
  hasExplicitCard?: boolean;
  /** Override attribute type name explicitly */
  name?: string;
  /** Case formatting for type name */
  case?: TypeNameCase;
}

export class AttributeFlags {
  isKey: boolean;
  isUnique: boolean;
  cardMin: number | undefined;
  cardMax: number | undefined;
  hasExplicitCard: boolean;
  name: string | undefined;
  case: TypeNameCase | undefined;

  constructor(options: AttributeFlagsOptions = {}) {
    this.isKey = options.isKey ?? false;
    this.isUnique = options.isUnique ?? false;
    this.cardMin = options.cardMin;
    this.cardMax = options.cardMax;
    this.hasExplicitCard = options.hasExplicitCard ?? false;
    this.name = options.name;
    this.case = options.case;
  }

  /**
   * Convert to TypeQL annotations like @key, @card(0..5).
   *
   * Rules:
   * - @key implies @card(1..1), so never output @card with @key
   * - @unique with @card(1..1) is redundant, so omit @card in that case
   * - Otherwise, always output @card if cardinality is specified
   */
  toTypeqlAnnotations(): string[] {
    const annotations: string[] = [];

    if (this.isKey) {
      annotations.push('@key');
    }
    if (this.isUnique) {
      annotations.push('@unique');
    }

    // Only output @card if:
    // 1. Not a @key (since @key always implies @card(1..1))
    // 2. Not (@unique with default @card(1..1))
    const shouldOutputCard = this.cardMin !== undefined || this.cardMax !== undefined;

    if (shouldOutputCard && !this.isKey) {
      // Check if it's @unique with default (1,1) - if so, omit @card
      const isDefaultCard = this.cardMin === 1 && this.cardMax === 1;
      if (!(this.isUnique && isDefaultCard)) {
        const minVal = this.cardMin ?? 0;
        if (this.cardMax !== undefined) {
          // Use .. syntax for range: @card(1..5)
          annotations.push(`@card(${minVal}..${this.cardMax})`);
        } else {
          // Unbounded max: @card(min..)
          annotations.push(`@card(${minVal}..)`);
        }
      }
    }

    return annotations;
  }
}

/** Key marker symbol */
export const Key = Symbol('Key');

/** Unique marker symbol */
export const Unique = Symbol('Unique');

/** Marker types for type annotations */
export type FlagMarker = typeof Key | typeof Unique | Card;

/**
 * Create attribute flags for Key, Unique, and Card markers.
 *
 * @example
 * // @key (implies @card(1..1))
 * name: Name = Flag(Key)
 *
 * // @unique @card(1..1)
 * email: Email = Flag(Unique)
 *
 * // @card(2..)
 * tags: Tag[] = Flag(Card({ min: 2 }))
 *
 * // @card(1..5)
 * jobs: Job[] = Flag(new Card(1, 5))
 *
 * // @key @unique
 * id: Id = Flag(Key, Unique)
 *
 * // For optional single values, use Type | undefined:
 * age?: Age // @card(0..1) - no Flag needed
 */
export function Flag(...annotations: FlagMarker[]): AttributeFlags {
  const flags = new AttributeFlags();
  let hasCard = false;

  for (const ann of annotations) {
    if (ann === Key) {
      flags.isKey = true;
    } else if (ann === Unique) {
      flags.isUnique = true;
    } else if (ann instanceof Card) {
      flags.cardMin = ann.min;
      flags.cardMax = ann.max;
      flags.hasExplicitCard = true;
      hasCard = true;
    }
  }

  // If Key was used but no Card, set default card(1,1)
  if (flags.isKey && !hasCard) {
    flags.cardMin = 1;
    flags.cardMax = 1;
  }

  return flags;
}
