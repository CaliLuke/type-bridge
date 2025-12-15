/**
 * Tests for StringAttribute
 */

import { StringAttribute } from '../../../src/attribute/string.js';

describe('StringAttribute', () => {
  describe('constructor', () => {
    it('should create a string attribute with a value', () => {
      const name = new StringAttribute('Alice');
      expect(name.value).toBe('Alice');
    });

    it('should handle empty string', () => {
      const empty = new StringAttribute('');
      expect(empty.value).toBe('');
    });
  });

  describe('value property', () => {
    it('should return the stored value', () => {
      const attr = new StringAttribute('test');
      expect(attr.value).toBe('test');
    });
  });

  describe('toString', () => {
    it('should convert to string', () => {
      const attr = new StringAttribute('hello');
      expect(attr.toString()).toBe('hello');
    });
  });

  describe('equals', () => {
    it('should return true for same type and value', () => {
      const a = new StringAttribute('test');
      const b = new StringAttribute('test');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = new StringAttribute('test');
      const b = new StringAttribute('other');
      expect(a.equals(b)).toBe(false);
    });

    it('should return false for non-attribute comparison', () => {
      const a = new StringAttribute('test');
      expect(a.equals('test')).toBe(false);
    });
  });

  describe('concat', () => {
    it('should concatenate with string', () => {
      const a = new StringAttribute('Hello');
      const result = a.concat(' World');
      expect(result.value).toBe('Hello World');
    });

    it('should concatenate with another StringAttribute', () => {
      const a = new StringAttribute('Hello');
      const b = new StringAttribute(' World');
      const result = a.concat(b);
      expect(result.value).toBe('Hello World');
    });
  });

  describe('static valueType', () => {
    it('should be "string"', () => {
      expect(StringAttribute.valueType).toBe('string');
    });
  });
});

// Test subclass
class Name extends StringAttribute {}

describe('StringAttribute subclass (Name)', () => {
  it('should work like StringAttribute', () => {
    const name = new Name('Alice');
    expect(name.value).toBe('Alice');
  });

  it('should compare correctly with same subclass', () => {
    const a = new Name('Alice');
    const b = new Name('Alice');
    expect(a.equals(b)).toBe(true);
  });

  it('should not equal different subclass even with same value', () => {
    class OtherName extends StringAttribute {}
    const a = new Name('Alice');
    const b = new OtherName('Alice');
    expect(a.equals(b)).toBe(false);
  });
});
