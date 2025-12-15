/**
 * Utility functions and interfaces for TypeDB model classes.
 */

import { Attribute, type AttributeConstructor } from '../attribute/base.js';
import { AttributeFlags } from '../attribute/flags.js';
import {
  validateTypeName as validateReservedWord,
  ValidationError,
} from '../validation.js';

/**
 * Information extracted from a field definition.
 */
export interface FieldInfo {
  /** The Attribute subclass (e.g., Name, Age) */
  attrType: AttributeConstructor | undefined;
  /** Minimum cardinality (undefined means use default) */
  cardMin: number | undefined;
  /** Maximum cardinality (undefined means unbounded) */
  cardMax: number | undefined;
  /** Whether this field is marked as @key */
  isKey: boolean;
  /** Whether this field is marked as @unique */
  isUnique: boolean;
}

/**
 * Metadata for an attribute owned by an Entity or Relation.
 */
export interface ModelAttrInfo {
  /** The Attribute subclass (e.g., Name, Age) */
  typ: AttributeConstructor;
  /** The AttributeFlags with key/unique/card annotations */
  flags: AttributeFlags;
}

/**
 * TypeDB built-in type names that cannot be used.
 */
export const TYPEDB_BUILTIN_TYPES = new Set([
  'thing',
  'entity',
  'relation',
  'attribute',
]);

/**
 * Context for type name validation.
 */
export type TypeContext = 'entity' | 'relation' | 'attribute' | 'role';

/**
 * Validate that a type name doesn't conflict with TypeDB built-ins or TypeQL keywords.
 *
 * @param typeName - The type name to validate
 * @param className - The class name (for error messages)
 * @param context - The type context ("entity", "relation", "attribute", "role")
 * @throws ValidationError if type name conflicts with a TypeDB built-in type or reserved word
 */
export function validateTypeName(
  typeName: string,
  className: string,
  context: TypeContext = 'entity'
): void {
  // First check TypeDB built-in types (thing, entity, relation, attribute)
  if (TYPEDB_BUILTIN_TYPES.has(typeName.toLowerCase())) {
    throw new ValidationError(
      `Type name '${typeName}' for class '${className}' conflicts with TypeDB built-in type. ` +
        `Built-in types are: ${Array.from(TYPEDB_BUILTIN_TYPES).sort().join(', ')}. ` +
        `Please use a different type_name in TypeFlags or rename your class.`
    );
  }

  // Then check TypeQL reserved words
  // This will throw ReservedWordError if typeName is reserved
  validateReservedWord(typeName, context);
}

/**
 * Get the base Python type mapping for TypeDB value types.
 */
export const VALUE_TYPE_MAP: Record<string, string> = {
  string: 'string',
  integer: 'long',
  long: 'long',
  double: 'double',
  boolean: 'boolean',
  datetime: 'datetime',
  'datetime-tz': 'datetime-tz',
  date: 'date',
  decimal: 'decimal',
  duration: 'duration',
};

/**
 * Format a value for TypeQL query.
 *
 * @param value - The value to format
 * @returns Formatted string for TypeQL
 */
export function formatValue(value: unknown): string {
  // Extract value from Attribute instances
  if (value instanceof Attribute) {
    value = value.value;
  }

  if (typeof value === 'string') {
    // Escape backslashes first, then double quotes for TypeQL string literals
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else if (typeof value === 'number') {
    return String(value);
  } else if (value instanceof Date) {
    // TypeDB datetime literals are unquoted ISO 8601 strings
    return value.toISOString();
  } else {
    return String(value);
  }
}

/**
 * Check if a value is a multi-value attribute (array).
 */
export function isMultiValueAttribute(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Create a default FieldInfo with standard cardinality (1,1).
 */
export function createDefaultFieldInfo(): FieldInfo {
  return {
    attrType: undefined,
    cardMin: 1,
    cardMax: 1,
    isKey: false,
    isUnique: false,
  };
}
