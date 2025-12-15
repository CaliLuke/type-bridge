/**
 * RelationQuery - Chainable query builder for relations.
 */

import type { TransactionType } from 'typedb-driver-http';
import { Database, Transaction, TransactionContext } from '../../database.js';
import type { QueryResult } from '../../database.js';
import { Relation, type RelationConstructor } from '../../models/relation.js';
import { Entity } from '../../models/entity.js';
import type { Role } from '../../models/role.js';
import { InvalidFilterError } from '../exceptions.js';
import { formatValue, isMultiValueAttribute } from '../utils.js';
import type { Connection } from './manager.js';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort specification.
 */
export interface SortSpec {
  field: string;
  direction: SortDirection;
}

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
  } else if (connection instanceof TransactionContext) {
    return connection.execute(query);
  }
  // Should never reach here with valid Connection type
  throw new Error('Invalid connection type');
}

/**
 * Chainable query builder for relations.
 *
 * Provides a fluent API for building complex queries with filtering,
 * sorting, pagination, and role player matching.
 *
 * @example
 * ```typescript
 * const employments = await Employment.manager(db)
 *   .query()
 *   .filter({ position: 'Engineer' })
 *   .orderBy('salary')
 *   .limit(10)
 *   .all();
 * ```
 */
export class RelationQuery<R extends Relation> {
  private _filters: Record<string, unknown> = {};
  private _roleFilters: Record<string, Record<string, unknown>> = {};
  private _sorts: SortSpec[] = [];
  private _limit: number | undefined = undefined;
  private _offset: number | undefined = undefined;

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
   * Add filters to the query.
   *
   * Supports both attribute filters and role player filters.
   * Use `role__attr` syntax for role player attributes.
   *
   * @param filters - Filters (field_name: value or role__attr: value)
   * @returns Self for chaining
   */
  filter(filters: Record<string, unknown>): this {
    for (const [fieldName, filterValue] of Object.entries(filters)) {
      // Check if it's a role player filter (role__attr pattern)
      const fieldParts = fieldName.split('__');
      const baseName = fieldParts[0] ?? fieldName;

      if (this.roles.has(baseName) && fieldParts.length > 1) {
        // Role player filter: employee__age__gt -> employee, age__gt
        if (!this._roleFilters[baseName]) {
          this._roleFilters[baseName] = {};
        }
        const subField = fieldParts.slice(1).join('__');
        this._roleFilters[baseName]![subField] = filterValue;
      } else if (this.ownedAttrs.has(baseName)) {
        // Relation attribute filter
        this._filters[fieldName] = filterValue;
      } else if (!this.roles.has(baseName)) {
        throw new InvalidFilterError(
          this.typeName,
          fieldName,
          [...this.ownedAttrs.keys(), ...this.roles.keys()]
        );
      }
    }

    return this;
  }

  /**
   * Set the maximum number of results.
   *
   * @param limit - Maximum results to return
   * @returns Self for chaining
   */
  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  /**
   * Set the number of results to skip.
   *
   * @param offset - Number of results to skip
   * @returns Self for chaining
   */
  offset(offset: number): this {
    this._offset = offset;
    return this;
  }

  /**
   * Add sorting to the query.
   *
   * Prefix field name with '-' for descending order.
   * Use `role__attr` for role player attribute sorting.
   *
   * @param fields - Fields to sort by
   * @returns Self for chaining
   */
  orderBy(...fields: string[]): this {
    for (const field of fields) {
      let direction: SortDirection = 'asc';
      let fieldName = field;

      if (field.startsWith('-')) {
        direction = 'desc';
        fieldName = field.slice(1);
      }

      this._sorts.push({ field: fieldName, direction });
    }

    return this;
  }

  /**
   * Execute the query and return all results.
   *
   * @returns Array of matching relations
   */
  async all(): Promise<R[]> {
    const query = this.buildQuery();
    const result = await executeQuery(this.connection, query, 'read');

    return this.parseResults(result.documents as Record<string, unknown>[]);
  }

  /**
   * Execute the query and return the first result.
   *
   * @returns First matching relation or undefined
   */
  async first(): Promise<R | undefined> {
    const originalLimit = this._limit;
    this._limit = 1;

    const results = await this.all();

    this._limit = originalLimit;
    return results[0];
  }

  /**
   * Count matching relations.
   *
   * @returns Number of matching relations
   */
  async count(): Promise<number> {
    const matchClause = this.buildMatchClause();
    const query = `${matchClause}\nreduce $count = count;`;

    const result = await executeQuery(this.connection, query, 'read');

    if (result.rows.length > 0 && result.rows[0]) {
      const countValue = result.rows[0]['count'];
      if (typeof countValue === 'number') {
        return countValue;
      }
    }

    return 0;
  }

  /**
   * Delete all matching relations.
   *
   * @returns Number of deleted relations
   */
  async delete(): Promise<number> {
    const count = await this.count();
    if (count === 0) return 0;

    const matchClause = this.buildMatchClause();
    const query = `${matchClause}\ndelete\n$r;`;

    await executeQuery(this.connection, query, 'write');
    return count;
  }

  /**
   * Build the role player pattern.
   */
  private buildRolePattern(): string {
    const roleParts: string[] = [];

    for (const [fieldName, role] of this.roles) {
      roleParts.push(`${role.roleName}: $${fieldName}`);
    }

    return `(${roleParts.join(', ')})`;
  }

  /**
   * Build the match clause.
   */
  private buildMatchClause(): string {
    const matchParts: string[] = [];

    // Role pattern
    const rolePattern = this.buildRolePattern();
    matchParts.push(`$r ${rolePattern} isa ${this.typeName}`);

    // Relation attribute filters
    for (const [fieldName, filterValue] of Object.entries(this._filters)) {
      if (filterValue === undefined || filterValue === null) continue;

      const fieldParts = fieldName.split('__');
      const baseName = fieldParts[0] ?? fieldName;
      const operator = fieldParts[1] ?? 'exact';

      const attrInfo = this.ownedAttrs.get(baseName);
      if (!attrInfo) continue;

      const attrName = attrInfo.typ.getAttributeName();
      const attrVar = `$${baseName}`;

      matchParts.push(`$r has ${attrName} ${attrVar}`);

      switch (operator) {
        case 'exact':
        case 'eq':
          matchParts.push(`${attrVar} == ${formatValue(filterValue)}`);
          break;
        case 'gt':
          matchParts.push(`${attrVar} > ${formatValue(filterValue)}`);
          break;
        case 'gte':
          matchParts.push(`${attrVar} >= ${formatValue(filterValue)}`);
          break;
        case 'lt':
          matchParts.push(`${attrVar} < ${formatValue(filterValue)}`);
          break;
        case 'lte':
          matchParts.push(`${attrVar} <= ${formatValue(filterValue)}`);
          break;
        case 'contains':
          matchParts.push(`${attrVar} contains ${formatValue(filterValue)}`);
          break;
      }
    }

    // Role player filters
    for (const [roleName, roleFilters] of Object.entries(this._roleFilters)) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      const roleVar = `$${roleName}`;

      // Get player type's attributes (use first player type)
      const playerTypes = role.playerTypes;
      if (playerTypes.length === 0) continue;

      const firstPlayerType = playerTypes[0];
      if (!firstPlayerType) continue;
      const playerAttrs = (firstPlayerType as unknown as typeof Entity).getAllAttributes();

      for (const [filterField, filterValue] of Object.entries(roleFilters)) {
        if (filterValue === undefined || filterValue === null) continue;

        const filterParts = filterField.split('__');
        const attrName = filterParts[0] ?? filterField;
        const operator = filterParts[1] ?? 'exact';

        const attrInfo = playerAttrs.get(attrName);
        if (!attrInfo) continue;

        const typedbAttrName = attrInfo.typ.getAttributeName();
        const attrVar = `$${roleName}_${attrName}`;

        matchParts.push(`${roleVar} has ${typedbAttrName} ${attrVar}`);

        switch (operator) {
          case 'exact':
          case 'eq':
            matchParts.push(`${attrVar} == ${formatValue(filterValue)}`);
            break;
          case 'gt':
            matchParts.push(`${attrVar} > ${formatValue(filterValue)}`);
            break;
          case 'gte':
            matchParts.push(`${attrVar} >= ${formatValue(filterValue)}`);
            break;
          case 'lt':
            matchParts.push(`${attrVar} < ${formatValue(filterValue)}`);
            break;
          case 'lte':
            matchParts.push(`${attrVar} <= ${formatValue(filterValue)}`);
            break;
          case 'contains':
            matchParts.push(`${attrVar} contains ${formatValue(filterValue)}`);
            break;
        }
      }
    }

    return `match\n${matchParts.join(';\n')};`;
  }

  /**
   * Build the complete query.
   */
  private buildQuery(): string {
    const parts: string[] = [];

    // Match clause
    parts.push(this.buildMatchClause());

    // Sort clause
    if (this._sorts.length > 0) {
      const sortItems = this._sorts.map((s) => {
        // Check if it's a role player attribute
        const sortParts = s.field.split('__');
        if (sortParts.length > 1) {
          const roleName = sortParts[0];
          const attrName = sortParts[1];
          return `$${roleName}_${attrName} ${s.direction}`;
        }
        return `$sort_${s.field} ${s.direction}`;
      });

      parts.push(`sort ${sortItems.join(', ')};`);
    }

    // Offset clause
    if (this._offset !== undefined) {
      parts.push(`offset ${this._offset};`);
    }

    // Limit clause
    if (this._limit !== undefined) {
      parts.push(`limit ${this._limit};`);
    }

    // Fetch clause with role players
    const fetchParts: string[] = ['  $r.*'];
    for (const [fieldName] of this.roles) {
      fetchParts.push(`  "${fieldName}": {\n    $${fieldName}.*\n  }`);
    }
    parts.push(`fetch {\n${fetchParts.join(',\n')}\n};`);

    return parts.join('\n');
  }

  /**
   * Parse query result documents into relation instances.
   */
  private parseResults(documents: Record<string, unknown>[]): R[] {
    const relations: R[] = [];

    for (const doc of documents) {
      // Get relation data (under 'r' from fetch)
      const relationDoc = (doc['r'] as Record<string, unknown>) || doc;
      const attrs: Record<string, unknown> = {};

      // Parse relation attributes
      for (const [fieldName, attrInfo] of this.ownedAttrs) {
        const attrName = attrInfo.typ.getAttributeName();
        const rawValue = relationDoc[attrName];

        if (rawValue !== undefined && rawValue !== null) {
          if (isMultiValueAttribute(attrInfo.flags)) {
            attrs[fieldName] = Array.isArray(rawValue) ? rawValue : [rawValue];
          } else {
            attrs[fieldName] = rawValue;
          }
        } else if (isMultiValueAttribute(attrInfo.flags)) {
          attrs[fieldName] = [];
        }
      }

      // Parse role players
      for (const [fieldName, role] of this.roles) {
        const playerDoc = doc[fieldName] as Record<string, unknown> | undefined;
        if (!playerDoc) continue;

        // Get player type
        const playerTypes = role.playerTypes;
        const firstPlayerType = playerTypes[0];
        if (!firstPlayerType) continue;

        const playerType = firstPlayerType as unknown as typeof Entity;
        const playerAttrs = playerType.getAllAttributes();

        const playerData: Record<string, unknown> = {};
        for (const [playerFieldName, playerAttrInfo] of playerAttrs) {
          const attrName = playerAttrInfo.typ.getAttributeName();
          const rawValue = playerDoc[attrName];

          if (rawValue !== undefined && rawValue !== null) {
            if (isMultiValueAttribute(playerAttrInfo.flags)) {
              playerData[playerFieldName] = Array.isArray(rawValue)
                ? rawValue
                : [rawValue];
            } else {
              playerData[playerFieldName] = rawValue;
            }
          } else if (isMultiValueAttribute(playerAttrInfo.flags)) {
            playerData[playerFieldName] = [];
          }
        }

        attrs[fieldName] = new playerType(playerData);
      }

      relations.push(new this.relationClass(attrs));
    }

    return relations;
  }
}
