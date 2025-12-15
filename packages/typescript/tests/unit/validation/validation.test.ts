/**
 * Tests for validation module
 */

import {
  ValidationError,
  ReservedWordError,
  validateTypeName,
} from '../../../src/validation.js';
import { isReservedWord, TYPEQL_RESERVED_WORDS } from '../../../src/reserved-words.js';

describe('isReservedWord', () => {
  it('should return true for reserved words', () => {
    expect(isReservedWord('entity')).toBe(true);
    expect(isReservedWord('relation')).toBe(true);
    expect(isReservedWord('attribute')).toBe(true);
    expect(isReservedWord('match')).toBe(true);
    expect(isReservedWord('insert')).toBe(true);
    expect(isReservedWord('boolean')).toBe(true);
    expect(isReservedWord('string')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isReservedWord('ENTITY')).toBe(true);
    expect(isReservedWord('Entity')).toBe(true);
    expect(isReservedWord('eNtItY')).toBe(true);
  });

  it('should return false for non-reserved words', () => {
    expect(isReservedWord('person')).toBe(false);
    expect(isReservedWord('user')).toBe(false);
    expect(isReservedWord('custom_type')).toBe(false);
  });
});

describe('TYPEQL_RESERVED_WORDS', () => {
  it('should contain common reserved words', () => {
    expect(TYPEQL_RESERVED_WORDS.has('define')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('match')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('entity')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('relation')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('attribute')).toBe(true);
  });

  it('should contain value type reserved words', () => {
    expect(TYPEQL_RESERVED_WORDS.has('string')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('integer')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('boolean')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('double')).toBe(true);
    expect(TYPEQL_RESERVED_WORDS.has('datetime')).toBe(true);
  });
});

describe('validateTypeName', () => {
  describe('valid names', () => {
    it('should accept valid entity names', () => {
      expect(() => validateTypeName('person', 'entity')).not.toThrow();
      expect(() => validateTypeName('user_profile', 'entity')).not.toThrow();
      expect(() => validateTypeName('MyEntity', 'entity')).not.toThrow();
    });

    it('should accept valid relation names', () => {
      expect(() => validateTypeName('friendship', 'relation')).not.toThrow();
      expect(() => validateTypeName('user-connection', 'relation')).not.toThrow();
    });

    it('should accept valid attribute names', () => {
      expect(() => validateTypeName('name', 'attribute')).not.toThrow();
      expect(() => validateTypeName('email_address', 'attribute')).not.toThrow();
    });

    it('should accept valid role names', () => {
      expect(() => validateTypeName('friend', 'role')).not.toThrow();
      expect(() => validateTypeName('team_member', 'role')).not.toThrow();
    });
  });

  describe('reserved word errors', () => {
    it('should throw ReservedWordError for reserved words', () => {
      expect(() => validateTypeName('entity', 'entity')).toThrow(ReservedWordError);
      expect(() => validateTypeName('relation', 'relation')).toThrow(ReservedWordError);
      expect(() => validateTypeName('attribute', 'attribute')).toThrow(ReservedWordError);
    });

    it('should include suggestions in error message', () => {
      try {
        validateTypeName('entity', 'entity');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ReservedWordError);
        expect((e as ReservedWordError).message).toContain('Suggestions');
      }
    });
  });

  describe('validation errors', () => {
    it('should throw for empty names', () => {
      expect(() => validateTypeName('', 'entity')).toThrow(ValidationError);
    });

    it('should throw for names starting with number', () => {
      expect(() => validateTypeName('123name', 'entity')).toThrow(ValidationError);
    });

    it('should throw for names with invalid characters', () => {
      expect(() => validateTypeName('name@invalid', 'entity')).toThrow(ValidationError);
      expect(() => validateTypeName('name.invalid', 'entity')).toThrow(ValidationError);
      expect(() => validateTypeName('name invalid', 'entity')).toThrow(ValidationError);
    });
  });
});

describe('ReservedWordError', () => {
  it('should have correct properties', () => {
    const error = new ReservedWordError('entity', 'entity');
    expect(error.word).toBe('entity');
    expect(error.context).toBe('entity');
    expect(error.name).toBe('ReservedWordError');
  });

  it('should include custom suggestion if provided', () => {
    const error = new ReservedWordError('entity', 'entity', 'my_entity');
    expect(error.message).toContain('my_entity');
  });
});
