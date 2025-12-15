/**
 * CRUD operation exceptions.
 */

/**
 * Base class for CRUD errors.
 */
export class CrudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrudError';
  }
}

/**
 * Error thrown when an entity is not found during delete/update.
 */
export class EntityNotFoundError extends CrudError {
  constructor(
    public readonly entityType: string,
    public readonly operation: string,
    public readonly details?: string
  ) {
    const message = details
      ? `${entityType} not found for ${operation}: ${details}`
      : `${entityType} not found for ${operation}`;
    super(message);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Error thrown when a relation is not found during delete/update.
 */
export class RelationNotFoundError extends CrudError {
  constructor(
    public readonly relationType: string,
    public readonly operation: string,
    public readonly details?: string
  ) {
    const message = details
      ? `${relationType} not found for ${operation}: ${details}`
      : `${relationType} not found for ${operation}`;
    super(message);
    this.name = 'RelationNotFoundError';
  }
}

/**
 * Error thrown when multiple matches are found when expecting one.
 */
export class NotUniqueError extends CrudError {
  constructor(
    public readonly entityType: string,
    public readonly operation: string,
    public readonly matchCount: number
  ) {
    super(
      `Cannot ${operation}: found ${matchCount} matches. ` +
        `Entity without @key must match exactly 1 record. ` +
        `Use filter().delete() for bulk deletion.`
    );
    this.name = 'NotUniqueError';
  }
}

/**
 * Error thrown when a key attribute is missing or invalid.
 */
export class KeyAttributeError extends CrudError {
  constructor(
    public readonly entityType: string,
    public readonly operation: string,
    public readonly fieldName: string,
    public readonly availableFields?: string[]
  ) {
    let message = `Cannot ${operation} ${entityType}: key attribute '${fieldName}' is None or missing.`;
    message += ` Ensure the entity has a valid '${fieldName}' value before calling ${operation}().`;
    if (availableFields && availableFields.length > 0) {
      message += ` Available key fields: ${availableFields.join(', ')}.`;
    }
    super(message);
    this.name = 'KeyAttributeError';
  }
}

/**
 * Error thrown when an invalid filter expression is used.
 */
export class InvalidFilterError extends CrudError {
  constructor(
    public readonly entityType: string,
    public readonly fieldName: string,
    public readonly availableFields?: string[]
  ) {
    let message = `${entityType} does not own attribute type '${fieldName}'.`;
    if (availableFields && availableFields.length > 0) {
      message += ` Available attribute types: ${availableFields.join(', ')}.`;
    }
    super(message);
    this.name = 'InvalidFilterError';
  }
}
