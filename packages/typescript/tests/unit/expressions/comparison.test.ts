/**
 * Unit tests for comparison expressions.
 */

import {
  ComparisonExpr,
  AttributeExistsExpr,
  InExpr,
  RangeExpr,
} from '../../../src/expressions/comparison.js';
import { AttributeFlags } from '../../../src/attribute/flags.js';
import { StringAttribute } from '../../../src/attribute/string.js';
import { IntegerAttribute } from '../../../src/attribute/integer.js';

// Test attribute classes
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

class Salary extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'salary' });
}

class Status extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'status' });
}

describe('ComparisonExpr', () => {
  describe('constructor and toTypeql', () => {
    it('should create greater than expression', () => {
      const expr = new ComparisonExpr(Age, '>', new Age(30));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has age $e_age');
      expect(result).toContain('$e_age > 30');
    });

    it('should create less than expression', () => {
      const expr = new ComparisonExpr(Age, '<', new Age(50));
      const result = expr.toTypeql('person');

      expect(result).toContain('$person has age $person_age');
      expect(result).toContain('$person_age < 50');
    });

    it('should create equals expression with string', () => {
      const expr = new ComparisonExpr(Name, '==', new Name('Alice'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has name $e_name');
      expect(result).toContain('$e_name == "Alice"');
    });

    it('should create not equals expression', () => {
      const expr = new ComparisonExpr(Status, '!=', new Status('inactive'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has status $e_status');
      expect(result).toContain('$e_status != "inactive"');
    });

    it('should create greater than or equal expression', () => {
      const expr = new ComparisonExpr(Age, '>=', new Age(18));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e_age >= 18');
    });

    it('should create less than or equal expression', () => {
      const expr = new ComparisonExpr(Age, '<=', new Age(65));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e_age <= 65');
    });
  });

  describe('static factory methods', () => {
    it('should create gt expression', () => {
      const expr = ComparisonExpr.gt(Age, new Age(30));
      expect(expr.operator).toBe('>');
    });

    it('should create gte expression', () => {
      const expr = ComparisonExpr.gte(Age, new Age(30));
      expect(expr.operator).toBe('>=');
    });

    it('should create lt expression', () => {
      const expr = ComparisonExpr.lt(Age, new Age(30));
      expect(expr.operator).toBe('<');
    });

    it('should create lte expression', () => {
      const expr = ComparisonExpr.lte(Age, new Age(30));
      expect(expr.operator).toBe('<=');
    });

    it('should create eq expression', () => {
      const expr = ComparisonExpr.eq(Age, new Age(30));
      expect(expr.operator).toBe('==');
    });

    it('should create ne expression', () => {
      const expr = ComparisonExpr.ne(Age, new Age(30));
      expect(expr.operator).toBe('!=');
    });
  });

  describe('getAttributeTypes', () => {
    it('should return the attribute type', () => {
      const expr = new ComparisonExpr(Age, '>', new Age(30));
      const types = expr.getAttributeTypes();

      expect(types).toHaveLength(1);
    });
  });

  describe('logical combinations', () => {
    it('should support AND combination', () => {
      const ageExpr = ComparisonExpr.gt(Age, new Age(18));
      const salaryExpr = ComparisonExpr.gte(Salary, new Salary(50000));

      const combined = ageExpr.and(salaryExpr);
      const result = combined.toTypeql('e');

      expect(result).toContain('$e has age $e_age');
      expect(result).toContain('$e has salary $e_salary');
    });

    it('should support OR combination', () => {
      const ageExpr = ComparisonExpr.lt(Age, new Age(18));
      const ageExpr2 = ComparisonExpr.gt(Age, new Age(65));

      const combined = ageExpr.or(ageExpr2);
      const result = combined.toTypeql('e');

      expect(result).toContain('or');
    });

    it('should support NOT negation', () => {
      const expr = ComparisonExpr.eq(Status, new Status('inactive'));
      const negated = expr.not();

      const result = negated.toTypeql('e');
      expect(result).toContain('not {');
    });
  });
});

describe('AttributeExistsExpr', () => {
  it('should create existence check expression', () => {
    const expr = new AttributeExistsExpr(Age);
    const result = expr.toTypeql('e');

    expect(result).toBe('$e has age $e_age');
  });

  it('should support NOT for non-existence', () => {
    const expr = new AttributeExistsExpr(Age);
    const notExpr = expr.not();
    const result = notExpr.toTypeql('e');

    expect(result).toContain('not {');
    expect(result).toContain('$e has age $e_age');
  });

  it('should return attribute type', () => {
    const expr = new AttributeExistsExpr(Age);
    const types = expr.getAttributeTypes();

    expect(types).toHaveLength(1);
  });
});

describe('InExpr', () => {
  it('should create IN expression with multiple values', () => {
    const expr = new InExpr(Status, [
      new Status('active'),
      new Status('pending'),
    ]);
    const result = expr.toTypeql('e');

    expect(result).toContain('or');
    expect(result).toContain('"active"');
    expect(result).toContain('"pending"');
  });

  it('should create single-value IN expression', () => {
    const expr = new InExpr(Status, [new Status('active')]);
    const result = expr.toTypeql('e');

    expect(result).toContain('"active"');
  });

  it('should throw for empty values', () => {
    expect(() => new InExpr(Status, [])).toThrow();
  });

  it('should return attribute type', () => {
    const expr = new InExpr(Status, [new Status('active')]);
    const types = expr.getAttributeTypes();

    expect(types).toHaveLength(1);
  });
});

describe('RangeExpr', () => {
  it('should create inclusive range expression', () => {
    const expr = new RangeExpr(Age, new Age(18), new Age(65));
    const result = expr.toTypeql('e');

    expect(result).toContain('$e has age $e_age');
    expect(result).toContain('$e_age >= 18');
    expect(result).toContain('$e_age <= 65');
  });

  it('should create exclusive range expression', () => {
    const expr = new RangeExpr(Age, new Age(18), new Age(65), false);
    const result = expr.toTypeql('e');

    expect(result).toContain('$e_age > 18');
    expect(result).toContain('$e_age < 65');
  });

  it('should return attribute type', () => {
    const expr = new RangeExpr(Age, new Age(18), new Age(65));
    const types = expr.getAttributeTypes();

    expect(types).toHaveLength(1);
  });
});
