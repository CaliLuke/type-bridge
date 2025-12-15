/**
 * Database connection and session management for TypeDB.
 */

import {
  TypeDBHttpDriver,
  type TransactionType,
  type TransactionOptions,
  type QueryOptions,
  type ApiResponse,
  type QueryResponse,
  type ConceptRowsQueryResponse,
  type ConceptDocumentsQueryResponse,
  type ConceptRow,
  type ConceptDocument,
} from 'typedb-driver-http';

/**
 * Error thrown when a TypeDB operation fails.
 */
export class TypeDBError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'TypeDBError';
  }
}

/**
 * Configuration options for Database connection.
 */
export interface DatabaseConfig {
  /** TypeDB server address(es) */
  address: string | string[];
  /** Database name */
  database: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
}

/**
 * Check if response is an error response.
 */
function isErrorResponse(response: unknown): response is { err: { code: string; message: string }; status: number } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'err' in response
  );
}

/**
 * Unwrap API response, throwing on error.
 */
function unwrapResponse<T>(response: ApiResponse<T>, operation: string): T {
  if (isErrorResponse(response)) {
    throw new TypeDBError(
      `${operation} failed: ${response.err.message}`,
      response.err.code
    );
  }
  // Type assertion is safe here because we've already checked for errors
  return (response as { ok: T }).ok;
}

/**
 * Main database connection and session manager.
 *
 * @example
 * ```typescript
 * const db = new Database({
 *   address: 'http://localhost:8080',
 *   database: 'mydb',
 *   username: 'admin',
 *   password: 'password',
 * });
 *
 * // Execute a query
 * const results = await db.executeQuery('match $p isa person; fetch { $p.* };');
 *
 * // Use transaction context
 * await db.withTransaction('write', async (tx) => {
 *   await tx.execute('insert $p isa person, has name "Alice";');
 * });
 * ```
 */
export class Database {
  /** TypeDB server addresses */
  readonly addresses: string[];

  /** Database name */
  readonly databaseName: string;

  /** Username for authentication */
  readonly username: string;

  /** Password for authentication */
  readonly password: string;

  /** Internal HTTP driver */
  private _driver: TypeDBHttpDriver | null = null;

  /**
   * Create a new Database connection.
   *
   * @param config - Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.addresses = Array.isArray(config.address)
      ? config.address
      : [config.address];
    this.databaseName = config.database;
    this.username = config.username ?? 'admin';
    this.password = config.password ?? 'password';
  }

  /**
   * Get the HTTP driver instance, creating it if necessary.
   */
  get driver(): TypeDBHttpDriver {
    if (!this._driver) {
      this._driver = new TypeDBHttpDriver({
        addresses: this.addresses,
        username: this.username,
        password: this.password,
      });
    }
    return this._driver;
  }

  /**
   * Check if database exists.
   */
  async databaseExists(): Promise<boolean> {
    const response = await this.driver.getDatabase(this.databaseName);
    if (isErrorResponse(response)) {
      // 404 means database doesn't exist
      if (response.status === 404) {
        return false;
      }
      throw new TypeDBError(
        `Failed to check database: ${response.err.message}`,
        response.err.code
      );
    }
    return true;
  }

  /**
   * Create the database if it doesn't exist.
   */
  async createDatabase(): Promise<void> {
    const exists = await this.databaseExists();
    if (!exists) {
      const response = await this.driver.createDatabase(this.databaseName);
      unwrapResponse(response, 'Create database');
    }
  }

  /**
   * Delete the database.
   */
  async deleteDatabase(): Promise<void> {
    const exists = await this.databaseExists();
    if (exists) {
      const response = await this.driver.deleteDatabase(this.databaseName);
      unwrapResponse(response, 'Delete database');
    }
  }

  /**
   * Get the schema definition for this database.
   */
  async getSchema(): Promise<string> {
    const response = await this.driver.getDatabaseSchema(this.databaseName);
    return unwrapResponse(response, 'Get schema');
  }

  /**
   * Get the type schema definition for this database.
   */
  async getTypeSchema(): Promise<string> {
    const response = await this.driver.getDatabaseTypeSchema(this.databaseName);
    return unwrapResponse(response, 'Get type schema');
  }

  /**
   * Create a transaction context.
   *
   * @param type - Transaction type ("read", "write", or "schema")
   * @param options - Optional transaction options
   * @returns TransactionContext for use with async/await
   */
  transaction(
    type: TransactionType = 'read',
    options?: TransactionOptions
  ): TransactionContext {
    return new TransactionContext(this, type, options);
  }

  /**
   * Execute a callback within a transaction.
   *
   * The transaction is automatically committed on success or rolled back on error.
   *
   * @param type - Transaction type
   * @param callback - Function to execute within the transaction
   * @param options - Optional transaction options
   * @returns Result of the callback
   */
  async withTransaction<T>(
    type: TransactionType,
    callback: (tx: TransactionContext) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const tx = this.transaction(type, options);
    await tx.open();

    try {
      const result = await callback(tx);

      // Auto-commit write/schema transactions
      if (type !== 'read') {
        await tx.commit();
      }

      return result;
    } catch (error) {
      // Rollback on error for write/schema transactions
      if (type !== 'read') {
        try {
          await tx.rollback();
        } catch {
          // Ignore rollback errors
        }
      }
      throw error;
    } finally {
      await tx.close();
    }
  }

  /**
   * Execute a one-shot query.
   *
   * For write/schema queries, the transaction is automatically committed.
   *
   * @param query - TypeQL query string
   * @param type - Transaction type (default: "read")
   * @param options - Optional query and transaction options
   * @returns Query results
   */
  async executeQuery(
    query: string,
    type: TransactionType = 'read',
    options?: {
      transactionOptions?: TransactionOptions;
      queryOptions?: QueryOptions;
    }
  ): Promise<QueryResult> {
    const commit = type !== 'read';
    const response = await this.driver.oneShotQuery(
      query,
      commit,
      this.databaseName,
      type,
      options?.transactionOptions,
      options?.queryOptions
    );

    const result = unwrapResponse(response, 'Execute query');
    return parseQueryResponse(result);
  }
}

/**
 * Parsed query result.
 */
export interface QueryResult {
  /** Type of answer returned */
  answerType: 'ok' | 'conceptRows' | 'conceptDocuments';
  /** Type of query executed */
  queryType: 'read' | 'write' | 'schema';
  /** Rows for conceptRows answers */
  rows: ConceptRow[];
  /** Documents for conceptDocuments answers */
  documents: ConceptDocument[];
  /** Optional comment from TypeDB */
  comment: string | null;
}

/**
 * Parse a QueryResponse into a more usable format.
 */
function parseQueryResponse(response: QueryResponse): QueryResult {
  const base: QueryResult = {
    answerType: response.answerType,
    queryType: response.queryType,
    rows: [],
    documents: [],
    comment: response.comment,
  };

  if (response.answerType === 'conceptRows') {
    const rowResponse = response as ConceptRowsQueryResponse;
    base.rows = rowResponse.answers.map((answer) => answer.data);
  } else if (response.answerType === 'conceptDocuments') {
    const docResponse = response as ConceptDocumentsQueryResponse;
    base.documents = docResponse.answers;
  }

  return base;
}

/**
 * Transaction wrapper for TypeDB HTTP transactions.
 */
export class Transaction {
  private _transactionId: string | null = null;

  constructor(
    private readonly driver: TypeDBHttpDriver,
    private readonly databaseName: string,
    private readonly type: TransactionType,
    private readonly options?: TransactionOptions
  ) {}

  /**
   * Get the transaction ID.
   */
  get transactionId(): string {
    if (!this._transactionId) {
      throw new TypeDBError('Transaction not opened');
    }
    return this._transactionId;
  }

  /**
   * Check if the transaction is open.
   */
  get isOpen(): boolean {
    return this._transactionId !== null;
  }

  /**
   * Open the transaction.
   */
  async open(): Promise<void> {
    if (this._transactionId) {
      throw new TypeDBError('Transaction already opened');
    }

    const response = await this.driver.openTransaction(
      this.databaseName,
      this.type,
      this.options
    );
    const result = unwrapResponse(response, 'Open transaction');
    this._transactionId = result.transactionId;
  }

  /**
   * Execute a query within this transaction.
   *
   * @param query - TypeQL query string
   * @param options - Optional query options
   * @returns Query results
   */
  async execute(
    query: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    const response = await this.driver.query(
      this.transactionId,
      query,
      options
    );
    const result = unwrapResponse(response, 'Execute query');
    return parseQueryResponse(result);
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    if (!this._transactionId) {
      throw new TypeDBError('Transaction not opened');
    }

    const response = await this.driver.commitTransaction(this._transactionId);
    unwrapResponse(response, 'Commit transaction');
    this._transactionId = null;
  }

  /**
   * Rollback the transaction.
   */
  async rollback(): Promise<void> {
    if (!this._transactionId) {
      throw new TypeDBError('Transaction not opened');
    }

    const response = await this.driver.rollbackTransaction(this._transactionId);
    unwrapResponse(response, 'Rollback transaction');
    this._transactionId = null;
  }

  /**
   * Close the transaction.
   */
  async close(): Promise<void> {
    if (this._transactionId) {
      const response = await this.driver.closeTransaction(this._transactionId);
      // Ignore errors on close - transaction might already be closed
      if (!isErrorResponse(response)) {
        this._transactionId = null;
      }
    }
  }
}

/**
 * Transaction context for managing transactions.
 *
 * Provides a high-level interface for working with transactions,
 * including automatic commit/rollback handling.
 */
export class TransactionContext {
  private _transaction: Transaction | null = null;

  constructor(
    public readonly database: Database,
    public readonly type: TransactionType,
    private readonly options?: TransactionOptions
  ) {}

  /**
   * Get the underlying transaction.
   */
  get transaction(): Transaction {
    if (!this._transaction) {
      throw new TypeDBError('TransactionContext not opened');
    }
    return this._transaction;
  }

  /**
   * Check if the transaction is open.
   */
  get isOpen(): boolean {
    return this._transaction?.isOpen ?? false;
  }

  /**
   * Open the transaction.
   */
  async open(): Promise<void> {
    if (this._transaction) {
      throw new TypeDBError('TransactionContext already opened');
    }

    this._transaction = new Transaction(
      this.database.driver,
      this.database.databaseName,
      this.type,
      this.options
    );
    await this._transaction.open();
  }

  /**
   * Execute a query within this transaction.
   *
   * @param query - TypeQL query string
   * @param options - Optional query options
   * @returns Query results
   */
  async execute(
    query: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    return this.transaction.execute(query, options);
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    return this.transaction.commit();
  }

  /**
   * Rollback the transaction.
   */
  async rollback(): Promise<void> {
    return this.transaction.rollback();
  }

  /**
   * Close the transaction.
   */
  async close(): Promise<void> {
    if (this._transaction) {
      await this._transaction.close();
      this._transaction = null;
    }
  }
}

/**
 * Connection type that can be used for queries.
 * Can be a Database, Transaction, or TransactionContext.
 */
export type Connection = Database | Transaction | TransactionContext;

/**
 * Helper to execute a query on any connection type.
 *
 * @param connection - Database, Transaction, or TransactionContext
 * @param query - TypeQL query string
 * @param type - Transaction type (only used for Database connections)
 * @returns Query results
 */
export async function executeQuery(
  connection: Connection,
  query: string,
  type: TransactionType = 'read'
): Promise<QueryResult> {
  if (connection instanceof Database) {
    return connection.executeQuery(query, type);
  } else if (connection instanceof Transaction) {
    return connection.execute(query);
  } else {
    return connection.execute(query);
  }
}
