/**
 * Unit tests for string expressions.
 */

import {
  StringExpr,
  CaseInsensitiveExpr,
} from '../../../src/expressions/string.js';
import { AttributeFlags } from '../../../src/attribute/flags.js';
import { StringAttribute } from '../../../src/attribute/string.js';

// Test attribute classes
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Email extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'email' });
}

class Description extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'description' });
}

describe('StringExpr', () => {
  describe('contains operation', () => {
    it('should create contains expression', () => {
      const expr = new StringExpr(Name, 'contains', new Name('alice'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has name $e_name');
      expect(result).toContain('$e_name contains "alice"');
    });

    it('should use static factory method', () => {
      const expr = StringExpr.contains(Name, new Name('bob'));
      const result = expr.toTypeql('person');

      expect(result).toContain('$person has name $person_name');
      expect(result).toContain('$person_name contains "bob"');
    });
  });

  describe('like operation', () => {
    it('should create like (regex) expression', () => {
      const expr = new StringExpr(Email, 'like', new Email('.*@example.com'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has email $e_email');
      expect(result).toContain('$e_email like ".*@example.com"');
    });

    it('should use static factory method', () => {
      const expr = StringExpr.like(Email, new Email('admin@.*'));
      const result = expr.toTypeql('user');

      expect(result).toContain('$user has email $user_email');
      expect(result).toContain('$user_email like "admin@.*"');
    });
  });

  describe('regex operation', () => {
    it('should create regex expression (same as like)', () => {
      const expr = new StringExpr(Name, 'regex', new Name('^A.*'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has name $e_name');
      expect(result).toContain('$e_name like "^A.*"');
    });
  });

  describe('starts_with operation', () => {
    it('should create starts with expression using regex', () => {
      const expr = new StringExpr(Name, 'starts_with', new Name('Dr.'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has name $e_name');
      expect(result).toContain('$e_name like "^Dr\\..*"');
    });

    it('should use static factory method', () => {
      const expr = StringExpr.startsWith(Description, new Description('Important'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e_description like "^Important.*"');
    });

    it('should escape special regex characters', () => {
      const expr = StringExpr.startsWith(Name, new Name('Mr.'));
      const result = expr.toTypeql('e');

      // The period should be escaped
      expect(result).toContain('like "^Mr\\..*"');
    });
  });

  describe('ends_with operation', () => {
    it('should create ends with expression using regex', () => {
      const expr = new StringExpr(Email, 'ends_with', new Email('.com'));
      const result = expr.toTypeql('e');

      expect(result).toContain('$e has email $e_email');
      expect(result).toContain('$e_email like ".*\\.com$"');
    });

    it('should use static factory method', () => {
      const expr = StringExpr.endsWith(Email, new Email('@company.org'));
      const result = expr.toTypeql('e');

      expect(result).toContain('like ".*@company\\.org$"');
    });
  });

  describe('getAttributeTypes', () => {
    it('should return the attribute type', () => {
      const expr = new StringExpr(Name, 'contains', new Name('test'));
      const types = expr.getAttributeTypes();

      expect(types).toHaveLength(1);
    });
  });

  describe('logical combinations', () => {
    it('should support AND combination', () => {
      const nameExpr = StringExpr.contains(Name, new Name('alice'));
      const emailExpr = StringExpr.endsWith(Email, new Email('.com'));

      const combined = nameExpr.and(emailExpr);
      const result = combined.toTypeql('e');

      expect(result).toContain('$e has name $e_name');
      expect(result).toContain('$e has email $e_email');
    });

    it('should support OR combination', () => {
      const expr1 = StringExpr.contains(Name, new Name('admin'));
      const expr2 = StringExpr.contains(Name, new Name('root'));

      const combined = expr1.or(expr2);
      const result = combined.toTypeql('e');

      expect(result).toContain('or');
    });

    it('should support NOT negation', () => {
      const expr = StringExpr.contains(Email, new Email('spam'));
      const negated = expr.not();

      const result = negated.toTypeql('e');
      expect(result).toContain('not {');
    });
  });

  describe('unknown operation', () => {
    it('should throw for unknown operation', () => {
      const expr = new StringExpr(Name, 'unknown' as any, new Name('test'));
      expect(() => expr.toTypeql('e')).toThrow('Unknown string operation');
    });
  });
});

describe('CaseInsensitiveExpr', () => {
  it('should create case-insensitive match expression', () => {
    const expr = new CaseInsensitiveExpr(Name, 'ALICE');
    const result = expr.toTypeql('e');

    expect(result).toContain('$e has name $e_name');
    expect(result).toContain('$e_name like "(?i)ALICE"');
  });

  it('should escape special regex characters', () => {
    const expr = new CaseInsensitiveExpr(Name, 'Mr.');
    const result = expr.toTypeql('e');

    expect(result).toContain('like "(?i)Mr\\."');
  });

  it('should work with different variable prefixes', () => {
    const expr = new CaseInsensitiveExpr(Name, 'test');
    const result = expr.toTypeql('person');

    expect(result).toContain('$person has name $person_name');
  });

  it('should return attribute type', () => {
    const expr = new CaseInsensitiveExpr(Name, 'test');
    const types = expr.getAttributeTypes();

    expect(types).toHaveLength(1);
  });
});
