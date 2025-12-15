/**
 * Query builder for TypeQL queries.
 */

import { Attribute } from './attribute/base.js';

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
 * Builder for TypeQL queries.
 *
 * Provides a chainable API for constructing TypeQL queries with proper syntax.
 *
 * @example
 * ```typescript
 * const query = new Query()
 *   .match('$p isa person, has name "Alice"')
 *   .fetch('$p')
 *   .limit(10)
 *   .build();
 *
 * // Result:
 * // match
 * // $p isa person, has name "Alice";
 * // limit 10;
 * // fetch {
 * //   $p.*
 * // };
 * ```
 */
export class Query {
  private _matchClauses: string[] = [];
  private _fetchSpecs: Map<string, string[]> = new Map();
  private _deleteClauses: string[] = [];
  private _insertClauses: string[] = [];
  private _sortClauses: Array<{ variable: string; direction: 'asc' | 'desc' }> =
    [];
  private _limit: number | undefined;
  private _offset: number | undefined;

  /**
   * Add a match clause.
   *
   * @param pattern - TypeQL match pattern
   * @returns Self for chaining
   */
  match(pattern: string): this {
    this._matchClauses.push(pattern);
    return this;
  }

  /**
   * Add variables and attributes to fetch.
   *
   * In TypeQL 3.x, fetch uses the syntax: `fetch { $e.* }`
   *
   * @param variable - Variable name to fetch (e.g., "$e")
   * @param attributes - Optional specific attributes (not used in TypeQL 3.x, kept for API compatibility)
   * @returns Self for chaining
   */
  fetch(variable: string, ...attributes: string[]): this {
    this._fetchSpecs.set(variable, attributes);
    return this;
  }

  /**
   * Add a delete clause.
   *
   * @param pattern - TypeQL delete pattern
   * @returns Self for chaining
   */
  delete(pattern: string): this {
    this._deleteClauses.push(pattern);
    return this;
  }

  /**
   * Add an insert clause.
   *
   * @param pattern - TypeQL insert pattern
   * @returns Self for chaining
   */
  insert(pattern: string): this {
    this._insertClauses.push(pattern);
    return this;
  }

  /**
   * Set query limit.
   *
   * @param limit - Maximum number of results
   * @returns Self for chaining
   */
  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  /**
   * Set query offset.
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
   * @param variable - Variable to sort by
   * @param direction - Sort direction ("asc" or "desc")
   * @returns Self for chaining
   */
  sort(variable: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._sortClauses.push({ variable, direction });
    return this;
  }

  /**
   * Build the final TypeQL query string.
   *
   * @returns Complete TypeQL query
   */
  build(): string {
    const parts: string[] = [];

    // Match clause
    if (this._matchClauses.length > 0) {
      const matchBody = this._matchClauses.join('; ');
      parts.push(`match\n${matchBody};`);
    }

    // Delete clause
    if (this._deleteClauses.length > 0) {
      const deleteBody = this._deleteClauses.join('; ');
      parts.push(`delete\n${deleteBody};`);
    }

    // Insert clause
    if (this._insertClauses.length > 0) {
      const insertBody = this._insertClauses.join('; ');
      parts.push(`insert\n${insertBody};`);
    }

    // Sort, offset, and limit modifiers (must come BEFORE fetch in TypeQL 3.x)
    // IMPORTANT: offset must come BEFORE limit for pagination to work correctly
    if (this._sortClauses.length > 0) {
      const sortItems = this._sortClauses.map(
        (s) => `${s.variable} ${s.direction}`
      );
      parts.push(`sort ${sortItems.join(', ')};`);
    }

    if (this._offset !== undefined) {
      parts.push(`offset ${this._offset};`);
    }

    if (this._limit !== undefined) {
      parts.push(`limit ${this._limit};`);
    }

    // Fetch clause (TypeQL 3.x syntax: fetch { $var.* })
    if (this._fetchSpecs.size > 0) {
      const fetchItems: string[] = [];
      for (const variable of this._fetchSpecs.keys()) {
        fetchItems.push(`  ${variable}.*`);
      }
      const fetchBody = fetchItems.join(',\n');
      parts.push(`fetch {\n${fetchBody}\n};`);
    }

    return parts.join('\n');
  }

  /**
   * String representation of query.
   */
  toString(): string {
    return this.build();
  }
}

/**
 * Entity type interface for query builder.
 */
interface EntityType {
  getTypeName(): string;
  getAllAttributes(): Map<
    string,
    { typ: { getAttributeName(): string }; flags: unknown }
  >;
}

/**
 * Relation type interface for query builder.
 */
interface RelationType {
  getTypeName(): string;
  getRoles(): Map<string, { roleName: string }>;
}

/**
 * Helper class for building queries with model classes.
 */
export class QueryBuilder {
  /**
   * Create a match query for an entity.
   *
   * @param modelClass - The entity model class
   * @param var_ - Variable name to use
   * @param filters - Attribute filters (field_name: value)
   * @returns Query object
   */
  static matchEntity(
    modelClass: EntityType,
    var_: string = '$e',
    filters: Record<string, unknown> = {}
  ): Query {
    const query = new Query();

    // Basic entity match
    const patternParts: string[] = [`${var_} isa ${modelClass.getTypeName()}`];

    // Add attribute filters (including inherited attributes)
    const ownedAttrs = modelClass.getAllAttributes();
    for (const [fieldName, fieldValue] of Object.entries(filters)) {
      const attrInfo = ownedAttrs.get(fieldName);
      if (attrInfo) {
        const attrName = attrInfo.typ.getAttributeName();
        const formattedValue = formatValue(fieldValue);
        patternParts.push(`has ${attrName} ${formattedValue}`);
      }
    }

    const pattern = patternParts.join(', ');
    query.match(pattern);

    return query;
  }

  /**
   * Create an insert query for an entity instance.
   *
   * @param instance - Entity instance with toInsertQuery method
   * @param var_ - Variable name to use
   * @returns Query object
   */
  static insertEntity(
    instance: { toInsertQuery(var_: string): string },
    var_: string = '$e'
  ): Query {
    const query = new Query();
    const insertPattern = instance.toInsertQuery(var_);
    query.insert(insertPattern);
    return query;
  }

  /**
   * Create a match query for a relation.
   *
   * @param modelClass - The relation model class
   * @param var_ - Variable name to use
   * @param rolePlayers - Dict mapping role names to player variables
   * @returns Query object
   */
  static matchRelation(
    modelClass: RelationType,
    var_: string = '$r',
    rolePlayers?: Record<string, string>
  ): Query {
    const query = new Query();

    // Basic relation match
    const patternParts: string[] = [`${var_} isa ${modelClass.getTypeName()}`];

    // Add role players
    if (rolePlayers) {
      for (const [roleName, playerVar] of Object.entries(rolePlayers)) {
        patternParts.push(`(${roleName}: ${playerVar})`);
      }
    }

    const pattern = patternParts.join(', ');
    query.match(pattern);

    return query;
  }

  /**
   * Create a delete query for an entity.
   *
   * @param modelClass - The entity model class
   * @param var_ - Variable name to use
   * @param filters - Attribute filters for matching
   * @returns Query object
   */
  static deleteEntity(
    modelClass: EntityType,
    var_: string = '$e',
    filters: Record<string, unknown> = {}
  ): Query {
    const query = QueryBuilder.matchEntity(modelClass, var_, filters);
    query.delete(var_);
    return query;
  }

  /**
   * Create an update query for changing an attribute.
   *
   * @param modelClass - The entity model class
   * @param var_ - Variable name to use
   * @param attrName - Attribute name to update
   * @param oldValue - Current value (for matching)
   * @param newValue - New value
   * @returns Query object
   */
  static updateAttribute(
    modelClass: EntityType,
    var_: string = '$e',
    attrName: string,
    oldValue: unknown,
    newValue: unknown
  ): Query {
    const query = new Query();
    const typeName = modelClass.getTypeName();

    // Match the entity with the old attribute value
    const attrVar = `$old_${attrName}`;
    query.match(
      `${var_} isa ${typeName}, has ${attrName} ${attrVar}; ${attrVar} = ${formatValue(oldValue)}`
    );

    // Delete old attribute and insert new
    query.delete(`${var_} has ${attrVar}`);
    query.insert(`${var_} has ${attrName} ${formatValue(newValue)}`);

    return query;
  }
}
