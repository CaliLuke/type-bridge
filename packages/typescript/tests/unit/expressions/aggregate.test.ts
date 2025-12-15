/**
 * Unit tests for aggregate expressions.
 */

import {
  AggregateExpr,
  CountExpr,
  GroupByExpr,
} from '../../../src/expressions/aggregate.js';
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

class Department extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'department' });
}

describe('AggregateExpr', () => {
  describe('constructor', () => {
    it('should create aggregate expression', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      expect(agg.func).toBe('sum');
      expect(agg.attributeType).toBe(Salary);
    });

    it('should support custom alias', () => {
      const agg = new AggregateExpr(Salary, 'sum', 'total_salary');
      expect(agg.alias).toBe('total_salary');
      expect(agg.resultVar).toBe('total_salary');
    });

    it('should generate default result variable name', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      expect(agg.resultVar).toBe('sum_salary');
    });
  });

  describe('toBindClause', () => {
    it('should generate attribute binding clause', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      const result = agg.toBindClause('e');

      expect(result).toBe('$e has salary $e_salary');
    });

    it('should use different variable prefixes', () => {
      const agg = new AggregateExpr(Age, 'mean');
      const result = agg.toBindClause('person');

      expect(result).toBe('$person has age $person_age');
    });
  });

  describe('toReduceClause', () => {
    it('should generate reduce clause for sum', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $sum_salary = sum($e_salary)');
    });

    it('should generate reduce clause with custom alias', () => {
      const agg = new AggregateExpr(Salary, 'sum', 'total');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $total = sum($e_salary)');
    });

    it('should generate reduce clause for count', () => {
      const agg = new AggregateExpr(Name, 'count');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $count_name = count($e_name)');
    });

    it('should generate reduce clause for min', () => {
      const agg = new AggregateExpr(Age, 'min');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $min_age = min($e_age)');
    });

    it('should generate reduce clause for max', () => {
      const agg = new AggregateExpr(Age, 'max');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $max_age = max($e_age)');
    });

    it('should generate reduce clause for mean', () => {
      const agg = new AggregateExpr(Age, 'mean');
      const result = agg.toReduceClause('e');

      expect(result).toBe('reduce $mean_age = mean($e_age)');
    });
  });

  describe('toTypeql', () => {
    it('should generate complete TypeQL', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      const result = agg.toTypeql('e');

      expect(result).toContain('$e has salary $e_salary');
      expect(result).toContain('reduce $sum_salary = sum($e_salary)');
    });
  });

  describe('static factory methods', () => {
    it('should create sum aggregate', () => {
      const agg = AggregateExpr.sum(Salary);
      expect(agg.func).toBe('sum');
    });

    it('should create sum aggregate with alias', () => {
      const agg = AggregateExpr.sum(Salary, 'total');
      expect(agg.alias).toBe('total');
    });

    it('should create count aggregate', () => {
      const agg = AggregateExpr.count(Name);
      expect(agg.func).toBe('count');
    });

    it('should create min aggregate', () => {
      const agg = AggregateExpr.min(Age);
      expect(agg.func).toBe('min');
    });

    it('should create max aggregate', () => {
      const agg = AggregateExpr.max(Age);
      expect(agg.func).toBe('max');
    });

    it('should create mean aggregate', () => {
      const agg = AggregateExpr.mean(Salary);
      expect(agg.func).toBe('mean');
    });

    it('should create median aggregate', () => {
      const agg = AggregateExpr.median(Age);
      expect(agg.func).toBe('median');
    });

    it('should create std aggregate', () => {
      const agg = AggregateExpr.std(Salary);
      expect(agg.func).toBe('std');
    });
  });

  describe('getAttributeTypes', () => {
    it('should return attribute type', () => {
      const agg = new AggregateExpr(Salary, 'sum');
      const types = agg.getAttributeTypes();

      expect(types).toHaveLength(1);
    });
  });
});

describe('CountExpr', () => {
  it('should create count expression with default alias', () => {
    const expr = new CountExpr();
    const result = expr.toReduceClause();

    expect(result).toBe('reduce $count = count;');
  });

  it('should create count expression with custom alias', () => {
    const expr = new CountExpr('total_count');
    const result = expr.toReduceClause();

    expect(result).toBe('reduce $total_count = count;');
  });

  it('should use static factory method', () => {
    const expr = CountExpr.create('my_count');
    const result = expr.toReduceClause();

    expect(result).toBe('reduce $my_count = count;');
  });
});

describe('GroupByExpr', () => {
  describe('toBindClause', () => {
    it('should generate binding for group by and aggregates', () => {
      const groupBy = new GroupByExpr(Department, [
        AggregateExpr.mean(Salary, 'avg_salary'),
      ]);
      const result = groupBy.toBindClause('e');

      expect(result).toContain('$e has department $e_department');
      expect(result).toContain('$e has salary $e_salary');
    });

    it('should handle multiple aggregates', () => {
      const groupBy = new GroupByExpr(Department, [
        AggregateExpr.sum(Salary, 'total_salary'),
        AggregateExpr.count(Name, 'employee_count'),
      ]);
      const result = groupBy.toBindClause('e');

      expect(result).toContain('$e has department $e_department');
      expect(result).toContain('$e has salary $e_salary');
      expect(result).toContain('$e has name $e_name');
    });
  });

  describe('toReduceClause', () => {
    it('should generate reduce clause with group by', () => {
      const groupBy = new GroupByExpr(Department, [
        AggregateExpr.mean(Salary, 'avg_salary'),
      ]);
      const result = groupBy.toReduceClause('e');

      expect(result).toContain('reduce');
      expect(result).toContain('$avg_salary = mean($e_salary)');
      expect(result).toContain('within $e_department');
    });

    it('should handle multiple aggregates', () => {
      const groupBy = new GroupByExpr(Department, [
        AggregateExpr.sum(Salary, 'total'),
        AggregateExpr.count(Name, 'count'),
      ]);
      const result = groupBy.toReduceClause('e');

      expect(result).toContain('$total = sum($e_salary)');
      expect(result).toContain('$count = count($e_name)');
      expect(result).toContain('within $e_department');
    });
  });

  describe('toTypeql', () => {
    it('should generate complete TypeQL for group by', () => {
      const groupBy = new GroupByExpr(Department, [
        AggregateExpr.mean(Salary, 'avg_salary'),
      ]);
      const result = groupBy.toTypeql('e');

      expect(result).toContain('$e has department $e_department');
      expect(result).toContain('$e has salary $e_salary');
      expect(result).toContain('reduce');
      expect(result).toContain('within $e_department');
    });
  });
});
