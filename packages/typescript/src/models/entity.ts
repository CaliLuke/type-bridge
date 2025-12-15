/**
 * Entity class for TypeDB entities.
 */

import { Attribute, type AttributeConstructor } from '../attribute/base.js';
import {
  TypeFlags,
  AttributeFlags,
  formatTypeName,
} from '../attribute/flags.js';
import { TypeDBType } from './base.js';
import type { ModelAttrInfo } from './utils.js';
import { validateTypeName } from './utils.js';

/**
 * Configuration for defining an Entity class.
 */
export interface EntityConfig {
  /**
   * TypeFlags for the entity.
   */
  flags?: TypeFlags;

  /**
   * Owned attributes map.
   * Keys are field names, values are objects with typ and flags.
   */
  attributes?: Record<
    string,
    {
      typ: AttributeConstructor;
      flags?: AttributeFlags;
    }
  >;
}

/**
 * Constructor type for Entity classes.
 */
export interface EntityConstructor<T extends Entity = Entity> {
  new (data?: Record<string, unknown>): T;
  readonly _flags: TypeFlags;
  readonly _ownedAttrs: Map<string, ModelAttrInfo>;
  getTypeName(): string;
  getSupertype(): string | undefined;
  isAbstract(): boolean;
  isBase(): boolean;
  getOwnedAttributes(): Map<string, ModelAttrInfo>;
  getAllAttributes(): Map<string, ModelAttrInfo>;
  toSchemaDefinition(): string | undefined;
}

/**
 * Base class for TypeDB entities.
 *
 * Entities own attributes defined as Attribute subclasses.
 * Use TypeFlags to configure type name and abstract status.
 * Supertype is determined automatically from class inheritance.
 *
 * IMPORTANT: When defining instance fields, use `declare` instead of `!` to avoid
 * TypeScript class field initializers from overwriting constructor-set values:
 * - Use: `declare name: Name;`
 * - Don't use: `name!: Name;` (this creates an initializer that runs after the constructor)
 *
 * @example
 * ```typescript
 * // Define attribute types
 * class Name extends StringAttribute {}
 * class Age extends IntegerAttribute {}
 *
 * // Define entity
 * class Person extends Entity {
 *   static override readonly _flags = new TypeFlags({ name: 'person' });
 *   static override readonly _ownedAttrs = new Map([
 *     ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
 *     ['age', { typ: Age, flags: new AttributeFlags() }],
 *   ]);
 *
 *   // Use 'declare' for type-safe field access without initialization
 *   declare name: Name;
 *   declare age: Age | undefined;
 * }
 * ```
 */
export class Entity extends TypeDBType {
  /**
   * TypeFlags configuration for this entity type.
   */
  static override readonly _flags: TypeFlags = new TypeFlags();

  /**
   * Owned attributes defined directly on this entity type.
   */
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map();

  /**
   * Data storage for attribute values.
   */
  [key: string]: unknown;

  /**
   * Create a new entity instance.
   *
   * @param data - Initial attribute values as a plain object
   *
   * @example
   * ```typescript
   * const person = new Person({
   *   name: new Name('Alice'),
   *   age: new Age(30),
   * });
   *
   * // Or with raw values (auto-wrapped)
   * const person2 = new Person({
   *   name: 'Bob',
   *   age: 25,
   * });
   * ```
   */
  constructor(data?: Record<string, unknown>) {
    super();

    if (data) {
      const ownedAttrs = (this.constructor as typeof Entity).getAllAttributes();

      for (const [key, value] of Object.entries(data)) {
        const attrInfo = ownedAttrs.get(key);

        if (attrInfo) {
          // Wrap raw values in Attribute instances
          if (Array.isArray(value)) {
            // Multi-value attribute
            this[key] = value.map((item) =>
              item instanceof attrInfo.typ ? item : new attrInfo.typ(item)
            );
          } else if (value !== undefined && value !== null) {
            // Single value
            this[key] =
              value instanceof attrInfo.typ ? value : new attrInfo.typ(value);
          }
        } else {
          // Unknown field - store as-is
          this[key] = value;
        }
      }
    }
  }

  /**
   * Get the supertype from class inheritance.
   *
   * Base classes (with base=True) don't appear in TypeDB schema.
   * This method skips them when determining the TypeDB supertype.
   *
   * @returns Type name of the parent Entity class, or undefined if direct Entity subclass
   */
  static override getSupertype(): string | undefined {
    // Get the prototype chain
    let proto = Object.getPrototypeOf(this) as typeof Entity | null;

    while (proto && proto !== Entity) {
      // Skip base classes - they don't appear in TypeDB schema
      if (proto._flags?.base) {
        proto = Object.getPrototypeOf(proto) as typeof Entity | null;
        continue;
      }
      return proto.getTypeName();
    }

    return undefined;
  }

  /**
   * Generate TypeQL schema definition for this entity.
   *
   * @returns TypeQL schema definition string, or undefined if this is a base class
   */
  static override toSchemaDefinition(): string | undefined {
    // Base classes don't appear in TypeDB schema
    if (this.isBase()) {
      return undefined;
    }

    const typeName = this.getTypeName();
    const lines: string[] = [];

    // Define entity type with supertype from inheritance
    // TypeDB 3.x syntax: entity name @abstract, sub parent,
    const supertype = this.getSupertype();
    const isAbstract = this.isAbstract();

    let entityDef = `entity ${typeName}`;
    if (isAbstract) {
      entityDef += ' @abstract';
    }
    if (supertype) {
      entityDef += `, sub ${supertype}`;
    }

    lines.push(entityDef);

    // Add attribute ownerships
    for (const [_fieldName, attrInfo] of this._ownedAttrs) {
      const attrClass = attrInfo.typ;
      const flags = attrInfo.flags;
      const attrName = attrClass.getAttributeName();

      let ownership = `    owns ${attrName}`;
      const annotations = flags.toTypeqlAnnotations();
      if (annotations.length > 0) {
        ownership += ' ' + annotations.join(' ');
      }
      lines.push(ownership);
    }

    // Join with commas, end with semicolon
    return lines.join(',\n') + ';';
  }

  /**
   * Generate TypeQL insert query for this entity instance.
   *
   * @param var_ - Variable name to use (default: "$e")
   * @returns TypeQL insert pattern
   */
  override toInsertQuery(var_: string = '$e'): string {
    const typeName = this.getTypeName();
    const parts: string[] = [`${var_} isa ${typeName}`];

    // Use getAllAttributes to include inherited attributes
    const allAttrs = this.getAllAttributes();
    for (const [fieldName, attrInfo] of allAttrs) {
      const value = this[fieldName];
      if (value !== undefined && value !== null) {
        const attrClass = attrInfo.typ;
        const attrName = attrClass.getAttributeName();

        // Handle lists (multi-value attributes)
        if (Array.isArray(value)) {
          for (const item of value) {
            parts.push(`has ${attrName} ${this.formatValue(item)}`);
          }
        } else {
          parts.push(`has ${attrName} ${this.formatValue(value)}`);
        }
      }
    }

    return parts.join(', ');
  }

  /**
   * Convert entity to a plain object.
   *
   * @param options - Serialization options
   * @returns Plain object with attribute values
   */
  toDict(options?: {
    include?: Set<string>;
    exclude?: Set<string>;
    byAlias?: boolean;
    excludeUnset?: boolean;
  }): Record<string, unknown> {
    const { include, exclude, byAlias = false, excludeUnset = false } =
      options ?? {};

    const attrs = this.getAllAttributes();
    const result: Record<string, unknown> = {};

    for (const [fieldName, attrInfo] of attrs) {
      // Apply include/exclude filters
      if (include && !include.has(fieldName)) continue;
      if (exclude?.has(fieldName)) continue;

      const value = this[fieldName];

      // Skip unset values if requested
      if (excludeUnset && value === undefined) continue;

      // Determine key name
      const key = byAlias ? attrInfo.typ.getAttributeName() : fieldName;

      // Unwrap attribute values
      result[key] = this.unwrapValue(value);
    }

    return result;
  }

  /**
   * Create an entity from a plain object.
   *
   * @param data - External data to hydrate the entity
   * @param options - Options for mapping and validation
   * @returns New entity instance
   */
  static fromDict<T extends Entity>(
    this: EntityConstructor<T>,
    data: Record<string, unknown>,
    options?: {
      fieldMapping?: Record<string, string>;
      strict?: boolean;
    }
  ): T {
    const { fieldMapping = {}, strict = true } = options ?? {};

    const attrs = this.getAllAttributes();
    const aliasToField = new Map<string, string>();
    for (const [name, info] of attrs) {
      aliasToField.set(info.typ.getAttributeName(), name);
    }

    const normalized: Record<string, unknown> = {};

    for (const [rawKey, rawValue] of Object.entries(data)) {
      let internalKey = fieldMapping[rawKey] ?? rawKey;

      // Try alias lookup if direct key not found
      if (!attrs.has(internalKey) && aliasToField.has(rawKey)) {
        internalKey = aliasToField.get(rawKey)!;
      }

      if (!attrs.has(internalKey)) {
        if (strict) {
          throw new Error(`Unknown field '${rawKey}' for ${this.name}`);
        }
        continue;
      }

      // Skip null/empty values
      if (rawValue === null || rawValue === '') continue;

      normalized[internalKey] = rawValue;
    }

    return new this(normalized);
  }

  /**
   * Unwrap Attribute instances to their raw values.
   */
  private unwrapValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.unwrapValue(item));
    }
    if (value instanceof Attribute) {
      return value.value;
    }
    return value;
  }

  /**
   * String representation for debugging.
   */
  toString(): string {
    const attrs = this.getOwnedAttributes();
    const keyParts: string[] = [];
    const otherParts: string[] = [];

    for (const [fieldName, attrInfo] of attrs) {
      const value = this[fieldName];
      if (value === undefined || value === null) continue;

      const displayValue = value instanceof Attribute ? value.value : value;
      const fieldStr = `${fieldName}=${displayValue}`;

      if (attrInfo.flags.isKey) {
        keyParts.push(fieldStr);
      } else {
        otherParts.push(fieldStr);
      }
    }

    const allParts = [...keyParts, ...otherParts];
    return `${this.getTypeName()}(${allParts.join(', ')})`;
  }

  /**
   * Inspect representation for debugging.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    const attrs = this.getOwnedAttributes();
    const parts: string[] = [];

    for (const fieldName of attrs.keys()) {
      const value = this[fieldName];
      if (value !== undefined && value !== null) {
        parts.push(`${fieldName}=${JSON.stringify(value)}`);
      }
    }

    return `${this.constructor.name}(${parts.join(', ')})`;
  }
}

/**
 * Define an Entity class with the given configuration.
 *
 * This is a helper function for defining entities with TypeScript.
 *
 * @param config - Entity configuration
 * @returns The configured Entity class
 *
 * @example
 * ```typescript
 * const Person = defineEntity({
 *   flags: new TypeFlags({ name: 'person' }),
 *   attributes: {
 *     name: { typ: Name, flags: new AttributeFlags({ isKey: true }) },
 *     age: { typ: Age },
 *   },
 * });
 * ```
 */
export function defineEntity(config: EntityConfig): typeof Entity {
  // Create a new class extending Entity
  class DefinedEntity extends Entity {
    static override readonly _flags: TypeFlags =
      config.flags ?? new TypeFlags();
    static override readonly _ownedAttrs: Map<string, ModelAttrInfo> =
      new Map();
  }

  // Process attributes configuration
  if (config.attributes) {
    for (const [name, attrConfig] of Object.entries(config.attributes)) {
      (
        DefinedEntity._ownedAttrs as Map<string, ModelAttrInfo>
      ).set(name, {
        typ: attrConfig.typ,
        flags: attrConfig.flags ?? new AttributeFlags(),
      });
    }
  }

  // Validate type name
  if (!DefinedEntity._flags.base) {
    const typeName = formatTypeName(
      DefinedEntity.name,
      DefinedEntity._flags.case
    );
    validateTypeName(
      DefinedEntity._flags.name ?? typeName,
      DefinedEntity.name,
      'entity'
    );
  }

  return DefinedEntity;
}
