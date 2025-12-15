/**
 * CRUD module exports.
 *
 * Provides EntityManager and RelationManager for type-safe CRUD operations
 * on TypeDB entities and relations.
 */

// Exceptions
export {
  CrudError,
  EntityNotFoundError,
  RelationNotFoundError,
  NotUniqueError,
  KeyAttributeError,
  InvalidFilterError,
} from './exceptions.js';

// Utilities
export {
  formatValue,
  isMultiValueAttribute,
  getKeyAttributes,
  buildFetchClause,
  buildAttributeFilters,
} from './utils.js';

// Entity CRUD
export { EntityManager } from './entity/manager.js';
export { EntityQuery, type SortDirection, type SortSpec } from './entity/query.js';
export type { Connection } from './entity/manager.js';

// Relation CRUD
export { RelationManager } from './relation/manager.js';
export { RelationQuery } from './relation/query.js';
