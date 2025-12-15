/**
 * Validation utilities for TypeBridge.
 *
 * This module provides validation functions to ensure type names, attribute names,
 * and role names don't conflict with TypeQL reserved words/keywords.
 */

import { isReservedWord } from './reserved-words.js';

/** Context types for validation */
export type ValidationContext = 'entity' | 'relation' | 'attribute' | 'role';

/**
 * Base class for validation errors in TypeBridge.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Raised when a type name conflicts with a TypeQL reserved word.
 *
 * This error is raised when attempting to use a TypeQL keyword as a:
 * - Entity type name
 * - Relation type name
 * - Attribute type name
 * - Role name
 */
export class ReservedWordError extends ValidationError {
  readonly word: string;
  readonly context: ValidationContext;
  readonly suggestion: string | undefined;

  constructor(
    word: string,
    context: ValidationContext,
    suggestion?: string
  ) {
    const message = ReservedWordError.buildMessage(word, context, suggestion);
    super(message);
    this.name = 'ReservedWordError';
    this.word = word;
    this.context = context;
    this.suggestion = suggestion;
  }

  private static buildMessage(
    word: string,
    context: ValidationContext,
    suggestion?: string
  ): string {
    const lines: string[] = [
      `Cannot use '${word}' as ${context} name: it's a TypeQL reserved word!`,
    ];

    if (suggestion) {
      lines.push(`Suggestion: Use '${suggestion}' instead`);
    } else {
      // Generate automatic suggestions
      const suggestions = ReservedWordError.generateSuggestions(word, context);
      if (suggestions.length > 0) {
        lines.push(`Suggestions: ${suggestions.join(', ')}`);
      }
    }

    lines.push('');
    lines.push('TypeQL reserved words include: define, match, entity, relation, attribute,');
    lines.push('insert, delete, update, has, owns, plays, boolean, integer, string, etc.');

    return lines.join('\n');
  }

  private static generateSuggestions(word: string, context: ValidationContext): string[] {
    const suggestions: string[] = [];

    // Add prefix/suffix based on context
    switch (context) {
      case 'entity':
        suggestions.push(`${word}_entity`, `my_${word}`);
        break;
      case 'relation':
        suggestions.push(`${word}_relation`, `${word}_rel`);
        break;
      case 'attribute':
        suggestions.push(`${word}_attr`, `${word}_value`);
        break;
      case 'role':
        suggestions.push(`${word}_role`, `as_${word}`);
        break;
    }

    // Add underscore if it makes sense
    const lowerWord = word.toLowerCase();
    if (['count', 'sum', 'max', 'min', 'mean'].includes(lowerWord)) {
      suggestions.push(`${word}_value`);
    }

    // For common conflicts, provide specific alternatives
    const specificAlternatives: Record<string, string[]> = {
      entity: ['object', 'item', 'record'],
      relation: ['relationship', 'connection', 'link'],
      attribute: ['property', 'field', 'trait'],
      string: ['text', 'str_value', 'text_value'],
      integer: ['int_value', 'number', 'num'],
      boolean: ['bool_value', 'flag', 'is_enabled'],
      double: ['float_value', 'decimal_value', 'num'],
      date: ['date_value', 'calendar_date', 'day'],
      datetime: ['timestamp', 'datetime_value', 'moment'],
      duration: ['time_span', 'interval', 'period'],
      count: ['total', 'quantity', 'amount'],
      sum: ['total', 'aggregate', 'amount'],
      max: ['maximum', 'highest', 'peak'],
      min: ['minimum', 'lowest', 'floor'],
      mean: ['average', 'avg'],
      first: ['initial', 'primary', 'earliest'],
      check: ['verify', 'validate', 'test'],
      value: ['data', 'content', 'val'],
      label: ['name', 'title', 'identifier'],
      from: ['source', 'origin', 'start'],
      as: ['alias', 'name'],
      has: ['contains', 'includes', 'holds'],
    };

    if (lowerWord in specificAlternatives) {
      suggestions.push(...specificAlternatives[lowerWord]!);
    }

    // Return unique suggestions, limited to 3
    return [...new Set(suggestions)].slice(0, 3);
  }
}

/**
 * Validate that a type name doesn't conflict with TypeQL reserved words.
 *
 * @param name - The type name to validate
 * @param context - What kind of name is being validated
 * @throws ReservedWordError - If the name is a TypeQL reserved word
 * @throws ValidationError - If the name is invalid for other reasons
 */
export function validateTypeName(name: string, context: ValidationContext): void {
  if (!name) {
    throw new ValidationError(`Empty ${context} name is not allowed`);
  }

  // Check for reserved words (case-insensitive to be safe)
  if (isReservedWord(name)) {
    throw new ReservedWordError(name, context);
  }

  // TypeQL identifiers must start with a letter and contain only letters, numbers,
  // underscores, and hyphens
  if (!/^[a-zA-Z]/.test(name)) {
    throw new ValidationError(
      `${context.charAt(0).toUpperCase() + context.slice(1)} name '${name}' must start with a letter`
    );
  }

  // Check for invalid characters
  for (const char of name) {
    if (!/[a-zA-Z0-9_-]/.test(char)) {
      throw new ValidationError(
        `${context.charAt(0).toUpperCase() + context.slice(1)} name '${name}' contains invalid character '${char}'. ` +
          `Only letters, numbers, underscores, and hyphens are allowed.`
      );
    }
  }
}
