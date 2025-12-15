/**
 * Unit tests for QueryBuilder.
 */

import { QueryBuilder } from '../../../src/query.js';
import { StringAttribute, IntegerAttribute } from '../../../src/attribute/index.js';
import { TypeFlags, AttributeFlags } from '../../../src/attribute/flags.js';
import { Entity } from '../../../src/models/entity.js';
import { Relation } from '../../../src/models/relation.js';
import { Role } from '../../../src/models/role.js';
import type { ModelAttrInfo } from '../../../src/models/utils.js';

// Define test attribute types
class Name extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'name' });
}

class Age extends IntegerAttribute {
  static override flags = new AttributeFlags({ name: 'age' });
}

class Position extends StringAttribute {
  static override flags = new AttributeFlags({ name: 'position' });
}

// Define test entity
class Person extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'person' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
    ['age', { typ: Age, flags: new AttributeFlags() }],
  ]);

  declare name: Name;
  declare age: Age | undefined;
}

class Company extends Entity {
  static override readonly _flags = new TypeFlags({ name: 'company' });
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['name', { typ: Name, flags: new AttributeFlags({ isKey: true }) }],
  ]);

  declare name: Name;
}

// Define test relation
class Employment extends Relation {
  static override readonly _flags = new TypeFlags({ name: 'employment' });
  static override readonly _roles: Map<string, Role> = new Map([
    ['employee', new Role('employee', Person)],
    ['employer', new Role('employer', Company)],
  ]);
  static override readonly _ownedAttrs: Map<string, ModelAttrInfo> = new Map([
    ['position', { typ: Position, flags: new AttributeFlags() }],
  ]);

  declare employee: Person;
  declare employer: Company;
  declare position: Position | undefined;
}

describe('QueryBuilder', () => {
  describe('matchEntity', () => {
    it('should create a basic match query for entity', () => {
      const query = QueryBuilder.matchEntity(Person);
      const result = query.build();
      expect(result).toBe('match\n$e isa person;');
    });

    it('should use custom variable name', () => {
      const query = QueryBuilder.matchEntity(Person, '$p');
      const result = query.build();
      expect(result).toBe('match\n$p isa person;');
    });

    it('should include attribute filters', () => {
      const query = QueryBuilder.matchEntity(Person, '$p', { name: 'Alice' });
      const result = query.build();
      expect(result).toBe('match\n$p isa person, has name "Alice";');
    });

    it('should include multiple attribute filters', () => {
      const query = QueryBuilder.matchEntity(Person, '$p', { name: 'Alice', age: 30 });
      const result = query.build();
      expect(result).toBe('match\n$p isa person, has name "Alice", has age 30;');
    });

    it('should ignore unknown fields in filters', () => {
      const query = QueryBuilder.matchEntity(Person, '$p', { name: 'Alice', unknown: 'value' });
      const result = query.build();
      expect(result).toBe('match\n$p isa person, has name "Alice";');
    });

    it('should handle Attribute instances in filters', () => {
      const query = QueryBuilder.matchEntity(Person, '$p', { name: new Name('Bob') });
      const result = query.build();
      expect(result).toBe('match\n$p isa person, has name "Bob";');
    });
  });

  describe('insertEntity', () => {
    it('should create insert query from entity instance', () => {
      const person = new Person({ name: 'Alice', age: 30 });
      const query = QueryBuilder.insertEntity(person);
      const result = query.build();
      expect(result).toBe('insert\n$e isa person, has name "Alice", has age 30;');
    });

    it('should use custom variable name', () => {
      const person = new Person({ name: 'Bob' });
      const query = QueryBuilder.insertEntity(person, '$p');
      const result = query.build();
      expect(result).toBe('insert\n$p isa person, has name "Bob";');
    });
  });

  describe('matchRelation', () => {
    it('should create a basic match query for relation', () => {
      const query = QueryBuilder.matchRelation(Employment);
      const result = query.build();
      expect(result).toBe('match\n$r isa employment;');
    });

    it('should use custom variable name', () => {
      const query = QueryBuilder.matchRelation(Employment, '$emp');
      const result = query.build();
      expect(result).toBe('match\n$emp isa employment;');
    });

    it('should include role players', () => {
      const query = QueryBuilder.matchRelation(Employment, '$r', {
        employee: '$p',
        employer: '$c',
      });
      const result = query.build();
      expect(result).toBe('match\n$r isa employment, (employee: $p), (employer: $c);');
    });
  });

  describe('deleteEntity', () => {
    it('should create delete query for entity', () => {
      const query = QueryBuilder.deleteEntity(Person);
      const result = query.build();
      expect(result).toBe('match\n$e isa person;\ndelete\n$e;');
    });

    it('should include filters in match clause', () => {
      const query = QueryBuilder.deleteEntity(Person, '$p', { name: 'Alice' });
      const result = query.build();
      expect(result).toBe('match\n$p isa person, has name "Alice";\ndelete\n$p;');
    });
  });

  describe('updateAttribute', () => {
    it('should create update query for string attribute', () => {
      const query = QueryBuilder.updateAttribute(Person, '$p', 'name', 'Alice', 'Bob');
      const result = query.build();
      expect(result).toBe(
        'match\n$p isa person, has name $old_name; $old_name = "Alice";\ndelete\n$p has $old_name;\ninsert\n$p has name "Bob";'
      );
    });

    it('should create update query for numeric attribute', () => {
      const query = QueryBuilder.updateAttribute(Person, '$p', 'age', 30, 31);
      const result = query.build();
      expect(result).toBe(
        'match\n$p isa person, has age $old_age; $old_age = 30;\ndelete\n$p has $old_age;\ninsert\n$p has age 31;'
      );
    });
  });

  describe('chainable queries', () => {
    it('should allow chaining fetch and modifiers', () => {
      const query = QueryBuilder.matchEntity(Person, '$p')
        .fetch('$p')
        .limit(10)
        .offset(5);
      const result = query.build();
      expect(result).toBe('match\n$p isa person;\noffset 5;\nlimit 10;\nfetch {\n  $p.*\n};');
    });

    it('should allow chaining sort, limit, and fetch', () => {
      const query = QueryBuilder.matchEntity(Person, '$p', { name: 'Alice' })
        .sort('$name')
        .limit(5)
        .fetch('$p');
      const result = query.build();
      expect(result).toBe(
        'match\n$p isa person, has name "Alice";\nsort $name asc;\nlimit 5;\nfetch {\n  $p.*\n};'
      );
    });
  });
});
