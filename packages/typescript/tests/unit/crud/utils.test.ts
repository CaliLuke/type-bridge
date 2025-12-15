/**
 * Unit tests for CRUD utilities.
 */

import {
  formatValue,
  isMultiValueAttribute,
  getKeyAttributes,
  buildFetchClause,
  buildAttributeFilters,
} from '../../../src/crud/utils.js';
import { AttributeFlags, Card } from '../../../src/attribute/flags.js';
import { StringAttribute } from '../../../src/attribute/string.js';

describe('formatValue', () => {
  it('should format strings with quotes and escaping', () => {
    expect(formatValue('hello')).toBe('"hello"');
    expect(formatValue('say "hello"')).toBe('"say \\"hello\\""');
    expect(formatValue('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });

  it('should format booleans', () => {
    expect(formatValue(true)).toBe('true');
    expect(formatValue(false)).toBe('false');
  });

  it('should format numbers', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(3.14)).toBe('3.14');
    expect(formatValue(-10)).toBe('-10');
  });

  it('should format dates as ISO strings', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(formatValue(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should extract value from Attribute instances', () => {
    class Name extends StringAttribute {}
    const name = new Name('Alice');
    expect(formatValue(name)).toBe('"Alice"');
  });
});

describe('isMultiValueAttribute', () => {
  it('should return false for default flags (no cardinality)', () => {
    const flags = new AttributeFlags();
    expect(isMultiValueAttribute(flags)).toBe(false);
  });

  it('should return false for single-value cardinality (max=1)', () => {
    const flags = new AttributeFlags({ cardMin: 0, cardMax: 1 });
    expect(isMultiValueAttribute(flags)).toBe(false);
  });

  it('should return true for multi-value cardinality (max > 1)', () => {
    const flags = new AttributeFlags({ cardMin: 0, cardMax: 5 });
    expect(isMultiValueAttribute(flags)).toBe(true);
  });

  it('should return true for unbounded cardinality (max = undefined)', () => {
    const flags = new AttributeFlags({ cardMin: 2 });
    expect(isMultiValueAttribute(flags)).toBe(true);
  });
});

describe('getKeyAttributes', () => {
  it('should return empty array when no key attributes', () => {
    class Name extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'name' });
    }
    const attrs = new Map([
      ['name', { typ: Name, flags: new AttributeFlags() }],
    ]);
    const keyAttrs = getKeyAttributes(attrs);
    expect(keyAttrs).toEqual([]);
  });

  it('should return key attributes', () => {
    class Id extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'id' });
    }
    class Name extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'name' });
    }
    const attrs = new Map([
      ['id', { typ: Id, flags: new AttributeFlags({ isKey: true }) }],
      ['name', { typ: Name, flags: new AttributeFlags() }],
    ]);
    const keyAttrs = getKeyAttributes(attrs);
    expect(keyAttrs.length).toBe(1);
    expect(keyAttrs[0]?.[0]).toBe('id');
    expect(keyAttrs[0]?.[1].flags.isKey).toBe(true);
  });
});

describe('buildFetchClause', () => {
  it('should build fetch clause for variable', () => {
    const result = buildFetchClause('$e');
    expect(result).toBe('fetch {\n  $e.*\n};');
  });

  it('should work with different variable names', () => {
    const result = buildFetchClause('$person');
    expect(result).toBe('fetch {\n  $person.*\n};');
  });
});

describe('buildAttributeFilters', () => {
  it('should build filter patterns for known attributes', () => {
    class Name extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'name' });
    }
    const attrs = new Map([
      ['name', { typ: Name, flags: new AttributeFlags() }],
    ]);
    const filters = { name: 'Alice' };
    const patterns = buildAttributeFilters(attrs, filters);
    expect(patterns).toEqual(['has name "Alice"']);
  });

  it('should ignore unknown fields', () => {
    class Name extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'name' });
    }
    const attrs = new Map([
      ['name', { typ: Name, flags: new AttributeFlags() }],
    ]);
    const filters = { name: 'Alice', unknown: 'value' };
    const patterns = buildAttributeFilters(attrs, filters);
    expect(patterns).toEqual(['has name "Alice"']);
  });

  it('should skip null and undefined values', () => {
    class Name extends StringAttribute {
      static override flags = new AttributeFlags({ name: 'name' });
    }
    const attrs = new Map([
      ['name', { typ: Name, flags: new AttributeFlags() }],
    ]);
    const filters = { name: null };
    const patterns = buildAttributeFilters(attrs, filters as Record<string, unknown>);
    expect(patterns).toEqual([]);
  });
});
