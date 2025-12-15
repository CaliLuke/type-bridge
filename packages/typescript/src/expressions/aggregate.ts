/**
 * Aggregate expressions for TypeQL queries.
 *
 * Supports aggregation operations like sum, count, min, max, mean.
 */

import type { Attribute } from '../attribute/base.js';
import { getAttrName } from './base.js';

/**
 * Aggregate function types.
 */
export type AggregateFunction = 'sum' | 'count' | 'min' | 'max' | 'mean' | 'median' | 'std';

/**
 * Aggregate expression for computing aggregates over attributes.
 *
 * Note: AggregateExpr is used in reduce clauses, not filter clauses,
 * so it doesn't extend Expression (which is for filters).
 *
 * @example
 * ```typescript
 * // Sum of all salaries
 * const agg = new AggregateExpr(Salary, 'sum');
 * agg.toTypeql('e');
 * // Output: "$e has salary $e_salary; reduce $total = sum($e_salary)"
 *
 * // Count distinct names
 * const agg = new AggregateExpr(Name, 'count');
 * agg.toTypeql('e');
 * // Output: "$e has name $e_name; reduce $count = count($e_name)"
 * ```
 */
export class AggregateExpr<T> {
  constructor(
    public readonly attributeType: new (value: T) => Attribute<T>,
    public readonly func: AggregateFunction,
    public readonly alias?: string
  ) {}

  /**
   * Get the variable name for the aggregate result.
   */
  get resultVar(): string {
    if (this.alias) {
      return this.alias;
    }
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    return `${this.func}_${attrName}`;
  }

  /**
   * Generate the attribute binding clause.
   *
   * @param varPrefix - Variable prefix (e.g., 'e' for '$e')
   * @returns The has clause for binding the attribute
   */
  toBindClause(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;

    return `$${varPrefix} has ${attrName} ${attrVar}`;
  }

  /**
   * Generate the reduce clause.
   *
   * @param varPrefix - Variable prefix (e.g., 'e' for '$e')
   * @returns The reduce clause
   */
  toReduceClause(varPrefix: string): string {
    const attrName = getAttrName(
      this.attributeType as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;

    return `reduce $${this.resultVar} = ${this.func}(${attrVar})`;
  }

  /**
   * Generate complete TypeQL for this aggregate.
   *
   * @param varPrefix - Variable prefix
   * @returns Complete TypeQL including bind and reduce clauses
   */
  toTypeql(varPrefix: string): string {
    const bindClause = this.toBindClause(varPrefix);
    const reduceClause = this.toReduceClause(varPrefix);

    return `${bindClause};\n${reduceClause};`;
  }

  /**
   * Get attribute types used in this aggregate.
   */
  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [this.attributeType as unknown as new (value: unknown) => Attribute<unknown>];
  }

  /**
   * Create a sum aggregate.
   */
  static sum<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'sum', alias);
  }

  /**
   * Create a count aggregate.
   */
  static count<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'count', alias);
  }

  /**
   * Create a min aggregate.
   */
  static min<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'min', alias);
  }

  /**
   * Create a max aggregate.
   */
  static max<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'max', alias);
  }

  /**
   * Create a mean (average) aggregate.
   */
  static mean<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'mean', alias);
  }

  /**
   * Create a median aggregate.
   */
  static median<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'median', alias);
  }

  /**
   * Create a standard deviation aggregate.
   */
  static std<T>(
    attrType: new (value: T) => Attribute<T>,
    alias?: string
  ): AggregateExpr<T> {
    return new AggregateExpr(attrType, 'std', alias);
  }
}

/**
 * Simple count aggregate (counts entities, not attribute values).
 *
 * @example
 * ```typescript
 * // Count all persons
 * const agg = new CountExpr();
 * agg.toReduceClause();
 * // Output: "reduce $count = count;"
 * ```
 */
export class CountExpr {
  constructor(public readonly alias: string = 'count') {}

  /**
   * Generate the reduce clause for counting.
   */
  toReduceClause(): string {
    return `reduce $${this.alias} = count;`;
  }

  /**
   * Create a count expression.
   */
  static create(alias?: string): CountExpr {
    return new CountExpr(alias);
  }
}

/**
 * Group-by aggregate expression.
 *
 * @example
 * ```typescript
 * // Average salary by department
 * const groupBy = new GroupByExpr(
 *   Department,
 *   [AggregateExpr.mean(Salary, 'avg_salary')]
 * );
 * ```
 */
export class GroupByExpr<T> {
  constructor(
    public readonly groupByAttr: new (value: T) => Attribute<T>,
    public readonly aggregates: AggregateExpr<unknown>[]
  ) {}

  /**
   * Generate the attribute binding clause for group by.
   */
  toBindClause(varPrefix: string): string {
    const attrName = getAttrName(
      this.groupByAttr as unknown as new (value: unknown) => Attribute<unknown>
    );
    const attrVar = `$${varPrefix}_${attrName}`;

    const bindings = [`$${varPrefix} has ${attrName} ${attrVar}`];

    for (const agg of this.aggregates) {
      bindings.push(agg.toBindClause(varPrefix));
    }

    return bindings.join(';\n');
  }

  /**
   * Generate the reduce clause with group by.
   */
  toReduceClause(varPrefix: string): string {
    const attrName = getAttrName(
      this.groupByAttr as unknown as new (value: unknown) => Attribute<unknown>
    );
    const groupVar = `$${varPrefix}_${attrName}`;

    const reduceItems: string[] = [];
    for (const agg of this.aggregates) {
      const aggAttrName = getAttrName(
        agg.attributeType as unknown as new (value: unknown) => Attribute<unknown>
      );
      const aggVar = `$${varPrefix}_${aggAttrName}`;
      reduceItems.push(`$${agg.resultVar} = ${agg.func}(${aggVar})`);
    }

    return `reduce ${reduceItems.join(', ')} within ${groupVar};`;
  }

  /**
   * Generate complete TypeQL for this group-by aggregate.
   */
  toTypeql(varPrefix: string): string {
    const bindClause = this.toBindClause(varPrefix);
    const reduceClause = this.toReduceClause(varPrefix);

    return `${bindClause};\n${reduceClause}`;
  }
}
