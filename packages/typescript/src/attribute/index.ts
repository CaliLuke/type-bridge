/**
 * TypeDB Attribute Types
 *
 * This module exports all attribute types for TypeDB schemas.
 */

// Base class and utilities
export {
  Attribute,
  validateAttributeName,
  getAttributeMetadata,
  registerAttribute,
  ComparisonExpr,
  TYPEDB_BUILTIN_TYPES,
  type AttributeMetadata,
  type AttributeConstructor,
  type ComparisonOperator,
} from './base.js';

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
} from './flags.js';

// Concrete attribute types
export { StringAttribute, StringAttribute as String, StringExpr, type StringOperation } from './string.js';
export { IntegerAttribute, IntegerAttribute as Integer } from './integer.js';
export { DoubleAttribute, DoubleAttribute as Double } from './double.js';
export { BooleanAttribute, BooleanAttribute as Boolean } from './boolean.js';
export { DateTimeAttribute, DateTimeAttribute as DateTime } from './datetime.js';
export { DateTimeTZAttribute, DateTimeTZAttribute as DateTimeTZ } from './datetime-tz.js';
export { DateAttribute } from './date.js';
export { DecimalAttribute, DecimalAttribute as Decimal } from './decimal.js';
export { DurationAttribute, DurationAttribute as Duration } from './duration.js';
