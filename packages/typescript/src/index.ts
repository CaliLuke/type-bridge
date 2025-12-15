/**
 * TypeBridge TypeScript - TypeDB ORM for TypeScript
 *
 * A TypeScript port of the type_bridge Python library, providing a full-featured
 * ORM for TypeDB with type-safe entity and relation definitions.
 *
 * @example
 * import {
 *   StringAttribute,
 *   IntegerAttribute,
 *   TypeFlags,
 *   AttributeFlags,
 *   Flag,
 *   Key,
 * } from 'type-bridge-ts';
 *
 * // Define attribute types
 * class Name extends StringAttribute {}
 * class Age extends IntegerAttribute {}
 *
 * // Use with TypeFlags for entities (coming soon)
 */

// ============================================================
// Attribute System
// ============================================================

// Base attribute class
export {
  Attribute,
  validateAttributeName,
  getAttributeMetadata,
  registerAttribute,
  ComparisonExpr,
  TYPEDB_BUILTIN_TYPES,
  type AttributeMetadata,
  type ComparisonOperator,
} from './attribute/index.js';

// Flag system
export {
  TypeNameCase,
  TypeFlags,
  AttributeFlags,
  Card,
  Flag,
  Key,
  Unique,
  toSnakeCase,
  formatTypeName,
  type TypeFlagsOptions,
  type AttributeFlagsOptions,
  type FlagMarker,
} from './attribute/index.js';

// Concrete attribute types
export {
  StringAttribute,
  StringAttribute as String,
  StringExpr,
  type StringOperation,
} from './attribute/index.js';

export {
  IntegerAttribute,
  IntegerAttribute as Integer,
} from './attribute/index.js';

export {
  DoubleAttribute,
  DoubleAttribute as Double,
} from './attribute/index.js';

export {
  BooleanAttribute,
  BooleanAttribute as Boolean,
} from './attribute/index.js';

export {
  DateTimeAttribute,
  DateTimeAttribute as DateTime,
} from './attribute/index.js';

export {
  DateTimeTZAttribute,
  DateTimeTZAttribute as DateTimeTZ,
} from './attribute/index.js';

export { DateAttribute } from './attribute/index.js';

export {
  DecimalAttribute,
  DecimalAttribute as Decimal,
} from './attribute/index.js';

export {
  DurationAttribute,
  DurationAttribute as Duration,
} from './attribute/index.js';

// ============================================================
// Validation
// ============================================================

export {
  ValidationError,
  ReservedWordError,
  validateTypeName,
  type ValidationContext,
} from './validation.js';

export {
  TYPEQL_RESERVED_WORDS,
  getReservedWords,
  isReservedWord,
} from './reserved-words.js';

// ============================================================
// Models (Entity, Relation, Role)
// ============================================================

export {
  TypeDBType,
  initializeTypeDBType,
  Entity,
  defineEntity,
  Relation,
  defineRelation,
  Role,
  formatValue,
  isMultiValueAttribute,
  createDefaultFieldInfo,
  type TypeDBTypeConstructor,
  type EntityConfig,
  type EntityConstructor,
  type RelationConfig,
  type RelationConstructor,
  type RolePlayerType,
  type FieldInfo,
  type ModelAttrInfo,
  type TypeContext,
} from './models/index.js';

// ============================================================
// Database & Session
// ============================================================

export {
  Database,
  Transaction,
  TransactionContext,
  TypeDBError,
  executeQuery,
  type DatabaseConfig,
  type QueryResult,
  type Connection,
} from './database.js';

// ============================================================
// Query Builder
// ============================================================

export {
  Query,
  QueryBuilder,
  formatValue as formatQueryValue,
} from './query.js';

// ============================================================
// CRUD Operations
// ============================================================

export {
  // Exceptions
  CrudError,
  EntityNotFoundError,
  RelationNotFoundError,
  NotUniqueError,
  KeyAttributeError,
  InvalidFilterError,
  // Entity CRUD
  EntityManager,
  EntityQuery,
  // Relation CRUD
  RelationManager,
  RelationQuery,
  // Types
  type SortDirection,
  type SortSpec,
} from './crud/index.js';

// ============================================================
// Expressions
// ============================================================

export {
  // Base expression classes
  Expression,
  BooleanExpr,
  formatExprValue,
  getAttrName,
  type BooleanOperator,
  // Comparison expressions (enhanced versions)
  ComparisonExpr as ComparisonExpression,
  AttributeExistsExpr,
  InExpr,
  RangeExpr,
  type ComparisonOperator as ExprComparisonOperator,
  // String expressions (enhanced version)
  StringExpr as StringExpression,
  CaseInsensitiveExpr,
  type StringOperation as ExprStringOperation,
  // Aggregate expressions
  AggregateExpr,
  CountExpr,
  GroupByExpr,
  type AggregateFunction,
} from './expressions/index.js';

// ============================================================
// Version
// ============================================================

export const VERSION = '0.1.0';
