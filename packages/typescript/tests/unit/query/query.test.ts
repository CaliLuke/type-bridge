/**
 * Unit tests for Query builder.
 */

import { Query, formatValue } from '../../../src/query.js';

describe('formatValue', () => {
  it('should format strings with quotes', () => {
    expect(formatValue('hello')).toBe('"hello"');
  });

  it('should escape quotes in strings', () => {
    expect(formatValue('say "hello"')).toBe('"say \\"hello\\""');
  });

  it('should escape backslashes in strings', () => {
    expect(formatValue('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });

  it('should format booleans', () => {
    expect(formatValue(true)).toBe('true');
    expect(formatValue(false)).toBe('false');
  });

  it('should format integers', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(-10)).toBe('-10');
  });

  it('should format floats', () => {
    expect(formatValue(3.14)).toBe('3.14');
    expect(formatValue(-0.5)).toBe('-0.5');
  });

  it('should format dates as ISO strings', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(formatValue(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should format other types as escaped strings', () => {
    expect(formatValue(null)).toBe('"null"');
    expect(formatValue(undefined)).toBe('"undefined"');
  });
});

describe('Query', () => {
  describe('match', () => {
    it('should build a simple match query', () => {
      const query = new Query().match('$p isa person').build();
      expect(query).toBe('match\n$p isa person;');
    });

    it('should join multiple match clauses with semicolons', () => {
      const query = new Query()
        .match('$p isa person')
        .match('$c isa company')
        .build();
      expect(query).toBe('match\n$p isa person; $c isa company;');
    });
  });

  describe('fetch', () => {
    it('should build a fetch clause with wildcard', () => {
      const query = new Query()
        .match('$p isa person')
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\nfetch {\n  $p.*\n};');
    });

    it('should handle multiple fetch variables', () => {
      const query = new Query()
        .match('$p isa person')
        .fetch('$p')
        .fetch('$c')
        .build();
      expect(query).toBe('match\n$p isa person;\nfetch {\n  $p.*,\n  $c.*\n};');
    });
  });

  describe('insert', () => {
    it('should build an insert query', () => {
      const query = new Query()
        .insert('$p isa person, has name "Alice"')
        .build();
      expect(query).toBe('insert\n$p isa person, has name "Alice";');
    });
  });

  describe('delete', () => {
    it('should build a delete query', () => {
      const query = new Query()
        .match('$p isa person, has name "Alice"')
        .delete('$p')
        .build();
      expect(query).toBe('match\n$p isa person, has name "Alice";\ndelete\n$p;');
    });
  });

  describe('limit and offset', () => {
    it('should add limit clause', () => {
      const query = new Query()
        .match('$p isa person')
        .limit(10)
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\nlimit 10;\nfetch {\n  $p.*\n};');
    });

    it('should add offset clause', () => {
      const query = new Query()
        .match('$p isa person')
        .offset(5)
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\noffset 5;\nfetch {\n  $p.*\n};');
    });

    it('should add both offset and limit (offset before limit)', () => {
      const query = new Query()
        .match('$p isa person')
        .offset(5)
        .limit(10)
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\noffset 5;\nlimit 10;\nfetch {\n  $p.*\n};');
    });
  });

  describe('sort', () => {
    it('should add sort clause with default ascending', () => {
      const query = new Query()
        .match('$p isa person')
        .sort('$name')
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\nsort $name asc;\nfetch {\n  $p.*\n};');
    });

    it('should add sort clause with descending', () => {
      const query = new Query()
        .match('$p isa person')
        .sort('$age', 'desc')
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\nsort $age desc;\nfetch {\n  $p.*\n};');
    });

    it('should handle multiple sort clauses', () => {
      const query = new Query()
        .match('$p isa person')
        .sort('$name', 'asc')
        .sort('$age', 'desc')
        .fetch('$p')
        .build();
      expect(query).toBe('match\n$p isa person;\nsort $name asc, $age desc;\nfetch {\n  $p.*\n};');
    });
  });

  describe('combined clauses', () => {
    it('should build a complete query with all modifiers', () => {
      const query = new Query()
        .match('$p isa person')
        .sort('$name')
        .offset(10)
        .limit(20)
        .fetch('$p')
        .build();
      expect(query).toBe(
        'match\n$p isa person;\nsort $name asc;\noffset 10;\nlimit 20;\nfetch {\n  $p.*\n};'
      );
    });

    it('should build a delete with insert (update pattern)', () => {
      const query = new Query()
        .match('$p isa person, has name $name; $name = "Alice"')
        .delete('$p has $name')
        .insert('$p has name "Bob"')
        .build();
      expect(query).toBe(
        'match\n$p isa person, has name $name; $name = "Alice";\ndelete\n$p has $name;\ninsert\n$p has name "Bob";'
      );
    });
  });

  describe('toString', () => {
    it('should return the same as build()', () => {
      const query = new Query().match('$p isa person').fetch('$p');
      expect(query.toString()).toBe(query.build());
    });
  });
});
