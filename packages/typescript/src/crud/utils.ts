/**
 * CRUD utilities.
 */

import { Attribute } from '../attribute/base.js';
import type { AttributeFlags } from '../attribute/flags.js';

/**
 * Format a value for TypeQL.
 *
 * @param value - Value to format
 * @returns Formatted string for TypeQL
 */
export function formatValue(value: unknown): string {
  // Extract value from Attribute instances first
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
    // For other types, convert to string and escape
    const strValue = String(value);
    const escaped = strValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
}

/**
 * Check if an attribute is multi-value based on its flags.
 *
 * Multi-value: cardMax > 1 or cardMax is undefined (unbounded)
 * Single-value: cardMax === 1
 *
 * @param flags - Attribute flags
 * @returns True if the attribute can have multiple values
 */
export function isMultiValueAttribute(flags: AttributeFlags): boolean {
  // Check if explicit cardinality was set
  if (flags.cardMax === undefined && flags.cardMin === undefined) {
    // Default cardinality is 0..1 (single value, optional)
    return false;
  }

  const max = flags.cardMax;
  // Multi-value if max > 1 or max is undefined (unbounded)
  return max === undefined || max > 1;
}

/**
 * Get the key attributes for an entity/relation type.
 *
 * @param ownedAttrs - Map of owned attributes
 * @returns Array of [fieldName, attrInfo] pairs for key attributes
 */
export function getKeyAttributes(
  ownedAttrs: Map<string, { typ: { getAttributeName(): string }; flags: AttributeFlags }>
): Array<[string, { typ: { getAttributeName(): string }; flags: AttributeFlags }]> {
  const keyAttrs: Array<[string, { typ: { getAttributeName(): string }; flags: AttributeFlags }]> = [];

  for (const [fieldName, attrInfo] of ownedAttrs) {
    if (attrInfo.flags.isKey) {
      keyAttrs.push([fieldName, attrInfo]);
    }
  }

  return keyAttrs;
}

/**
 * Build a fetch clause for TypeQL 3.x.
 *
 * @param variable - Variable name (e.g., "$e")
 * @returns Fetch clause string
 */
export function buildFetchClause(variable: string): string {
  return `fetch {\n  ${variable}.*\n};`;
}

/**
 * Build attribute match patterns for filtering.
 *
 * @param ownedAttrs - Map of owned attributes
 * @param filters - Filter values by field name
 * @returns Array of match pattern strings
 */
export function buildAttributeFilters(
  ownedAttrs: Map<string, { typ: { getAttributeName(): string }; flags: AttributeFlags }>,
  filters: Record<string, unknown>
): string[] {
  const patterns: string[] = [];

  for (const [fieldName, filterValue] of Object.entries(filters)) {
    const attrInfo = ownedAttrs.get(fieldName);
    if (attrInfo && filterValue !== undefined && filterValue !== null) {
      const attrName = attrInfo.typ.getAttributeName();
      const formattedValue = formatValue(filterValue);
      patterns.push(`has ${attrName} ${formattedValue}`);
    }
  }

  return patterns;
}
