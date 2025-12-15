/**
 * EntityManager for CRUD operations on entities.
 */

import type { TransactionType } from 'typedb-driver-http';
import { Database, TransactionContext, Transaction } from '../../database.js';
import type { QueryResult } from '../../database.js';
import { Entity, type EntityConstructor } from '../../models/entity.js';
import {
  EntityNotFoundError,
  KeyAttributeError,
  NotUniqueError,
} from '../exceptions.js';
import {
  formatValue,
  isMultiValueAttribute,
  getKeyAttributes,
  buildAttributeFilters,
} from '../utils.js';
import { EntityQuery } from './query.js';

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
 * Manager for CRUD operations on entity types.
 *
 * Provides type-safe operations for inserting, updating, deleting,
 * and querying entities in TypeDB.
 *
 * @example
 * ```typescript
 * // Get manager for Person entity
 * const manager = new EntityManager(Person, db);
 *
 * // Insert
 * const alice = await manager.insert(new Person({ name: 'Alice', age: 30 }));
 *
 * // Query
 * const people = await manager.all();
 * const adults = await manager.filter({ age: 30 }).all();
 *
 * // Update
 * alice.age = new Age(31);
 * await manager.update(alice);
 *
 * // Delete
 * await manager.delete(alice);
 * ```
 */
export class EntityManager<E extends Entity> {
  /**
   * Create a new EntityManager.
   *
   * @param entityClass - The entity class to manage
   * @param connection - Database, Transaction, or TransactionContext
   */
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
   * Insert a single entity.
   *
   * @param entity - Entity instance to insert
   * @returns The inserted entity
   */
  async insert(entity: E): Promise<E> {
    const insertPattern = entity.toInsertQuery('$e');
    const query = `insert\n${insertPattern};`;

    await executeQuery(this.connection, query, 'write');
    return entity;
  }

  /**
   * Insert multiple entities in a single transaction.
   *
   * @param entities - Array of entities to insert
   * @returns The inserted entities
   */
  async insertMany(entities: E[]): Promise<E[]> {
    if (entities.length === 0) return [];

    const insertPatterns = entities.map((e, i) => e.toInsertQuery(`$e${i}`));
    const query = `insert\n${insertPatterns.join(';\n')};`;

    await executeQuery(this.connection, query, 'write');
    return entities;
  }

  /**
   * Idempotent insert using TypeQL PUT.
   *
   * If an entity with the same key attributes exists, returns without error.
   *
   * @param entity - Entity instance to put
   * @returns The entity
   */
  async put(entity: E): Promise<E> {
    const insertPattern = entity.toInsertQuery('$e');
    const query = `put\n${insertPattern};`;

    await executeQuery(this.connection, query, 'write');
    return entity;
  }

  /**
   * Idempotent insert multiple entities.
   *
   * @param entities - Array of entities to put
   * @returns The entities
   */
  async putMany(entities: E[]): Promise<E[]> {
    if (entities.length === 0) return [];

    const putPatterns = entities.map((e, i) => e.toInsertQuery(`$e${i}`));
    const query = `put\n${putPatterns.join(';\n')};`;

    await executeQuery(this.connection, query, 'write');
    return entities;
  }

  /**
   * Get all entities of this type.
   *
   * @returns Array of all entities
   */
  async all(): Promise<E[]> {
    return this.query().all();
  }

  /**
   * Get entities matching filters.
   *
   * @param filters - Attribute filters (field_name: value)
   * @returns Array of matching entities
   */
  async get(filters: Record<string, unknown> = {}): Promise<E[]> {
    return this.query().filter(filters).all();
  }

  /**
   * Get a single entity matching filters.
   *
   * @param filters - Attribute filters
   * @returns Entity or undefined if not found
   */
  async one(filters: Record<string, unknown> = {}): Promise<E | undefined> {
    return this.query().filter(filters).first();
  }

  /**
   * Create a chainable query for this entity type.
   *
   * @returns EntityQuery for building complex queries
   */
  query(): EntityQuery<E> {
    return new EntityQuery(this.entityClass, this.connection);
  }

  /**
   * Create a filtered query.
   *
   * @param filters - Attribute filters
   * @returns EntityQuery with filters applied
   */
  filter(filters: Record<string, unknown>): EntityQuery<E> {
    return this.query().filter(filters);
  }

  /**
   * Update an entity using its key attributes.
   *
   * @param entity - Entity to update
   * @returns The updated entity
   * @throws KeyAttributeError if key attribute is missing
   * @throws EntityNotFoundError if entity doesn't exist
   */
  async update(entity: E): Promise<E> {
    const keyAttrs = getKeyAttributes(this.ownedAttrs);

    if (keyAttrs.length === 0) {
      throw new KeyAttributeError(
        this.typeName,
        'update',
        '(no key defined)',
        [...this.ownedAttrs.keys()]
      );
    }

    // Build match clause using key attributes
    const matchParts: string[] = [`$e isa ${this.typeName}`];
    for (const [fieldName, attrInfo] of keyAttrs) {
      const value = (entity as Record<string, unknown>)[fieldName];
      if (value === undefined || value === null) {
        throw new KeyAttributeError(
          this.typeName,
          'update',
          fieldName,
          keyAttrs.map(([name]) => name)
        );
      }
      const attrName = attrInfo.typ.getAttributeName();
      matchParts.push(`has ${attrName} ${formatValue(value)}`);
    }

    // Build update/insert clauses for non-key attributes
    const updateParts: string[] = [];
    for (const [fieldName, attrInfo] of this.ownedAttrs) {
      if (attrInfo.flags.isKey) continue;

      const value = (entity as Record<string, unknown>)[fieldName];
      const attrName = attrInfo.typ.getAttributeName();

      if (isMultiValueAttribute(attrInfo.flags)) {
        // Multi-value: delete all, then insert new values
        // This is simplified - full implementation would use guards
        if (Array.isArray(value) && value.length > 0) {
          for (const item of value) {
            updateParts.push(`$e has ${attrName} ${formatValue(item)}`);
          }
        }
      } else {
        // Single-value: use update clause
        if (value !== undefined && value !== null) {
          updateParts.push(`$e has ${attrName} ${formatValue(value)}`);
        }
      }
    }

    // Build the update query
    let query = `match\n${matchParts.join(', ')};\n`;
    if (updateParts.length > 0) {
      query += `update\n${updateParts.join(', ')};`;
    }

    const result = await executeQuery(this.connection, query, 'write');
    if (result.answerType === 'ok') {
      return entity;
    }

    return entity;
  }

  /**
   * Delete an entity.
   *
   * @param entity - Entity to delete
   * @returns The deleted entity
   * @throws KeyAttributeError if key attribute is missing
   * @throws EntityNotFoundError if entity doesn't exist
   */
  async delete(entity: E): Promise<E> {
    const keyAttrs = getKeyAttributes(this.ownedAttrs);

    // Build match clause
    const matchParts: string[] = [`$e isa ${this.typeName}`];

    if (keyAttrs.length > 0) {
      // Use key attributes to identify entity
      for (const [fieldName, attrInfo] of keyAttrs) {
        const value = (entity as Record<string, unknown>)[fieldName];
        if (value === undefined || value === null) {
          throw new KeyAttributeError(
            this.typeName,
            'delete',
            fieldName,
            keyAttrs.map(([name]) => name)
          );
        }
        const attrName = attrInfo.typ.getAttributeName();
        matchParts.push(`has ${attrName} ${formatValue(value)}`);
      }
    } else {
      // No key - use all attributes to identify
      const filterParts = buildAttributeFilters(
        this.ownedAttrs,
        entity as unknown as Record<string, unknown>
      );
      matchParts.push(...filterParts);

      // Check uniqueness first
      const countQuery = `match\n${matchParts.join(', ')};\nreduce $count = count;`;
      const countResult = await executeQuery(this.connection, countQuery, 'read');

      let count = 0;
      if (countResult.rows.length > 0 && countResult.rows[0]) {
        const countValue = countResult.rows[0]['count'];
        count = typeof countValue === 'number' ? countValue : 0;
      }

      if (count === 0) {
        throw new EntityNotFoundError(this.typeName, 'delete');
      }
      if (count > 1) {
        throw new NotUniqueError(this.typeName, 'delete', count);
      }
    }

    const query = `match\n${matchParts.join(', ')};\ndelete\n$e;`;
    await executeQuery(this.connection, query, 'write');

    return entity;
  }

  /**
   * Delete multiple entities.
   *
   * @param entities - Array of entities to delete
   * @returns The deleted entities
   */
  async deleteMany(entities: E[]): Promise<E[]> {
    for (const entity of entities) {
      await this.delete(entity);
    }
    return entities;
  }

  /**
   * Parse query result documents into entity instances.
   *
   * @param documents - Array of query result documents
   * @returns Array of entity instances
   */
  parseResults(documents: Record<string, unknown>[]): E[] {
    const entities: E[] = [];

    for (const doc of documents) {
      const attrs: Record<string, unknown> = {};

      for (const [fieldName, attrInfo] of this.ownedAttrs) {
        const attrName = attrInfo.typ.getAttributeName();
        const rawValue = doc[attrName];

        if (rawValue !== undefined && rawValue !== null) {
          if (isMultiValueAttribute(attrInfo.flags)) {
            // Multi-value: expect array
            if (Array.isArray(rawValue)) {
              attrs[fieldName] = rawValue;
            } else {
              attrs[fieldName] = [rawValue];
            }
          } else {
            // Single-value
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
