/**
 * Tests for Relation class
 */

import {
  Relation,
  Entity,
  Role,
  TypeFlags,
  AttributeFlags,
  StringAttribute,
  IntegerAttribute,
} from '../../../src/index.js';
import type { ModelAttrInfo } from '../../../src/models/utils.js';

// Define test attributes
class Name extends StringAttribute {}
class Position extends StringAttribute {}
class Salary extends IntegerAttribute {}

// Define test entities
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

// Define test relation
// Note: Use 'declare' instead of '!' to avoid field initializer overwriting constructor values
class Employment extends Relation {
  static override readonly _flags = new TypeFlags({ name: 'employment' });
  static override readonly _roles = new Map([
    ['employee', new Role('employee', Person)],
    ['employer', new Role('employer', Company)],
  ]);
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['position', { typ: Position, flags: new AttributeFlags() }],
    ['salary', { typ: Salary, flags: new AttributeFlags({ cardMin: 0, cardMax: 1 }) }],
  ]);

  declare employee: Person;
  declare employer: Company;
  declare position: Position;
  declare salary: Salary | undefined;
}

// Abstract relation
class AbstractRelation extends Relation {
  static override readonly _flags = new TypeFlags({ name: 'abstract_relation', abstract: true });
  static override readonly _roles = new Map();
  static override readonly _ownedAttrs = new Map();
}

describe('Relation', () => {
  describe('constructor', () => {
    it('should create relation with roles and attributes', () => {
      const person = new Person({ name: 'Alice' });
      const company = new Company({ name: 'TechCorp' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: new Position('Engineer'),
        salary: new Salary(100000),
      });

      expect(employment.employee).toBe(person);
      expect(employment.employer).toBe(company);
      expect(employment.position).toBeInstanceOf(Position);
      expect(employment.position.value).toBe('Engineer');
      expect(employment.salary?.value).toBe(100000);
    });

    it('should auto-wrap raw attribute values', () => {
      const person = new Person({ name: 'Bob' });
      const company = new Company({ name: 'Startup' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: 'Developer',
      });

      expect(employment.position).toBeInstanceOf(Position);
      expect(employment.position.value).toBe('Developer');
    });

    it('should validate role player types', () => {
      const person = new Person({ name: 'Alice' });

      expect(() => {
        new Employment({
          employee: person,
          employer: person, // Wrong type - should be Company
          position: 'Engineer',
        });
      }).toThrow(TypeError);
    });
  });

  describe('static methods', () => {
    it('getTypeName() should return configured type name', () => {
      expect(Employment.getTypeName()).toBe('employment');
    });

    it('getSupertype() should return undefined for base relation', () => {
      expect(Employment.getSupertype()).toBeUndefined();
    });

    it('isAbstract() should return abstract flag', () => {
      expect(Employment.isAbstract()).toBe(false);
      expect(AbstractRelation.isAbstract()).toBe(true);
    });

    it('getRoles() should return all roles', () => {
      const roles = Employment.getRoles();
      expect(roles.size).toBe(2);
      expect(roles.has('employee')).toBe(true);
      expect(roles.has('employer')).toBe(true);
    });

    it('getOwnedAttributes() should return owned attributes', () => {
      const attrs = Employment.getOwnedAttributes();
      expect(attrs.size).toBe(2);
      expect(attrs.has('position')).toBe(true);
      expect(attrs.has('salary')).toBe(true);
    });
  });

  describe('toSchemaDefinition', () => {
    it('should generate schema with roles and attributes', () => {
      const schema = Employment.toSchemaDefinition();

      expect(schema).toContain('relation employment');
      expect(schema).toContain('relates employee');
      expect(schema).toContain('relates employer');
      expect(schema).toContain('owns Position');
      expect(schema).toContain('owns Salary');
      expect(schema).toMatch(/;$/);
    });

    it('should include @abstract for abstract relations', () => {
      const schema = AbstractRelation.toSchemaDefinition();
      expect(schema).toContain('relation abstract_relation @abstract');
    });
  });

  describe('toInsertQuery', () => {
    it('should generate insert query with role players and attributes', () => {
      const person = new Person({ name: 'Alice' });
      const company = new Company({ name: 'TechCorp' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: new Position('Engineer'),
        salary: new Salary(100000),
      });

      const query = employment.toInsertQuery('$e');

      expect(query).toContain('$e (employee: $employee, employer: $employer) isa employment');
      expect(query).toContain('has Position "Engineer"');
      expect(query).toContain('has Salary 100000');
    });

    it('should skip undefined attributes', () => {
      const person = new Person({ name: 'Bob' });
      const company = new Company({ name: 'Startup' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: new Position('Developer'),
      });

      const query = employment.toInsertQuery('$e');

      expect(query).toContain('has Position "Developer"');
      expect(query).not.toContain('Salary');
    });
  });

  describe('toDict', () => {
    it('should convert relation to plain object', () => {
      const person = new Person({ name: 'Alice' });
      const company = new Company({ name: 'TechCorp' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: new Position('Engineer'),
        salary: new Salary(100000),
      });

      const dict = employment.toDict();

      expect(dict.position).toBe('Engineer');
      expect(dict.salary).toBe(100000);
      // Role players are also included
      expect(dict.employee).toBeDefined();
      expect(dict.employer).toBeDefined();
    });
  });

  describe('toString', () => {
    it('should return readable string representation', () => {
      const person = new Person({ name: 'Alice' });
      const company = new Company({ name: 'TechCorp' });

      const employment = new Employment({
        employee: person,
        employer: company,
        position: new Position('Engineer'),
      });

      const str = employment.toString();

      expect(str).toContain('employment');
      expect(str).toContain('position=Engineer');
    });
  });
});
