/**
 * Relation class for TypeDB relations.
 */

import { Attribute, type AttributeConstructor } from '../attribute/base.js';
import {
  TypeFlags,
  AttributeFlags,
  formatTypeName,
} from '../attribute/flags.js';
import { TypeDBType } from './base.js';
import { Entity } from './entity.js';
import { Role } from './role.js';
import type { ModelAttrInfo } from './utils.js';
import { validateTypeName } from './utils.js';

/**
 * Configuration for defining a Relation class.
 */
export interface RelationConfig {
  /**
   * TypeFlags for the relation.
   */
  flags?: TypeFlags;

  /**
   * Roles defined on this relation.
   */
  roles?: Record<string, Role>;

  /**
   * Owned attributes map.
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
 * Constructor type for Relation classes.
 */
export interface RelationConstructor<T extends Relation = Relation> {
  new (data?: Record<string, unknown>): T;
  readonly _flags: TypeFlags;
  readonly _ownedAttrs: Map<string, ModelAttrInfo>;
  readonly _roles: Map<string, Role>;
  getTypeName(): string;
  getSupertype(): string | undefined;
  isAbstract(): boolean;
  isBase(): boolean;
  getOwnedAttributes(): Map<string, ModelAttrInfo>;
  getAllAttributes(): Map<string, ModelAttrInfo>;
  getRoles(): Map<string, Role>;
  toSchemaDefinition(): string | undefined;
}

/**
 * Base class for TypeDB relations.
 *
 * Relations can own attributes and have role players.
 * Use TypeFlags to configure type name and abstract status.
 * Supertype is determined automatically from class inheritance.
 *
 * IMPORTANT: When defining instance fields, use `declare` instead of `!` to avoid
 * TypeScript class field initializers from overwriting constructor-set values:
 * - Use: `declare employee: Person;`
 * - Don't use: `employee!: Person;` (this creates an initializer that runs after the constructor)
 *
 * @example
 * ```typescript
 * // Define attribute types
 * class Position extends StringAttribute {}
 * class Salary extends IntegerAttribute {}
 *
 * // Define relation
 * class Employment extends Relation {
 *   static override readonly _flags = new TypeFlags({ name: 'employment' });
 *
 *   static override readonly _roles = new Map([
 *     ['employee', new Role('employee', Person)],
 *     ['employer', new Role('employer', Company)],
 *   ]);
 *
 *   static override readonly _ownedAttrs = new Map([
 *     ['position', { typ: Position, flags: new AttributeFlags() }],
 *     ['salary', { typ: Salary, flags: new AttributeFlags() }],
 *   ]);
 *
 *   // Use 'declare' for type-safe field access without initialization
 *   declare employee: Person;
 *   declare employer: Company;
 *   declare position: Position;
 *   declare salary: Salary | undefined;
 * }
 * ```
 */
export class Relation extends TypeDBType {
  /**
   * TypeFlags configuration for this relation type.
   */
  static override readonly _flags: TypeFlags = new TypeFlags();

  /**
   * Owned attributes defined directly on this relation type.
   */
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map();

  /**
   * Roles defined on this relation type.
   */
  static readonly _roles: Map<string, Role> = new Map();

  /**
   * Data storage for attribute and role player values.
   */
  [key: string]: unknown;

  /**
   * Create a new relation instance.
   *
   * @param data - Initial attribute and role player values
   *
   * @example
   * ```typescript
   * const employment = new Employment({
   *   employee: alice,
   *   employer: techCorp,
   *   position: new Position('Engineer'),
   *   salary: new Salary(100000),
   * });
   * ```
   */
  constructor(data?: Record<string, unknown>) {
    super();

    if (data) {
      const ownedAttrs = (
        this.constructor as typeof Relation
      ).getAllAttributes();
      const roles = (this.constructor as typeof Relation).getRoles();

      for (const [key, value] of Object.entries(data)) {
        const attrInfo = ownedAttrs.get(key);
        const role = roles.get(key);

        if (attrInfo) {
          // Wrap raw values in Attribute instances
          if (Array.isArray(value)) {
            this[key] = value.map((item) =>
              item instanceof attrInfo.typ ? item : new attrInfo.typ(item)
            );
          } else if (value !== undefined && value !== null) {
            this[key] =
              value instanceof attrInfo.typ ? value : new attrInfo.typ(value);
          }
        } else if (role) {
          // Validate and set role player
          if (value !== undefined && value !== null) {
            role.validatePlayer(value);
            this[key] = value;
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
   * @returns Type name of the parent Relation class, or undefined if direct Relation subclass
   */
  static override getSupertype(): string | undefined {
    let proto = Object.getPrototypeOf(this) as typeof Relation | null;

    while (proto && proto !== Relation) {
      if (proto._flags?.base) {
        proto = Object.getPrototypeOf(proto) as typeof Relation | null;
        continue;
      }
      return proto.getTypeName();
    }

    return undefined;
  }

  /**
   * Get all roles defined on this relation.
   *
   * @returns Map of field names to Role instances
   */
  static getRoles(): Map<string, Role> {
    const allRoles = new Map<string, Role>();

    // Get prototype chain
    let proto = this as unknown as typeof Relation | null;
    const chain: Array<typeof Relation> = [];

    while (proto && proto !== Relation) {
      if (proto._roles) {
        chain.unshift(proto);
      }
      proto = Object.getPrototypeOf(proto) as typeof Relation | null;
    }

    // Add roles from base to derived
    for (const cls of chain) {
      if (cls._roles) {
        for (const [name, role] of cls._roles) {
          allRoles.set(name, role);
        }
      }
    }

    return allRoles;
  }

  /**
   * Get roles for this instance.
   */
  getRoles(): Map<string, Role> {
    return (this.constructor as typeof Relation).getRoles();
  }

  /**
   * Generate TypeQL schema definition for this relation.
   *
   * @returns TypeQL schema definition string, or undefined if this is a base class
   */
  static override toSchemaDefinition(): string | undefined {
    if (this.isBase()) {
      return undefined;
    }

    const typeName = this.getTypeName();
    const lines: string[] = [];

    // Define relation type
    const supertype = this.getSupertype();
    const isAbstract = this.isAbstract();

    let relationDef = `relation ${typeName}`;
    if (isAbstract) {
      relationDef += ' @abstract';
    }
    if (supertype) {
      relationDef += `, sub ${supertype}`;
    }

    lines.push(relationDef);

    // Add roles
    for (const [_fieldName, role] of this._roles) {
      lines.push(`    relates ${role.roleName}`);
    }

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

    return lines.join(',\n') + ';';
  }

  /**
   * Generate TypeQL insert query for this relation instance.
   *
   * @param var_ - Variable name to use (default: "$r")
   * @returns TypeQL insert pattern
   */
  override toInsertQuery(var_: string = '$r'): string {
    const typeName = this.getTypeName();
    const roles = (this.constructor as typeof Relation).getRoles();

    // Build role players
    const roleParts: string[] = [];
    for (const [roleName, role] of roles) {
      const entity = this[roleName] as Entity | undefined;
      if (entity !== undefined) {
        // Use a variable based on the role name
        roleParts.push(`${role.roleName}: $${roleName}`);
      }
    }

    // Start with relation pattern
    const relationPattern = `${var_} (${roleParts.join(', ')}) isa ${typeName}`;
    const parts: string[] = [relationPattern];

    // Add attribute ownerships
    for (const [fieldName, attrInfo] of (
      this.constructor as typeof Relation
    )._ownedAttrs) {
      const value = this[fieldName];
      if (value !== undefined && value !== null) {
        const attrClass = attrInfo.typ;
        const attrName = attrClass.getAttributeName();

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
   * Convert relation to a plain object.
   */
  toDict(options?: {
    include?: Set<string>;
    exclude?: Set<string>;
    byAlias?: boolean;
  }): Record<string, unknown> {
    const { include, exclude, byAlias = false } = options ?? {};

    const attrs = this.getAllAttributes();
    const roles = this.getRoles();
    const result: Record<string, unknown> = {};

    // Add role players
    for (const [fieldName, role] of roles) {
      if (include && !include.has(fieldName)) continue;
      if (exclude?.has(fieldName)) continue;

      const value = this[fieldName] as Entity | undefined;
      if (value !== undefined) {
        result[byAlias ? role.roleName : fieldName] = value.toDict();
      }
    }

    // Add attributes
    for (const [fieldName, attrInfo] of attrs) {
      if (include && !include.has(fieldName)) continue;
      if (exclude?.has(fieldName)) continue;

      const value = this[fieldName];
      if (value === undefined) continue;

      const key = byAlias ? attrInfo.typ.getAttributeName() : fieldName;
      result[key] = this.unwrapValue(value);
    }

    return result;
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
    const roles = this.getRoles();
    const attrs = this.getOwnedAttributes();
    const parts: string[] = [];

    // Show role players first
    const roleParts: string[] = [];
    for (const [roleName] of roles) {
      const player = this[roleName] as Entity | undefined;
      if (player !== undefined) {
        // Get key attribute for display
        let playerStr: string | undefined;
        for (const [fieldName, attrInfo] of player.getOwnedAttributes()) {
          if (attrInfo.flags.isKey) {
            const keyValue = player[fieldName];
            if (keyValue !== undefined) {
              playerStr =
                keyValue instanceof Attribute
                  ? String(keyValue.value)
                  : String(keyValue);
              break;
            }
          }
        }
        if (playerStr) {
          roleParts.push(`${roleName}=${playerStr}`);
        }
      }
    }

    if (roleParts.length > 0) {
      parts.push(`(${roleParts.join(', ')})`);
    }

    // Show attributes
    const attrParts: string[] = [];
    for (const [fieldName] of attrs) {
      const value = this[fieldName];
      if (value === undefined || value === null) continue;

      const displayValue = value instanceof Attribute ? value.value : value;
      attrParts.push(`${fieldName}=${displayValue}`);
    }

    if (attrParts.length > 0) {
      parts.push(`[${attrParts.join(', ')}]`);
    }

    const typeName = this.getTypeName();
    return parts.length > 0 ? `${typeName}${parts.join(' ')}` : `${typeName}()`;
  }

  /**
   * Inspect representation for debugging.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    const roles = this.getRoles();
    const attrs = this.getOwnedAttributes();
    const parts: string[] = [];

    // Show role players
    for (const [roleName] of roles) {
      const player = this[roleName];
      if (player !== undefined) {
        parts.push(`${roleName}=${JSON.stringify(player)}`);
      }
    }

    // Show attributes
    for (const [fieldName] of attrs) {
      const value = this[fieldName];
      if (value !== undefined && value !== null) {
        parts.push(`${fieldName}=${JSON.stringify(value)}`);
      }
    }

    return `${this.constructor.name}(${parts.join(', ')})`;
  }
}

/**
 * Define a Relation class with the given configuration.
 *
 * @param config - Relation configuration
 * @returns The configured Relation class
 */
export function defineRelation(config: RelationConfig): typeof Relation {
  class DefinedRelation extends Relation {
    static override readonly _flags: TypeFlags =
      config.flags ?? new TypeFlags();
    static override readonly _ownedAttrs: Map<string, ModelAttrInfo> =
      new Map();
    static override readonly _roles: Map<string, Role> = new Map();
  }

  // Process roles
  if (config.roles) {
    for (const [name, role] of Object.entries(config.roles)) {
      role.attrName = name;
      (DefinedRelation._roles as Map<string, Role>).set(name, role);
    }
  }

  // Process attributes
  if (config.attributes) {
    for (const [name, attrConfig] of Object.entries(config.attributes)) {
      (DefinedRelation._ownedAttrs as Map<string, ModelAttrInfo>).set(name, {
        typ: attrConfig.typ,
        flags: attrConfig.flags ?? new AttributeFlags(),
      });
    }
  }

  // Validate type name
  if (!DefinedRelation._flags.base) {
    const typeName = formatTypeName(
      DefinedRelation.name,
      DefinedRelation._flags.case
    );
    validateTypeName(
      DefinedRelation._flags.name ?? typeName,
      DefinedRelation.name,
      'relation'
    );
  }

  return DefinedRelation;
}
