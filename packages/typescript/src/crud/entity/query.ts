/**
 * EntityQuery - Chainable query builder for entities.
 */

import type { TransactionType } from 'typedb-driver-http';
import { Database, Transaction, TransactionContext } from '../../database.js';
import type { QueryResult } from '../../database.js';
import { Entity, type EntityConstructor } from '../../models/entity.js';
import { InvalidFilterError } from '../exceptions.js';
import {
  formatValue,
  isMultiValueAttribute,
  getKeyAttributes,
} from '../utils.js';
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
 * Chainable query builder for entities.
 *
 * Provides a fluent API for building complex queries with filtering,
 * sorting, pagination, and aggregation.
 *
 * @example
 * ```typescript
 * const people = await Person.manager(db)
 *   .query()
 *   .filter({ age: 30 })
 *   .orderBy('name')
 *   .limit(10)
 *   .all();
 * ```
 */
export class EntityQuery<E extends Entity> {
  private _filters: Record<string, unknown> = {};
  private _sorts: SortSpec[] = [];
  private _limit: number | undefined = undefined;
  private _offset: number | undefined = undefined;

  constructor(
    public readonly entityClass: EntityConstructor<E>,
    public readonly connection: Connection
  ) {}

  /**
   * Get the type name for this entity.
   */
  get typeName(): string {
    return this.entityClass.getTypeName();
  }

  /**
   * Get owned attributes for this entity.
   */
  get ownedAttrs() {
    return this.entityClass.getAllAttributes();
  }

  /**
   * Add filters to the query.
   *
   * @param filters - Attribute filters (field_name: value)
   * @returns Self for chaining
   */
  filter(filters: Record<string, unknown>): this {
    // Validate filter fields
    for (const fieldName of Object.keys(filters)) {
      // Handle Django-style lookups (field__operator)
      const baseName = fieldName.split('__')[0] ?? fieldName;
      if (!this.ownedAttrs.has(baseName)) {
        throw new InvalidFilterError(
          this.typeName,
          fieldName,
          [...this.ownedAttrs.keys()]
        );
      }
    }

    this._filters = { ...this._filters, ...filters };
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
   * Note: TypeDB 3.x requires sorting when using offset.
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
   *
   * @param fields - Fields to sort by
   * @returns Self for chaining
   *
   * @example
   * ```typescript
   * query.orderBy('name')           // ascending
   * query.orderBy('-age')           // descending
   * query.orderBy('name', '-age')   // multiple sorts
   * ```
   */
  orderBy(...fields: string[]): this {
    for (const field of fields) {
      let direction: SortDirection = 'asc';
      let fieldName = field;

      if (field.startsWith('-')) {
        direction = 'desc';
        fieldName = field.slice(1);
      }

      // Validate field exists
      if (!this.ownedAttrs.has(fieldName)) {
        throw new InvalidFilterError(
          this.typeName,
          fieldName,
          [...this.ownedAttrs.keys()]
        );
      }

      this._sorts.push({ field: fieldName, direction });
    }

    return this;
  }

  /**
   * Execute the query and return all results.
   *
   * @returns Array of matching entities
   */
  async all(): Promise<E[]> {
    const query = this.buildQuery();
    const result = await executeQuery(this.connection, query, 'read');

    return this.parseResults(result.documents as Record<string, unknown>[]);
  }

  /**
   * Execute the query and return the first result.
   *
   * @returns First matching entity or undefined
   */
  async first(): Promise<E | undefined> {
    const originalLimit = this._limit;
    this._limit = 1;

    const results = await this.all();

    this._limit = originalLimit;
    return results[0];
  }

  /**
   * Execute the query and return exactly one result.
   *
   * @returns The matching entity
   * @throws Error if no results or multiple results
   */
  async one(): Promise<E> {
    const results = await this.all();

    if (results.length === 0) {
      throw new Error(`No ${this.typeName} found matching query`);
    }
    if (results.length > 1) {
      throw new Error(
        `Expected exactly one ${this.typeName}, found ${results.length}`
      );
    }

    return results[0]!;
  }

  /**
   * Count matching entities.
   *
   * @returns Number of matching entities
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
   * Delete all matching entities.
   *
   * @returns Number of deleted entities
   */
  async delete(): Promise<number> {
    const count = await this.count();
    if (count === 0) return 0;

    const matchClause = this.buildMatchClause();
    const query = `${matchClause}\ndelete\n$e;`;

    await executeQuery(this.connection, query, 'write');
    return count;
  }

  /**
   * Build the match clause.
   */
  private buildMatchClause(): string {
    const matchParts: string[] = [`$e isa ${this.typeName}`];

    // Add filter conditions
    for (const [fieldName, filterValue] of Object.entries(this._filters)) {
      if (filterValue === undefined || filterValue === null) continue;

      // Handle Django-style lookups
      const fieldParts = fieldName.split('__');
      const baseName = fieldParts[0] ?? fieldName;
      const operator = fieldParts[1] ?? 'exact';

      const attrInfo = this.ownedAttrs.get(baseName);
      if (!attrInfo) continue;

      const attrName = attrInfo.typ.getAttributeName();
      const attrVar = `$${baseName}`;

      // Bind attribute variable
      matchParts.push(`has ${attrName} ${attrVar}`);

      // Apply operator
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
        case 'in':
          if (Array.isArray(filterValue)) {
            const conditions = filterValue
              .map((v) => `{ ${attrVar} == ${formatValue(v)}; }`)
              .join(' or ');
            matchParts.push(conditions);
          }
          break;
        default:
          // Default to exact match for unknown operators
          matchParts.push(`${attrVar} == ${formatValue(filterValue)}`);
      }
    }

    return `match\n${matchParts.join(';\n')};`;
  }

  /**
   * Build the sort clause.
   *
   * If sorting is needed but none specified (e.g., for offset),
   * auto-select a suitable attribute.
   */
  private buildSortClause(): string {
    let sorts = [...this._sorts];

    // Auto-select sort attribute if needed for pagination
    if (sorts.length === 0 && this._offset !== undefined) {
      // Try to find a key attribute
      const keyAttrs = getKeyAttributes(this.ownedAttrs);
      if (keyAttrs.length > 0) {
        const firstKeyAttr = keyAttrs[0];
        if (firstKeyAttr) {
          sorts.push({ field: firstKeyAttr[0], direction: 'asc' });
        }
      } else {
        // Fallback to first required attribute
        for (const [fieldName, attrInfo] of this.ownedAttrs) {
          // Check if attribute has cardMin >= 1 (required)
          if (attrInfo.flags.cardMin !== undefined && attrInfo.flags.cardMin >= 1) {
            sorts.push({ field: fieldName, direction: 'asc' });
            break;
          }
        }
      }
    }

    if (sorts.length === 0) return '';

    const sortItems = sorts.map((s) => {
      const attrInfo = this.ownedAttrs.get(s.field);
      if (!attrInfo) return '';
      const attrVar = `$sort_${s.field}`;
      return `${attrVar} ${s.direction}`;
    });

    return `sort ${sortItems.filter(Boolean).join(', ')};`;
  }

  /**
   * Build additional match clauses for sort variables.
   */
  private buildSortMatchClauses(): string[] {
    let sorts = [...this._sorts];

    // Add auto-selected sorts for pagination
    if (sorts.length === 0 && this._offset !== undefined) {
      const keyAttrs = getKeyAttributes(this.ownedAttrs);
      const firstKeyAttr = keyAttrs[0];
      if (firstKeyAttr) {
        sorts.push({ field: firstKeyAttr[0], direction: 'asc' });
      }
    }

    const clauses: string[] = [];

    for (const sort of sorts) {
      const attrInfo = this.ownedAttrs.get(sort.field);
      if (attrInfo) {
        const attrName = attrInfo.typ.getAttributeName();
        const attrVar = `$sort_${sort.field}`;
        clauses.push(`$e has ${attrName} ${attrVar}`);
      }
    }

    return clauses;
  }

  /**
   * Build the complete query.
   */
  private buildQuery(): string {
    const parts: string[] = [];

    // Match clause
    const matchParts: string[] = [`$e isa ${this.typeName}`];

    // Add filter conditions
    for (const [fieldName, filterValue] of Object.entries(this._filters)) {
      if (filterValue === undefined || filterValue === null) continue;

      const fieldParts = fieldName.split('__');
      const baseName = fieldParts[0] ?? fieldName;
      const operator = fieldParts[1] ?? 'exact';

      const attrInfo = this.ownedAttrs.get(baseName);
      if (!attrInfo) continue;

      const attrName = attrInfo.typ.getAttributeName();
      const attrVar = `$${baseName}`;

      matchParts.push(`has ${attrName} ${attrVar}`);

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
        case 'in':
          if (Array.isArray(filterValue)) {
            const conditions = filterValue
              .map((v) => `{ ${attrVar} == ${formatValue(v)}; }`)
              .join(' or ');
            matchParts.push(conditions);
          }
          break;
      }
    }

    // Add sort variable bindings
    const sortClauses = this.buildSortMatchClauses();
    for (const clause of sortClauses) {
      matchParts.push(clause);
    }

    parts.push(`match\n${matchParts.join(';\n')};`);

    // Sort clause
    const sortClause = this.buildSortClause();
    if (sortClause) {
      parts.push(sortClause);
    }

    // Offset clause (must come before limit)
    if (this._offset !== undefined) {
      parts.push(`offset ${this._offset};`);
    }

    // Limit clause
    if (this._limit !== undefined) {
      parts.push(`limit ${this._limit};`);
    }

    // Fetch clause
    parts.push(`fetch {\n  $e.*\n};`);

    return parts.join('\n');
  }

  /**
   * Parse query result documents into entity instances.
   */
  private parseResults(documents: Record<string, unknown>[]): E[] {
    const entities: E[] = [];

    for (const doc of documents) {
      // Handle nested structure from fetch - the entity data is under $e
      const entityDoc = (doc['e'] as Record<string, unknown>) || doc;
      const attrs: Record<string, unknown> = {};

      for (const [fieldName, attrInfo] of this.ownedAttrs) {
        const attrName = attrInfo.typ.getAttributeName();
        const rawValue = entityDoc[attrName];

        if (rawValue !== undefined && rawValue !== null) {
          if (isMultiValueAttribute(attrInfo.flags)) {
            if (Array.isArray(rawValue)) {
              attrs[fieldName] = rawValue;
            } else {
              attrs[fieldName] = [rawValue];
            }
          } else {
            attrs[fieldName] = rawValue;
          }
        } else {
          if (isMultiValueAttribute(attrInfo.flags)) {
            attrs[fieldName] = [];
          }
        }
      }

      entities.push(new this.entityClass(attrs));
    }

    return entities;
  }
}
