/**
 * Unit tests for base Expression classes.
 */

import {
  Expression,
  BooleanExpr,
  formatExprValue,
  getAttrName,
} from '../../../src/expressions/base.js';
import { AttributeFlags } from '../../../src/attribute/flags.js';
import { StringAttribute } from '../../../src/attribute/string.js';
import { IntegerAttribute } from '../../../src/attribute/integer.js';
import type { Attribute } from '../../../src/attribute/base.js';

// Test attribute classes
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

// Simple concrete Expression for testing
class TestExpr extends Expression {
  constructor(private readonly pattern: string) {
    super();
  }

  toTypeql(varPrefix: string): string {
    return `$${varPrefix} ${this.pattern}`;
  }

  getAttributeTypes(): Array<new (value: unknown) => Attribute<unknown>> {
    return [];
  }
}

describe('formatExprValue', () => {
  it('should format strings with quotes and escaping', () => {
    expect(formatExprValue('hello')).toBe('"hello"');
    expect(formatExprValue('say "hello"')).toBe('"say \\"hello\\""');
    expect(formatExprValue('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });

  it('should format booleans', () => {
    expect(formatExprValue(true)).toBe('true');
    expect(formatExprValue(false)).toBe('false');
  });

  it('should format numbers', () => {
    expect(formatExprValue(42)).toBe('42');
    expect(formatExprValue(3.14)).toBe('3.14');
    expect(formatExprValue(-10)).toBe('-10');
  });

  it('should format dates as ISO strings', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(formatExprValue(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should extract value from Attribute instances', () => {
    const name = new Name('Alice');
    expect(formatExprValue(name)).toBe('"Alice"');

    const age = new Age(30);
    expect(formatExprValue(age)).toBe('30');
  });

  it('should throw on null or undefined', () => {
    expect(() => formatExprValue(null)).toThrow();
    expect(() => formatExprValue(undefined)).toThrow();
  });
});

describe('getAttrName', () => {
  it('should get attribute name from flags', () => {
    expect(getAttrName(Name as unknown as new (value: unknown) => Attribute<unknown>)).toBe('name');
    expect(getAttrName(Age as unknown as new (value: unknown) => Attribute<unknown>)).toBe('age');
  });
});

describe('BooleanExpr', () => {
  it('should combine expressions with AND', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');
    const combined = new BooleanExpr('and', [expr1, expr2]);

    const result = combined.toTypeql('e');
    expect(result).toBe('$e has name;\n$e has age');
  });

  it('should combine expressions with OR', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');
    const combined = new BooleanExpr('or', [expr1, expr2]);

    const result = combined.toTypeql('e');
    expect(result).toBe('{ $e has name; } or { $e has age; }');
  });

  it('should negate expression with NOT', () => {
    const expr = new TestExpr('has name');
    const negated = new BooleanExpr('not', [expr]);

    const result = negated.toTypeql('e');
    expect(result).toBe('not { $e has name; }');
  });

  it('should throw for NOT with multiple operands', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');
    expect(() => new BooleanExpr('not', [expr1, expr2])).toThrow();
  });

  it('should throw for AND/OR with less than 2 operands', () => {
    const expr = new TestExpr('has name');
    expect(() => new BooleanExpr('and', [expr])).toThrow();
    expect(() => new BooleanExpr('or', [expr])).toThrow();
  });

  it('should collect attribute types from all operands', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');
    const combined = new BooleanExpr('and', [expr1, expr2]);

    const types = combined.getAttributeTypes();
    expect(types).toEqual([]);
  });
});

describe('Expression', () => {
  it('should provide and() method for chaining', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');

    const combined = expr1.and(expr2);
    expect(combined).toBeInstanceOf(BooleanExpr);
    expect(combined.operator).toBe('and');
  });

  it('should provide and_() alias', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');

    const combined = expr1.and_(expr2);
    expect(combined.operator).toBe('and');
  });

  it('should provide or() method for chaining', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');

    const combined = expr1.or(expr2);
    expect(combined).toBeInstanceOf(BooleanExpr);
    expect(combined.operator).toBe('or');
  });

  it('should provide or_() alias', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');

    const combined = expr1.or_(expr2);
    expect(combined.operator).toBe('or');
  });

  it('should provide not() method for negation', () => {
    const expr = new TestExpr('has name');

    const negated = expr.not();
    expect(negated).toBeInstanceOf(BooleanExpr);
    expect(negated.operator).toBe('not');
  });

  it('should provide not_() alias', () => {
    const expr = new TestExpr('has name');

    const negated = expr.not_();
    expect(negated.operator).toBe('not');
  });

  it('should support complex chaining', () => {
    const expr1 = new TestExpr('has name');
    const expr2 = new TestExpr('has age');
    const expr3 = new TestExpr('has email');

    // (expr1 AND expr2) OR expr3
    const combined = expr1.and(expr2).or(expr3);
    expect(combined).toBeInstanceOf(BooleanExpr);
    expect(combined.operator).toBe('or');
  });
});
