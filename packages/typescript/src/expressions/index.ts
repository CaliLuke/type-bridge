/**
 * Expression system for building type-safe TypeQL queries.
 *
 * Expressions provide a fluent API for constructing query filters
 * and aggregations that can be combined using logical operators.
 *
 * @example
 * ```typescript
 * import {
 *   ComparisonExpr,
 *   StringExpr,
 *   BooleanExpr,
 *   AggregateExpr
 * } from 'type-bridge-ts';
 *
 * // Comparison expression
 * const ageExpr = ComparisonExpr.gt(Age, new Age(30));
 *
 * // String expression
 * const nameExpr = StringExpr.contains(Name, new Name('alice'));
 *
 * // Combine with AND
 * const combined = ageExpr.and(nameExpr);
 *
 * // Aggregate
 * const sumSalary = AggregateExpr.sum(Salary);
 * ```
 */

// Base expression classes
export {
  Expression,
  BooleanExpr,
  formatExprValue,
  getAttrName,
  type BooleanOperator,
} from './base.js';

// Comparison expressions
export {
  ComparisonExpr,
  AttributeExistsExpr,
  InExpr,
  RangeExpr,
  type ComparisonOperator,
} from './comparison.js';

// String expressions
export {
  StringExpr,
  CaseInsensitiveExpr,
  type StringOperation,
} from './string.js';

// Aggregate expressions
export {
  AggregateExpr,
  CountExpr,
  GroupByExpr,
  type AggregateFunction,
} from './aggregate.js';
