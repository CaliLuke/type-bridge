/**
 * Abstract base class for TypeDB entities and relations.
 */

import { TypeFlags, formatTypeName } from '../attribute/flags.js';
import type { ModelAttrInfo } from './utils.js';
import { formatValue, validateTypeName } from './utils.js';

/**
 * Constructor type for TypeDBType subclasses.
 */
export interface TypeDBTypeConstructor<T extends TypeDBType = TypeDBType> {
  new (...args: unknown[]): T;
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
 * Abstract base class for TypeDB entities and relations.
 *
 * This class provides common functionality for both Entity and Relation types,
 * including type name management, abstract/base flags, and attribute ownership.
 *
 * Subclasses must implement:
 * - getSupertype(): Get parent type in TypeDB hierarchy
 * - toSchemaDefinition(): Generate TypeQL schema definition
 * - toInsertQuery(): Generate TypeQL insert query for instances
 */
export abstract class TypeDBType {
  /**
   * TypeFlags configuration for this type.
   * Override in subclasses to customize type name, abstract status, etc.
   */
  static readonly _flags: TypeFlags = new TypeFlags();

  /**
   * Owned attributes defined directly on this type (not inherited).
   * Populated by subclasses during initialization.
   */
  static readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map();

  /**
   * TypeDB internal ID (populated when fetched from database).
   */
  _iid?: string;

  /**
   * Get the TypeDB type name for this type.
   *
   * If name is explicitly set in TypeFlags, it is used as-is.
   * Otherwise, the class name is formatted according to the case parameter.
   */
  static getTypeName(): string {
    const flags = this._flags;
    if (flags.name) {
      return flags.name;
    }
    return formatTypeName(this.name, flags.case);
  }

  /**
   * Get the supertype from the class hierarchy.
   * Must be implemented by subclasses.
   *
   * @returns Type name of the parent class, or undefined if direct subclass
   */
  static getSupertype(): string | undefined {
    // Abstract method - implemented by Entity and Relation
    return undefined;
  }

  /**
   * Check if this is an abstract type.
   */
  static isAbstract(): boolean {
    return this._flags.abstract;
  }

  /**
   * Check if this is a Python-only base class (not in TypeDB schema).
   */
  static isBase(): boolean {
    return this._flags.base;
  }

  /**
   * Get attributes owned directly by this type (not inherited).
   *
   * @returns Map of field names to ModelAttrInfo (typ + flags)
   */
  static getOwnedAttributes(): Map<string, ModelAttrInfo> {
    return new Map(this._ownedAttrs);
  }

  /**
   * Get all attributes including inherited ones.
   *
   * Traverses the class hierarchy to collect all owned attributes,
   * including those from parent Entity/Relation classes.
   *
   * @returns Map of field names to ModelAttrInfo (typ + flags)
   */
  static getAllAttributes(): Map<string, ModelAttrInfo> {
    const allAttrs = new Map<string, ModelAttrInfo>();

    // Get prototype chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let proto = this as any;
    const chain: TypeDBTypeConstructor[] = [];

    while (proto && proto.name !== 'TypeDBType') {
      if (proto._ownedAttrs) {
        chain.unshift(proto as TypeDBTypeConstructor);
      }
      proto = Object.getPrototypeOf(proto);
    }

    // Add attributes from base to derived (child overrides parent)
    for (const cls of chain) {
      if (cls._ownedAttrs) {
        for (const [name, info] of cls._ownedAttrs) {
          allAttrs.set(name, info);
        }
      }
    }

    return allAttrs;
  }

  /**
   * Generate TypeQL schema definition for this type.
   * Must be implemented by subclasses.
   *
   * @returns TypeQL schema definition string, or undefined if this is a base class
   */
  static toSchemaDefinition(): string | undefined {
    // Abstract method - implemented by Entity and Relation
    return undefined;
  }

  /**
   * Generate TypeQL insert query for this instance.
   * Must be implemented by subclasses.
   *
   * @param var_ - Variable name to use
   * @returns TypeQL insert pattern
   */
  abstract toInsertQuery(var_?: string): string;

  /**
   * Get the TypeDB type name for this instance.
   */
  getTypeName(): string {
    return (this.constructor as typeof TypeDBType).getTypeName();
  }

  /**
   * Get owned attributes for this instance's class.
   */
  getOwnedAttributes(): Map<string, ModelAttrInfo> {
    return (this.constructor as typeof TypeDBType).getOwnedAttributes();
  }

  /**
   * Get all attributes including inherited ones for this instance's class.
   */
  getAllAttributes(): Map<string, ModelAttrInfo> {
    return (this.constructor as typeof TypeDBType).getAllAttributes();
  }

  /**
   * Format a value for TypeQL.
   */
  protected formatValue(value: unknown): string {
    return formatValue(value);
  }

  /**
   * Validate type name doesn't conflict with TypeDB built-ins.
   * Called during subclass initialization.
   */
  protected static validateTypeName(
    typeName: string,
    className: string,
    context: 'entity' | 'relation' = 'entity'
  ): void {
    validateTypeName(typeName, className, context);
  }
}

/**
 * Initialize a TypeDBType subclass with proper metadata.
 *
 * This function should be called in the static initialization of Entity/Relation subclasses
 * to set up the _flags and _ownedAttrs properties.
 *
 * @param cls - The class to initialize
 * @param flags - TypeFlags for the class (or undefined to use default)
 * @param ownedAttrs - Map of owned attributes
 * @param context - Context for validation ('entity' or 'relation')
 */
export function initializeTypeDBType(
  cls: typeof TypeDBType,
  flags: TypeFlags | undefined,
  ownedAttrs: Map<string, ModelAttrInfo>,
  context: 'entity' | 'relation' = 'entity'
): void {
  // Set flags (create new instance if not provided)
  const typeFlags = flags ?? new TypeFlags();

  // Use Object.defineProperty to set static properties on the class
  Object.defineProperty(cls, '_flags', {
    value: typeFlags,
    writable: false,
    configurable: true,
  });

  Object.defineProperty(cls, '_ownedAttrs', {
    value: ownedAttrs,
    writable: false,
    configurable: true,
  });

  // Validate type name if not a base class
  if (!typeFlags.base) {
    const typeName = typeFlags.name ?? formatTypeName(cls.name, typeFlags.case);
    validateTypeName(typeName, cls.name, context);
  }
}
