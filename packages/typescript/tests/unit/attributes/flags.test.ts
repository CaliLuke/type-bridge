/**
 * Tests for Flag system
 */

import {
  TypeNameCase,
  TypeFlags,
  AttributeFlags,
  Card,
  Flag,
  Key,
  Unique,
  toSnakeCase,
  formatTypeName,
} from '../../../src/attribute/flags.js';

describe('TypeNameCase', () => {
  it('should have correct enum values', () => {
    expect(TypeNameCase.LOWERCASE).toBe('lowercase');
    expect(TypeNameCase.CLASS_NAME).toBe('classname');
    expect(TypeNameCase.SNAKE_CASE).toBe('snake_case');
  });
});

describe('toSnakeCase', () => {
  it('should convert PascalCase to snake_case', () => {
    expect(toSnakeCase('PersonName')).toBe('person_name');
    expect(toSnakeCase('SimpleClass')).toBe('simple_class');
  });

  it('should handle consecutive uppercase letters', () => {
    // HTTPResponse becomes http_response (consecutive uppercase treated as one word)
    expect(toSnakeCase('HTTPResponse')).toBe('http_response');
  });

  it('should handle single word', () => {
    expect(toSnakeCase('Person')).toBe('person');
  });
});

describe('formatTypeName', () => {
  it('should format as lowercase', () => {
    expect(formatTypeName('PersonName', TypeNameCase.LOWERCASE)).toBe('personname');
  });

  it('should preserve class name', () => {
    expect(formatTypeName('PersonName', TypeNameCase.CLASS_NAME)).toBe('PersonName');
  });

  it('should format as snake_case', () => {
    expect(formatTypeName('PersonName', TypeNameCase.SNAKE_CASE)).toBe('person_name');
  });
});

describe('TypeFlags', () => {
  it('should create with default values', () => {
    const flags = new TypeFlags();
    expect(flags.name).toBeUndefined();
    expect(flags.abstract).toBe(false);
    expect(flags.base).toBe(false);
    expect(flags.case).toBe(TypeNameCase.CLASS_NAME);
  });

  it('should create with custom values', () => {
    const flags = new TypeFlags({
      name: 'person',
      abstract: true,
      base: false,
      case: TypeNameCase.SNAKE_CASE,
    });
    expect(flags.name).toBe('person');
    expect(flags.abstract).toBe(true);
    expect(flags.case).toBe(TypeNameCase.SNAKE_CASE);
  });
});

describe('Card', () => {
  it('should create with positional arguments', () => {
    const card = new Card(1, 5);
    expect(card.min).toBe(1);
    expect(card.max).toBe(5);
  });

  it('should create with single positional argument', () => {
    const card = new Card(2);
    expect(card.min).toBe(2);
    expect(card.max).toBeUndefined();
  });

  it('should create with object argument', () => {
    const card = new Card({ min: 0, max: 10 });
    expect(card.min).toBe(0);
    expect(card.max).toBe(10);
  });

  it('should default min to 0 when only max is specified', () => {
    const card = new Card({ max: 5 });
    expect(card.min).toBe(0);
    expect(card.max).toBe(5);
  });
});

describe('AttributeFlags', () => {
  it('should create with default values', () => {
    const flags = new AttributeFlags();
    expect(flags.isKey).toBe(false);
    expect(flags.isUnique).toBe(false);
    expect(flags.cardMin).toBeUndefined();
    expect(flags.cardMax).toBeUndefined();
  });

  describe('toTypeqlAnnotations', () => {
    it('should return @key for key attribute', () => {
      const flags = new AttributeFlags({ isKey: true, cardMin: 1, cardMax: 1 });
      expect(flags.toTypeqlAnnotations()).toEqual(['@key']);
    });

    it('should return @unique for unique attribute', () => {
      const flags = new AttributeFlags({ isUnique: true, cardMin: 1, cardMax: 1 });
      expect(flags.toTypeqlAnnotations()).toEqual(['@unique']);
    });

    it('should return @card for cardinality', () => {
      const flags = new AttributeFlags({ cardMin: 2, cardMax: 5 });
      expect(flags.toTypeqlAnnotations()).toEqual(['@card(2..5)']);
    });

    it('should return @card(min..) for unbounded max', () => {
      const flags = new AttributeFlags({ cardMin: 2 });
      expect(flags.toTypeqlAnnotations()).toEqual(['@card(2..)']);
    });
  });
});

describe('Flag function', () => {
  it('should create key flag', () => {
    const flags = Flag(Key);
    expect(flags.isKey).toBe(true);
    expect(flags.cardMin).toBe(1);
    expect(flags.cardMax).toBe(1);
  });

  it('should create unique flag', () => {
    const flags = Flag(Unique);
    expect(flags.isUnique).toBe(true);
  });

  it('should create card flag', () => {
    const flags = Flag(new Card(2, 5));
    expect(flags.cardMin).toBe(2);
    expect(flags.cardMax).toBe(5);
    expect(flags.hasExplicitCard).toBe(true);
  });

  it('should combine multiple flags', () => {
    const flags = Flag(Key, Unique);
    expect(flags.isKey).toBe(true);
    expect(flags.isUnique).toBe(true);
  });
});
