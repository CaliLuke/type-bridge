/**
 * Tests for Entity class
 */

import {
  Entity,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
} from '../../../src/index.js';
import type { ModelAttrInfo } from '../../../src/models/utils.js';

// Define test attribute types
class Name extends StringAttribute {}
class Age extends IntegerAttribute {}
class Email extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'email_address' });
}

// Define test entity class
// Note: Use 'declare' instead of '!' to avoid field initializer overwriting constructor values
class Person extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'person' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true, cardMin: 1, cardMax: 1 }) }],
    ['age', { typ: Age, flags: new AttributeFlags({ cardMin: 0, cardMax: 1 }) }],
    ['email', { typ: Email, flags: new AttributeFlags() }],
  ]);

  declare name: Name;
  declare age: Age | undefined;
  declare email: Email | undefined;
}

// Define abstract entity
class AbstractPerson extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'abstract_person', abstract: true });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
  ]);

  declare name: Name;
}

// Define child entity
class Employee extends Person {
  static override readonly _flags = new TypeFlags({ name: 'employee' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map();
}

describe('Entity', () => {
  describe('constructor', () => {
    it('should create entity with attribute instances', () => {
      const person = new Person({
        name: new Name('Alice'),
        age: new Age(30),
      });

      expect(person.name).toBeInstanceOf(Name);
      expect(person.name.value).toBe('Alice');
      expect(person.age).toBeInstanceOf(Age);
      expect(person.age?.value).toBe(30);
    });

    it('should auto-wrap raw values in Attribute instances', () => {
      const person = new Person({
        name: 'Bob',
        age: 25,
      });

      expect(person.name).toBeInstanceOf(Name);
      expect(person.name.value).toBe('Bob');
      expect(person.age).toBeInstanceOf(Age);
      expect(person.age?.value).toBe(25);
    });

    it('should handle undefined optional values', () => {
      const person = new Person({
        name: new Name('Charlie'),
      });

      expect(person.name.value).toBe('Charlie');
      expect(person.age).toBeUndefined();
    });
  });

  describe('static methods', () => {
    it('getTypeName() should return configured type name', () => {
      expect(Person.getTypeName()).toBe('person');
    });

    it('getSupertype() should return parent type name', () => {
      expect(Person.getSupertype()).toBeUndefined();
      expect(Employee.getSupertype()).toBe('person');
    });

    it('isAbstract() should return abstract flag', () => {
      expect(Person.isAbstract()).toBe(false);
      expect(AbstractPerson.isAbstract()).toBe(true);
    });

    it('getOwnedAttributes() should return owned attributes', () => {
      const attrs = Person.getOwnedAttributes();
      expect(attrs.size).toBe(3);
      expect(attrs.has('name')).toBe(true);
      expect(attrs.has('age')).toBe(true);
      expect(attrs.has('email')).toBe(true);
    });

    it('getAllAttributes() should include inherited attributes', () => {
      const employeeAttrs = Employee.getAllAttributes();
      // Should inherit from Person
      expect(employeeAttrs.has('name')).toBe(true);
      expect(employeeAttrs.has('age')).toBe(true);
    });
  });

  describe('toSchemaDefinition', () => {
    it('should generate schema for regular entity', () => {
      const schema = Person.toSchemaDefinition();
      expect(schema).toContain('entity person');
      expect(schema).toContain('owns Name @key');
      expect(schema).toContain('owns Age');
      expect(schema).toContain('owns email_address');
      expect(schema).toMatch(/;$/);
    });

    it('should generate schema for abstract entity', () => {
      const schema = AbstractPerson.toSchemaDefinition();
      expect(schema).toContain('entity abstract_person @abstract');
    });

    it('should include supertype in schema', () => {
      const schema = Employee.toSchemaDefinition();
      expect(schema).toContain('entity employee');
      expect(schema).toContain('sub person');
    });
  });

  describe('toInsertQuery', () => {
    it('should generate insert query with all attributes', () => {
      const person = new Person({
        name: new Name('Alice'),
        age: new Age(30),
        email: new Email('alice@example.com'),
      });

      const query = person.toInsertQuery('$p');
      expect(query).toContain('$p isa person');
      expect(query).toContain('has Name "Alice"');
      expect(query).toContain('has Age 30');
      expect(query).toContain('has email_address "alice@example.com"');
    });

    it('should skip undefined attributes', () => {
      const person = new Person({
        name: new Name('Bob'),
      });

      const query = person.toInsertQuery('$p');
      expect(query).toContain('has Name "Bob"');
      expect(query).not.toContain('Age');
    });
  });

  describe('toDict', () => {
    it('should convert entity to plain object', () => {
      const person = new Person({
        name: new Name('Alice'),
        age: new Age(30),
      });

      const dict = person.toDict();
      expect(dict.name).toBe('Alice');
      expect(dict.age).toBe(30);
    });

    it('should use aliases when byAlias is true', () => {
      const person = new Person({
        name: new Name('Alice'),
        email: new Email('alice@example.com'),
      });

      const dict = person.toDict({ byAlias: true });
      expect(dict['email_address']).toBe('alice@example.com');
    });
  });

  describe('fromDict', () => {
    it('should create entity from plain object', () => {
      const person = Person.fromDict({
        name: 'Alice',
        age: 30,
      });

      expect(person).toBeInstanceOf(Person);
      expect(person.name.value).toBe('Alice');
      expect(person.age?.value).toBe(30);
    });

    it('should throw for unknown fields in strict mode', () => {
      expect(() => {
        Person.fromDict({ name: 'Alice', unknown: 'value' });
      }).toThrow("Unknown field 'unknown'");
    });

    it('should ignore unknown fields when not strict', () => {
      const person = Person.fromDict(
        { name: 'Alice', unknown: 'value' },
        { strict: false }
      );
      expect(person.name.value).toBe('Alice');
    });
  });

  describe('toString', () => {
    it('should return readable string representation', () => {
      const person = new Person({
        name: new Name('Alice'),
        age: new Age(30),
      });

      const str = person.toString();
      expect(str).toContain('person');
      expect(str).toContain('name=Alice');
      expect(str).toContain('age=30');
    });
  });
});
