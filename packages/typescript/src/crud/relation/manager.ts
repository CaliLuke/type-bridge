/**
 * RelationManager for CRUD operations on relations.
 */

import type { TransactionType } from 'typedb-driver-http';
import { Database, TransactionContext, Transaction } from '../../database.js';
import type { QueryResult } from '../../database.js';
import { Relation, type RelationConstructor } from '../../models/relation.js';
import { Entity } from '../../models/entity.js';
import type { Role } from '../../models/role.js';
import { formatValue, getKeyAttributes } from '../utils.js';
import { RelationQuery } from './query.js';

/**
 * Connection type that can be used for CRUD operations.
 */
export type Connection = Database | Transaction | TransactionContext;

/**
 * Execute a query on any connection type.
 */
async function executeQuery(
  connection: Connection,
  query: string,
  type: TransactionType
): Promise<QueryResult> {
  if (connection instanceof Database) {
    return connection.executeQuery(query, type);
  } else if (connection instanceof Transaction) {
    return connection.execute(query);
  } else {
    return connection.execute(query);
  }
}

/**
 * Manager for CRUD operations on relation types.
 *
 * Provides type-safe operations for inserting, updating, deleting,
 * and querying relations in TypeDB.
 *
 * @example
 * ```typescript
 * // Get manager for Employment relation
 * const manager = new RelationManager(Employment, db);
 *
 * // Insert
 * const employment = await manager.insert(new Employment({
 *   employee: alice,
 *   employer: techCorp,
 *   position: new Position('Engineer'),
 * }));
 *
 * // Query
 * const employments = await manager.all();
 *
 * // Delete
 * await manager.delete(employment);
 * ```
 */
export class RelationManager<R extends Relation> {
  /**
   * Create a new RelationManager.
   *
   * @param relationClass - The relation class to manage
   * @param connection - Database, Transaction, or TransactionContext
   */
  constructor(
    public readonly relationClass: RelationConstructor<R>,
    public readonly connection: Connection
  ) {}

  /**
   * Get the type name for this relation.
   */
  get typeName(): string {
    return this.relationClass.getTypeName();
  }

  /**
   * Get owned attributes for this relation.
   */
  get ownedAttrs() {
    return this.relationClass.getAllAttributes();
  }

  /**
   * Get roles for this relation.
   */
  get roles(): Map<string, Role> {
    return this.relationClass.getRoles();
  }

  /**
   * Build match clause for role player entities.
   *
   * @param relation - Relation instance with role players
   * @param usedVars - Set of variable names already used
   * @returns Match clause parts for role players
   */
  private buildRolePlayerMatchClauses(
    relation: R,
    usedVars: Set<string> = new Set()
  ): string[] {
    const clauses: string[] = [];

    for (const [fieldName] of this.roles) {
      const player = (relation as Record<string, unknown>)[fieldName] as Entity | undefined;
      if (!player) continue;

      const varName = `$${fieldName}`;
      if (usedVars.has(varName)) continue;
      usedVars.add(varName);

      const playerType = player.getTypeName();
      const playerAttrs = player.getOwnedAttributes();

      // Build match clause using key attributes
      const keyAttrs = getKeyAttributes(playerAttrs);
      const matchParts: string[] = [`${varName} isa ${playerType}`];

      for (const [keyFieldName, attrInfo] of keyAttrs) {
        const value = (player as Record<string, unknown>)[keyFieldName];
        if (value !== undefined && value !== null) {
          const attrName = attrInfo.typ.getAttributeName();
          matchParts.push(`has ${attrName} ${formatValue(value)}`);
        }
      }

      clauses.push(matchParts.join(', '));
    }

    return clauses;
  }

  /**
   * Build the role player pattern for insert.
   *
   * @param relation - Relation instance with role players
   * @returns Role player pattern string
   */
  private buildRolePattern(relation: R): string {
    const roleParts: string[] = [];

    for (const [fieldName, role] of this.roles) {
      const player = (relation as Record<string, unknown>)[fieldName];
      if (player !== undefined) {
        roleParts.push(`${role.roleName}: $${fieldName}`);
      }
    }

    return `(${roleParts.join(', ')})`;
  }

  /**
   * Insert a single relation.
   *
   * @param relation - Relation instance to insert
   * @returns The inserted relation
   */
  async insert(relation: R): Promise<R> {
    // Build match clause for role players
    const rolePlayerClauses = this.buildRolePlayerMatchClauses(relation);

    // Build insert clause
    const rolePattern = this.buildRolePattern(relation);
    const insertParts: string[] = [`$r ${rolePattern} isa ${this.typeName}`];

    // Add attributes
    for (const [fieldName, attrInfo] of this.ownedAttrs) {
      const value = (relation as Record<string, unknown>)[fieldName];
      if (value !== undefined && value !== null) {
        const attrName = attrInfo.typ.getAttributeName();
        if (Array.isArray(value)) {
          for (const item of value) {
            insertParts.push(`has ${attrName} ${formatValue(item)}`);
          }
        } else {
          insertParts.push(`has ${attrName} ${formatValue(value)}`);
        }
      }
    }

    let query = '';
    if (rolePlayerClauses.length > 0) {
      query = `match\n${rolePlayerClauses.join(';\n')};\n`;
    }
    query += `insert\n${insertParts.join(', ')};`;

    await executeQuery(this.connection, query, 'write');
    return relation;
  }

  /**
   * Insert multiple relations in a single transaction.
   *
   * @param relations - Array of relations to insert
   * @returns The inserted relations
   */
  async insertMany(relations: R[]): Promise<R[]> {
    if (relations.length === 0) return [];

    // For efficiency, deduplicate role players
    const usedVars = new Set<string>();
    const allRolePlayerClauses: string[] = [];

    for (const relation of relations) {
      const clauses = this.buildRolePlayerMatchClauses(relation, usedVars);
      allRolePlayerClauses.push(...clauses);
    }

    // Build insert patterns for each relation
    const insertPatterns: string[] = [];
    for (let i = 0; i < relations.length; i++) {
      const relation = relations[i]!;
      const rolePattern = this.buildRolePattern(relation);
      const insertParts: string[] = [`$r${i} ${rolePattern} isa ${this.typeName}`];

      for (const [fieldName, attrInfo] of this.ownedAttrs) {
        const value = (relation as Record<string, unknown>)[fieldName];
        if (value !== undefined && value !== null) {
          const attrName = attrInfo.typ.getAttributeName();
          if (Array.isArray(value)) {
            for (const item of value) {
              insertParts.push(`has ${attrName} ${formatValue(item)}`);
            }
          } else {
            insertParts.push(`has ${attrName} ${formatValue(value)}`);
          }
        }
      }

      insertPatterns.push(insertParts.join(', '));
    }

    let query = '';
    if (allRolePlayerClauses.length > 0) {
      query = `match\n${allRolePlayerClauses.join(';\n')};\n`;
    }
    query += `insert\n${insertPatterns.join(';\n')};`;

    await executeQuery(this.connection, query, 'write');
    return relations;
  }

  /**
   * Idempotent insert using TypeQL PUT.
   *
   * @param relation - Relation instance to put
   * @returns The relation
   */
  async put(relation: R): Promise<R> {
    const rolePlayerClauses = this.buildRolePlayerMatchClauses(relation);
    const rolePattern = this.buildRolePattern(relation);
    const putParts: string[] = [`$r ${rolePattern} isa ${this.typeName}`];

    for (const [fieldName, attrInfo] of this.ownedAttrs) {
      const value = (relation as Record<string, unknown>)[fieldName];
      if (value !== undefined && value !== null) {
        const attrName = attrInfo.typ.getAttributeName();
        if (Array.isArray(value)) {
          for (const item of value) {
            putParts.push(`has ${attrName} ${formatValue(item)}`);
          }
        } else {
          putParts.push(`has ${attrName} ${formatValue(value)}`);
        }
      }
    }

    let query = '';
    if (rolePlayerClauses.length > 0) {
      query = `match\n${rolePlayerClauses.join(';\n')};\n`;
    }
    query += `put\n${putParts.join(', ')};`;

    await executeQuery(this.connection, query, 'write');
    return relation;
  }

  /**
   * Get all relations of this type.
   *
   * @returns Array of all relations
   */
  async all(): Promise<R[]> {
    return this.query().all();
  }

  /**
   * Get relations matching filters.
   *
   * @param filters - Attribute filters (field_name: value)
   * @returns Array of matching relations
   */
  async get(filters: Record<string, unknown> = {}): Promise<R[]> {
    return this.query().filter(filters).all();
  }

  /**
   * Get a single relation matching filters.
   *
   * @param filters - Attribute filters
   * @returns Relation or undefined if not found
   */
  async one(filters: Record<string, unknown> = {}): Promise<R | undefined> {
    return this.query().filter(filters).first();
  }

  /**
   * Create a chainable query for this relation type.
   *
   * @returns RelationQuery for building complex queries
   */
  query(): RelationQuery<R> {
    return new RelationQuery(this.relationClass, this.connection);
  }

  /**
   * Create a filtered query.
   *
   * @param filters - Attribute filters
   * @returns RelationQuery with filters applied
   */
  filter(filters: Record<string, unknown>): RelationQuery<R> {
    return this.query().filter(filters);
  }

  /**
   * Delete a relation.
   *
   * @param relation - Relation to delete
   * @returns The deleted relation
   * @throws RelationNotFoundError if relation doesn't exist
   */
  async delete(relation: R): Promise<R> {
    // Build match clause for role players
    const rolePlayerClauses = this.buildRolePlayerMatchClauses(relation);

    // Build match clause for the relation itself
    const rolePattern = this.buildRolePattern(relation);
    const matchParts: string[] = [`$r ${rolePattern} isa ${this.typeName}`];

    // Add attribute filters
    for (const [fieldName, attrInfo] of this.ownedAttrs) {
      const value = (relation as Record<string, unknown>)[fieldName];
      if (value !== undefined && value !== null) {
        const attrName = attrInfo.typ.getAttributeName();
        matchParts.push(`has ${attrName} ${formatValue(value)}`);
      }
    }

    let query = '';
    if (rolePlayerClauses.length > 0) {
      query = `match\n${rolePlayerClauses.join(';\n')};\n`;
      query += `${matchParts.join(', ')};\n`;
    } else {
      query = `match\n${matchParts.join(', ')};\n`;
    }
    query += `delete\n$r;`;

    await executeQuery(this.connection, query, 'write');
    return relation;
  }

  /**
   * Delete multiple relations.
   *
   * @param relations - Array of relations to delete
   * @returns The deleted relations
   */
  async deleteMany(relations: R[]): Promise<R[]> {
    for (const relation of relations) {
      await this.delete(relation);
    }
    return relations;
  }
}
