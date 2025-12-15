/**
 * Base Attribute class for TypeDB attribute types.
 */

import { AttributeFlags, TypeNameCase, formatTypeName } from './flags.js';

/** TypeDB built-in type names that cannot be used for attributes */
export const TYPEDB_BUILTIN_TYPES = new Set(['thing', 'entity', 'relation', 'attribute']);

/**
 * Validate that an attribute name doesn't conflict with TypeDB built-ins.
 *
 * @param attrName - The attribute name to validate
 * @param className - The TypeScript class name (for error messages)
 * @throws Error if attribute name conflicts with a TypeDB built-in type
 */
export function validateAttributeName(attrName: string, className: string): void {
  if (TYPEDB_BUILTIN_TYPES.has(attrName.toLowerCase())) {
    throw new Error(
      `Attribute name '${attrName}' for class '${className}' conflicts with TypeDB built-in type. ` +
        `Built-in types are: ${[...TYPEDB_BUILTIN_TYPES].sort().join(', ')}. ` +
        `Please rename your attribute class to avoid this conflict.`
    );
  }
}

/**
 * Metadata interface for attribute class registration.
 */
export interface AttributeMetadata {
  /** The computed TypeDB attribute name */
  attributeName: string;
  /** The TypeDB value type (string, integer, double, etc.) */
  valueType: string;
  /** Whether this is an abstract attribute */
  abstract: boolean;
  /** Whether this attribute is a key */
  isKey: boolean;
  /** The supertype if this attribute extends another */
  supertype?: string;
}

/** Global registry of attribute classes */
const attributeRegistry = new Map<Function, AttributeMetadata>();

/**
 * Get attribute metadata for a class.
 */
export function getAttributeMetadata(attributeClass: Function): AttributeMetadata | undefined {
  return attributeRegistry.get(attributeClass);
}

/**
 * Register attribute metadata for a class.
 */
export function registerAttribute(
  attributeClass: Function,
  metadata: AttributeMetadata
): void {
  attributeRegistry.set(attributeClass, metadata);
}

/**
 * Base class for TypeDB attributes.
 *
 * Attributes in TypeDB are value types that can be owned by entities and relations.
 *
 * Attribute instances store values, allowing type-safe construction:
 * ```typescript
 * new Name("Alice")  // Creates Name instance with value "Alice"
 * new Age(30)        // Creates Age instance with value 30
 * ```
 *
 * Type name formatting:
 * You can control how the class name is converted to TypeDB attribute name
 * using the 'flags' static property.
 *
 * @example
 * class Name extends StringAttribute {
 *   // TypeDB attribute: "Name" (default CLASS_NAME)
 * }
 *
 * class PersonName extends StringAttribute {
 *   static flags = new AttributeFlags({ case: TypeNameCase.SNAKE_CASE });
 *   // TypeDB attribute: "person_name"
 * }
 *
 * class PersonName extends StringAttribute {
 *   static flags = new AttributeFlags({ name: "full_name" });
 *   // Explicit override: TypeDB attribute: "full_name"
 * }
 */
export abstract class Attribute<T> {
  /** TypeDB value type (string, integer, double, boolean, datetime) */
  static readonly valueType: string;
  /** Whether this attribute is abstract */
  static readonly abstract: boolean = false;
  /** Attribute flags for configuration */
  static flags?: AttributeFlags;

  /** The stored value */
  protected _value: T;

  constructor(value: T) {
    this._value = value;
  }

  /** Get the stored value */
  get value(): T {
    return this._value;
  }

  /** String representation returns the stored value */
  toString(): string {
    return this._value !== null && this._value !== undefined
      ? String(this._value)
      : '';
  }

  /**
   * Compare attribute with another attribute instance.
   *
   * For strict type safety, Attribute instances do NOT compare equal to raw values.
   * To access the raw value, use the `.value` property.
   *
   * @example
   * new Age(20).equals(new Age(20))  // true (same type, same value)
   * new Age(20).equals(new Id(20))   // false (different types!)
   * new Age(20).value === 20         // true (access raw value explicitly)
   */
  equals(other: unknown): boolean {
    if (other instanceof Attribute) {
      // Compare two attribute instances: both type and value must match
      return this.constructor === other.constructor && this._value === other._value;
    }
    // Do not compare with non-Attribute objects (strict type safety)
    return false;
  }

  /**
   * Get the TypeDB attribute name.
   *
   * If flags.name is explicitly set, it is used as-is.
   * Otherwise, the class name is formatted according to the case parameter.
   * Default case is CLASS_NAME (preserves class name as-is).
   */
  static getAttributeName(): string {
    const metadata = getAttributeMetadata(this);
    if (metadata) {
      return metadata.attributeName;
    }

    // Compute and register if not already registered
    const flags = (this as typeof Attribute).flags;
    let attributeName: string;

    if (flags?.name !== undefined) {
      attributeName = flags.name;
    } else {
      const caseStyle = flags?.case ?? TypeNameCase.CLASS_NAME;
      attributeName = formatTypeName(this.name, caseStyle);
    }

    return attributeName;
  }

  /** Get the TypeDB value type */
  static getValueType(): string {
    return (this as typeof Attribute).valueType;
  }

  /** Check if this attribute is abstract */
  static isAbstract(): boolean {
    return (this as typeof Attribute).abstract;
  }

  /**
   * Generate TypeQL schema definition for this attribute.
   *
   * @returns TypeQL schema definition string
   */
  static toSchemaDefinition(): string {
    const attrName = this.getAttributeName();
    const valueType = this.getValueType();
    const metadata = getAttributeMetadata(this);

    let definition: string;
    if (metadata?.supertype) {
      definition = `attribute ${attrName} sub ${metadata.supertype}, value ${valueType}`;
    } else {
      definition = `attribute ${attrName}, value ${valueType}`;
    }

    if (this.isAbstract()) {
      definition += ', abstract';
    }

    return definition + ';';
  }

  // ========================================================================
  // Query Expression Class Methods (Type-Safe API)
  // These will be implemented when expressions module is ported
  // ========================================================================

  /**
   * Create greater-than comparison expression.
   *
   * @example
   * Age.gt(new Age(30))  // age > 30
   */
  static gt<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '>', value);
  }

  /**
   * Create less-than comparison expression.
   *
   * @example
   * Age.lt(new Age(30))  // age < 30
   */
  static lt<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '<', value);
  }

  /**
   * Create greater-than-or-equal comparison expression.
   *
   * @example
   * Salary.gte(new Salary(80000.0))  // salary >= 80000
   */
  static gte<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '>=', value);
  }

  /**
   * Create less-than-or-equal comparison expression.
   *
   * @example
   * Age.lte(new Age(65))  // age <= 65
   */
  static lte<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '<=', value);
  }

  /**
   * Create equality comparison expression.
   *
   * @example
   * Status.eq(new Status("active"))  // status == "active"
   */
  static eq<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '==', value);
  }

  /**
   * Create not-equal comparison expression.
   *
   * @example
   * Status.neq(new Status("deleted"))  // status != "deleted"
   */
  static neq<V>(this: new (value: V) => Attribute<V>, value: Attribute<V>): ComparisonExpr<V> {
    return new ComparisonExpr(this, '!=', value);
  }
}

/**
 * Constructor type for Attribute subclasses.
 */
export interface AttributeConstructor<T = unknown> {
  new (value: T): Attribute<T>;
  readonly valueType: string;
  readonly abstract: boolean;
  flags?: AttributeFlags;
  getAttributeName(): string;
  getValueType(): string;
  isAbstract(): boolean;
  toSchemaDefinition(): string;
}

/**
 * Comparison operators for TypeQL queries.
 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Comparison expression for attribute queries.
 * This is a placeholder - full implementation will be in expressions module.
 */
export class ComparisonExpr<T> {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>,
    public readonly operator: ComparisonOperator,
    public readonly value: Attribute<T>
  ) {}

  /**
   * Convert to TypeQL pattern.
   */
  toTypeql(varName: string): string {
    const attrName = (this.attributeType as unknown as typeof Attribute).getAttributeName();
    const formattedValue = this.formatValue(this.value.value);
    return `$${varName} has ${attrName} ${this.operator} ${formattedValue}`;
  }

  private formatValue(value: T): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }
}
