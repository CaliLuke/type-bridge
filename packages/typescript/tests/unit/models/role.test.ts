/**
 * Tests for Role class
 */

import {
  Role,
  Entity,
  TypeFlags,
  StringAttribute,
  AttributeFlags,
} from '../../../src/index.js';
import type { ModelAttrInfo } from '../../../src/models/utils.js';

// Define test entities
class Name extends StringAttribute {}

class Person extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'person' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
  ]);

  declare name: Name;
}

class Company extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'company' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
  ]);

  declare name: Name;
}

describe('Role', () => {
  describe('constructor', () => {
    it('should create role with single player type', () => {
      const role = new Role('employee', Person);

      expect(role.roleName).toBe('employee');
      expect(role.playerEntityType).toBe(Person);
      expect(role.playerEntityTypes).toHaveLength(1);
      expect(role.playerType).toBe('person');
    });

    it('should create role with multiple player types', () => {
      const role = new Role('participant', Person, Company);

      expect(role.roleName).toBe('participant');
      expect(role.playerEntityTypes).toHaveLength(2);
      expect(role.playerTypes).toContain('person');
      expect(role.playerTypes).toContain('company');
    });

    it('should throw for reserved word role name', () => {
      expect(() => {
        new Role('entity', Person);
      }).toThrow();
    });

    it('should deduplicate player types', () => {
      const role = new Role('participant', Person, Person, Company);

      expect(role.playerEntityTypes).toHaveLength(2);
    });
  });

  describe('multi', () => {
    it('should create multi-player role', () => {
      const role = Role.multi('participant', Person, Company);

      expect(role.playerEntityTypes).toHaveLength(2);
    });

    it('should throw if less than two types provided', () => {
      expect(() => {
        Role.multi('participant', Person);
      }).toThrow('Role.multi requires at least two player types');
    });
  });

  describe('validatePlayer', () => {
    it('should accept valid player instance', () => {
      const role = new Role('employee', Person);
      const person = new Person({ name: 'Alice' });

      expect(role.validatePlayer(person)).toBe(true);
    });

    it('should throw for invalid player type', () => {
      const role = new Role('employee', Person);
      const company = new Company({ name: 'TechCorp' });

      expect(() => role.validatePlayer(company)).toThrow(TypeError);
      expect(() => role.validatePlayer(company)).toThrow(
        /expects types \(Person\)/
      );
    });

    it('should accept any valid type for multi-type role', () => {
      const role = new Role('participant', Person, Company);
      const person = new Person({ name: 'Alice' });
      const company = new Company({ name: 'TechCorp' });

      expect(role.validatePlayer(person)).toBe(true);
      expect(role.validatePlayer(company)).toBe(true);
    });

    it('should throw for non-object values', () => {
      const role = new Role('employee', Person);

      expect(() => role.validatePlayer('string')).toThrow(TypeError);
      expect(() => role.validatePlayer(123)).toThrow(TypeError);
      expect(() => role.validatePlayer(null)).toThrow(TypeError);
    });
  });

  describe('attrName', () => {
    it('should be settable', () => {
      const role = new Role('employee', Person);

      expect(role.attrName).toBeUndefined();

      role.attrName = 'employee';
      expect(role.attrName).toBe('employee');
    });
  });
});
