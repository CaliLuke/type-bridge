/**
 * Role class for TypeDB relation role players.
 */

import { validateTypeName } from '../validation.js';

/**
 * Interface for entity types that can be role players.
 * Uses an interface instead of importing Entity to avoid circular dependencies.
 */
export interface RolePlayerClass {
  new (...args: unknown[]): unknown;
  getTypeName(): string;
  readonly name: string;
}

/**
 * Role class for defining relation role players with type safety.
 *
 * @template T - The entity type(s) that can play this role
 *
 * @example
 * ```typescript
 * class Employment extends Relation {
 *   static employee = new Role('employee', Person);
 *   static employer = new Role('employer', Company);
 * }
 * ```
 */
export class Role<T = unknown> {
  /**
   * The name of the role in TypeDB.
   */
  readonly roleName: string;

  /**
   * The entity types that can play this role.
   */
  readonly playerEntityTypes: ReadonlyArray<RolePlayerClass>;

  /**
   * The primary player type (first one).
   */
  readonly playerEntityType: RolePlayerClass;

  /**
   * Type names of entities that can play this role.
   */
  readonly playerTypes: readonly string[];

  /**
   * Primary player type name.
   */
  readonly playerType: string;

  /**
   * The attribute name (field name) on the Relation class.
   */
  attrName?: string;

  /**
   * Create a new role definition.
   *
   * @param roleName - The name of the role in TypeDB
   * @param playerType - The entity type that can play this role
   * @param additionalPlayerTypes - Optional additional entity types allowed to play this role
   * @throws ReservedWordError if roleName is a TypeQL reserved word
   *
   * @example
   * ```typescript
   * // Single player type
   * const employee = new Role('employee', Person);
   *
   * // Multiple player types
   * const participant = new Role('participant', Person, Organization);
   * ```
   */
  constructor(
    roleName: string,
    playerType: RolePlayerClass,
    ...additionalPlayerTypes: RolePlayerClass[]
  ) {
    // Validate role name doesn't conflict with TypeQL reserved words
    validateTypeName(roleName, 'role');

    this.roleName = roleName;

    // Collect unique player types
    const uniqueTypes: RolePlayerClass[] = [];
    for (const typ of [playerType, ...additionalPlayerTypes]) {
      if (!uniqueTypes.includes(typ)) {
        uniqueTypes.push(typ);
      }
    }

    if (uniqueTypes.length === 0) {
      throw new Error('Role requires at least one player type');
    }

    this.playerEntityTypes = Object.freeze(uniqueTypes);
    this.playerEntityType = uniqueTypes[0]!;

    // Get type names from entity classes
    this.playerTypes = Object.freeze(
      uniqueTypes.map((pt) => pt.getTypeName())
    );
    this.playerType = this.playerEntityType.getTypeName();
  }

  /**
   * Create a role that can be played by multiple entity types.
   *
   * @param roleName - The name of the role in TypeDB
   * @param playerType - First entity type that can play this role
   * @param additionalPlayerTypes - Additional entity types allowed to play this role
   * @returns A new Role instance
   * @throws Error if fewer than two player types are provided
   *
   * @example
   * ```typescript
   * // A role that can be played by either Document or Email
   * const attachment = Role.multi('attachment', Document, Email);
   * ```
   */
  static multi<T = unknown>(
    roleName: string,
    playerType: RolePlayerClass,
    ...additionalPlayerTypes: RolePlayerClass[]
  ): Role<T> {
    if (additionalPlayerTypes.length < 1) {
      throw new Error('Role.multi requires at least two player types');
    }
    return new Role<T>(roleName, playerType, ...additionalPlayerTypes);
  }

  /**
   * Validate that a value is a valid player for this role.
   *
   * @param value - The value to validate
   * @returns true if valid
   * @throws TypeError if value is not a valid player type
   */
  validatePlayer(value: unknown): value is T {
    for (const playerType of this.playerEntityTypes) {
      if (value instanceof (playerType as new (...args: unknown[]) => unknown)) {
        return true;
      }
    }

    const allowed = this.playerEntityTypes.map((pt) => pt.name).join(', ');
    const actualType =
      value && typeof value === 'object'
        ? value.constructor.name
        : typeof value;
    throw new TypeError(
      `Role '${this.roleName}' expects types (${allowed}), got ${actualType}`
    );
  }
}

/**
 * Type helper to extract the entity type from a Role.
 */
export type RolePlayerType<R> = R extends Role<infer T> ? T : never;
