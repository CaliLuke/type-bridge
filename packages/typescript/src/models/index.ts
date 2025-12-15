/**
 * Models module - Entity, Relation, and Role classes for TypeDB.
 */

// Base class
export { TypeDBType, initializeTypeDBType } from './base.js';
export type { TypeDBTypeConstructor } from './base.js';

// Entity
export { Entity, defineEntity } from './entity.js';
export type { EntityConfig, EntityConstructor } from './entity.js';

// Relation
export { Relation, defineRelation } from './relation.js';
export type { RelationConfig, RelationConstructor } from './relation.js';

// Role
export { Role } from './role.js';
export type { RolePlayerType, RolePlayerClass } from './role.js';

// Utilities
export {
  TYPEDB_BUILTIN_TYPES,
  VALUE_TYPE_MAP,
  validateTypeName,
  formatValue,
  isMultiValueAttribute,
  createDefaultFieldInfo,
} from './utils.js';
export type { FieldInfo, ModelAttrInfo, TypeContext } from './utils.js';
