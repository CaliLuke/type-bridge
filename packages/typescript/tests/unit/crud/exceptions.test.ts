/**
 * Unit tests for CRUD exceptions.
 */

import {
  CrudError,
  EntityNotFoundError,
  RelationNotFoundError,
  NotUniqueError,
  KeyAttributeError,
  InvalidFilterError,
} from '../../../src/crud/exceptions.js';

describe('CrudError', () => {
  it('should create error with message', () => {
    const error = new CrudError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('CrudError');
  });

  it('should be an instance of Error', () => {
    const error = new CrudError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('EntityNotFoundError', () => {
  it('should create error with entity type and operation', () => {
    const error = new EntityNotFoundError('Person', 'delete');
    expect(error.message).toBe('Person not found for delete');
    expect(error.entityType).toBe('Person');
    expect(error.operation).toBe('delete');
    expect(error.name).toBe('EntityNotFoundError');
  });

  it('should include details when provided', () => {
    const error = new EntityNotFoundError('Person', 'update', 'id=123');
    expect(error.message).toBe('Person not found for update: id=123');
    expect(error.details).toBe('id=123');
  });

  it('should be an instance of CrudError', () => {
    const error = new EntityNotFoundError('Person', 'delete');
    expect(error).toBeInstanceOf(CrudError);
  });
});

describe('RelationNotFoundError', () => {
  it('should create error with relation type and operation', () => {
    const error = new RelationNotFoundError('Employment', 'delete');
    expect(error.message).toBe('Employment not found for delete');
    expect(error.relationType).toBe('Employment');
    expect(error.operation).toBe('delete');
    expect(error.name).toBe('RelationNotFoundError');
  });

  it('should include details when provided', () => {
    const error = new RelationNotFoundError('Employment', 'update', 'employee=Alice');
    expect(error.message).toBe('Employment not found for update: employee=Alice');
    expect(error.details).toBe('employee=Alice');
  });
});

describe('NotUniqueError', () => {
  it('should create error with count', () => {
    const error = new NotUniqueError('Person', 'delete', 3);
    expect(error.message).toContain('found 3 matches');
    expect(error.entityType).toBe('Person');
    expect(error.operation).toBe('delete');
    expect(error.matchCount).toBe(3);
    expect(error.name).toBe('NotUniqueError');
  });
});

describe('KeyAttributeError', () => {
  it('should create error with field name', () => {
    const error = new KeyAttributeError('Person', 'update', 'id');
    expect(error.message).toContain("key attribute 'id'");
    expect(error.message).toContain('Person');
    expect(error.entityType).toBe('Person');
    expect(error.operation).toBe('update');
    expect(error.fieldName).toBe('id');
    expect(error.name).toBe('KeyAttributeError');
  });

  it('should include available fields when provided', () => {
    const error = new KeyAttributeError('Person', 'update', 'id', ['id', 'name']);
    expect(error.message).toContain('Available key fields: id, name');
    expect(error.availableFields).toEqual(['id', 'name']);
  });
});

describe('InvalidFilterError', () => {
  it('should create error with field name', () => {
    const error = new InvalidFilterError('Person', 'unknown_field');
    expect(error.message).toContain("does not own attribute type 'unknown_field'");
    expect(error.entityType).toBe('Person');
    expect(error.fieldName).toBe('unknown_field');
    expect(error.name).toBe('InvalidFilterError');
  });

  it('should include available fields when provided', () => {
    const error = new InvalidFilterError('Person', 'unknown', ['name', 'age']);
    expect(error.message).toContain('Available attribute types: name, age');
    expect(error.availableFields).toEqual(['name', 'age']);
  });
});
