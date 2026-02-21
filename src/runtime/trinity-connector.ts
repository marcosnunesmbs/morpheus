import { DatabaseRecord, DatabaseType } from './memory/trinity-db.js';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
}

// ─── Permission enforcement ───────────────────────────────────────────────────

type DbOperation = 'read' | 'insert' | 'update' | 'delete' | 'ddl';

const SQL_OPERATION_LABELS: Record<DbOperation, string> = {
  read: 'SELECT (leitura)',
  insert: 'INSERT (inserção)',
  update: 'UPDATE (atualização)',
  delete: 'DELETE (exclusão)',
  ddl: 'DDL — CREATE / ALTER / DROP (alteração de schema)',
};

const MONGO_OPERATION_LABELS: Record<DbOperation, string> = {
  read: 'find / aggregate (leitura)',
  insert: 'insertOne / insertMany (inserção)',
  update: 'updateOne / updateMany (atualização)',
  delete: 'deleteOne / deleteMany (exclusão)',
  ddl: 'createCollection / dropCollection / createIndex (alteração de schema)',
};

function detectSqlOperation(query: string): DbOperation {
  const first = query.trimStart().match(/^\s*(\w+)/i)?.[1]?.toUpperCase() ?? '';
  switch (first) {
    case 'SELECT':
    case 'EXPLAIN':
    case 'SHOW':
    case 'DESCRIBE':
    case 'DESC':
      return 'read';
    case 'INSERT':
      return 'insert';
    case 'UPDATE':
      return 'update';
    case 'DELETE':
      return 'delete';
    case 'CREATE':
    case 'ALTER':
    case 'DROP':
    case 'TRUNCATE':
    case 'RENAME':
    case 'INDEX':
      return 'ddl';
    default:
      return 'read';
  }
}

function detectMongoOperation(operation: string): DbOperation {
  switch (operation) {
    case 'find':
    case 'aggregate':
    case 'countDocuments':
      return 'read';
    case 'insertOne':
    case 'insertMany':
      return 'insert';
    case 'updateOne':
    case 'updateMany':
    case 'replaceOne':
      return 'update';
    case 'deleteOne':
    case 'deleteMany':
      return 'delete';
    case 'createCollection':
    case 'dropCollection':
    case 'createIndex':
    case 'dropIndex':
      return 'ddl';
    default:
      return 'read';
  }
}

function assertPermission(db: DatabaseRecord, op: DbOperation, labels: Record<DbOperation, string>): void {
  const allowed: Record<DbOperation, boolean> = {
    read: db.allow_read,
    insert: db.allow_insert,
    update: db.allow_update,
    delete: db.allow_delete,
    ddl: db.allow_ddl,
  };
  if (!allowed[op]) {
    throw new Error(
      `Permissão negada: a operação "${labels[op]}" não está habilitada para o banco "${db.name}". ` +
      `Habilite esta permissão nas configurações do banco de dados.`
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultPort(type: DatabaseType): number {
  switch (type) {
    case 'postgresql': return 5432;
    case 'mysql': return 3306;
    case 'mongodb': return 27017;
    default: return 0;
  }
}

// ─── PostgreSQL ──────────────────────────────────────────────────────────────

async function pgTestConnection(db: DatabaseRecord): Promise<boolean> {
  const { Client } = await import('pg');
  const client = new Client(buildPgConfig(db));
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function pgIntrospect(db: DatabaseRecord): Promise<SchemaInfo> {
  const { Client } = await import('pg');
  const client = new Client(buildPgConfig(db));
  await client.connect();
  try {
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];
    for (const tableRow of tablesResult.rows) {
      const colsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableRow.table_name]);

      tables.push({
        name: tableRow.table_name,
        columns: colsResult.rows.map((c: any) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
        })),
      });
    }
    return { tables };
  } finally {
    await client.end().catch(() => {});
  }
}

async function pgExecuteQuery(db: DatabaseRecord, query: string, params?: any[]): Promise<QueryResult> {
  assertPermission(db, detectSqlOperation(query), SQL_OPERATION_LABELS);

  const { Client } = await import('pg');
  const client = new Client(buildPgConfig(db));
  await client.connect();
  try {
    const result = await client.query(query, params);
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  } finally {
    await client.end().catch(() => {});
  }
}

function buildPgConfig(db: DatabaseRecord) {
  if (db.connection_string) return { connectionString: db.connection_string };
  return {
    host: db.host || 'localhost',
    port: db.port || 5432,
    database: db.database_name || undefined,
    user: db.username || undefined,
    password: db.password || undefined,
  };
}

// ─── MySQL ───────────────────────────────────────────────────────────────────

async function mysqlTestConnection(db: DatabaseRecord): Promise<boolean> {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(buildMysqlConfig(db));
  try {
    await conn.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await conn.end().catch(() => {});
  }
}

async function mysqlIntrospect(db: DatabaseRecord): Promise<SchemaInfo> {
  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(buildMysqlConfig(db));
  try {
    const schema = db.database_name || 'information_schema';
    const [tableRows] = await conn.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema]) as any[];

    const tables: TableInfo[] = [];
    for (const tableRow of tableRows) {
      const tableName: string = tableRow.table_name ?? tableRow.TABLE_NAME ?? '';
      if (!tableName) continue;

      const [colRows] = await conn.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ?
        ORDER BY ordinal_position
      `, [schema, tableName]) as any[];

      tables.push({
        name: tableName,
        columns: (colRows as any[]).map((c) => ({
          name: c.column_name ?? c.COLUMN_NAME ?? '',
          type: c.data_type ?? c.DATA_TYPE ?? '',
          nullable: (c.is_nullable ?? c.IS_NULLABLE) === 'YES',
        })),
      });
    }
    return { tables };
  } finally {
    await conn.end().catch(() => {});
  }
}

async function mysqlExecuteQuery(db: DatabaseRecord, query: string, params?: any[]): Promise<QueryResult> {
  assertPermission(db, detectSqlOperation(query), SQL_OPERATION_LABELS);

  const mysql2 = await import('mysql2/promise');
  const conn = await mysql2.createConnection(buildMysqlConfig(db));
  try {
    const [rows] = await conn.query(query, params) as any[];
    const resultRows = Array.isArray(rows) ? rows : [rows];
    return { rows: resultRows, rowCount: resultRows.length };
  } finally {
    await conn.end().catch(() => {});
  }
}

function buildMysqlConfig(db: DatabaseRecord): any {
  if (db.connection_string) return db.connection_string;
  return {
    host: db.host || 'localhost',
    port: db.port || 3306,
    database: db.database_name || undefined,
    user: db.username || undefined,
    password: db.password || undefined,
  };
}

// ─── SQLite ──────────────────────────────────────────────────────────────────

async function sqliteTestConnection(db: DatabaseRecord): Promise<boolean> {
  const filePath = db.connection_string || db.database_name;
  if (!filePath) return false;
  try {
    const { default: Database } = await import('better-sqlite3');
    const sqliteDb = new Database(filePath, { readonly: true, fileMustExist: true });
    sqliteDb.close();
    return true;
  } catch {
    return false;
  }
}

async function sqliteIntrospect(db: DatabaseRecord): Promise<SchemaInfo> {
  const filePath = db.connection_string || db.database_name;
  if (!filePath) throw new Error('SQLite database file path not specified');

  const { default: Database } = await import('better-sqlite3');
  const sqliteDb = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const tableRows = sqliteDb
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];

    const tables: TableInfo[] = [];
    for (const tableRow of tableRows) {
      const colRows = sqliteDb.pragma(`table_info(${tableRow.name})`) as any[];
      tables.push({
        name: tableRow.name,
        columns: colRows.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.notnull === 0,
        })),
      });
    }
    return { tables };
  } finally {
    sqliteDb.close();
  }
}

async function sqliteExecuteQuery(db: DatabaseRecord, query: string): Promise<QueryResult> {
  const op = detectSqlOperation(query);
  assertPermission(db, op, SQL_OPERATION_LABELS);

  const filePath = db.connection_string || db.database_name;
  if (!filePath) throw new Error('SQLite database file path not specified');

  const { default: Database } = await import('better-sqlite3');
  // Open readonly only if no write permission is needed
  const readonly = op === 'read';
  const sqliteDb = new Database(filePath, { readonly, fileMustExist: true });
  try {
    const isSelect = op === 'read';
    if (isSelect) {
      const rows = sqliteDb.prepare(query).all() as Record<string, any>[];
      return { rows, rowCount: rows.length };
    } else {
      const info = sqliteDb.prepare(query).run();
      return { rows: [], rowCount: info.changes };
    }
  } finally {
    sqliteDb.close();
  }
}

// ─── MongoDB (Mongoose) ───────────────────────────────────────────────────────

async function mongoCreateConnection(uri: string, timeoutMs: number) {
  const { default: mongoose } = await import('mongoose');
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs,
  });
  await conn.asPromise();
  return conn;
}

function mongoGetDb(conn: any, databaseName?: string | null) {
  if (databaseName) return conn.useDb(databaseName, { useCache: true }).db;
  return conn.db as import('mongodb').Db;
}

async function mongoTestConnection(db: DatabaseRecord): Promise<boolean> {
  const uri = db.connection_string || buildMongoUri(db);
  let conn: any;
  try {
    conn = await mongoCreateConnection(uri, 5000);
    const rawDb = mongoGetDb(conn, db.database_name);
    await rawDb.command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await conn?.close().catch(() => {});
  }
}

async function mongoIntrospect(db: DatabaseRecord): Promise<SchemaInfo> {
  const uri = db.connection_string || buildMongoUri(db);
  const conn = await mongoCreateConnection(uri, 10000);
  try {
    const rawDb = mongoGetDb(conn, db.database_name);
    const collections = await rawDb.listCollections().toArray();

    const tables: TableInfo[] = [];
    for (const col of collections) {
      const docs = await rawDb.collection(col.name).find().limit(100).toArray();
      const fieldSet = new Set<string>();
      for (const doc of docs) {
        for (const key of Object.keys(doc)) fieldSet.add(key);
      }
      tables.push({
        name: col.name,
        columns: Array.from(fieldSet).map((f) => ({ name: f, type: 'mixed' })),
      });
    }
    return { tables };
  } finally {
    await conn.close().catch(() => {});
  }
}

async function mongoExecuteQuery(db: DatabaseRecord, query: string): Promise<QueryResult> {
  // Parse query first to know the operation before connecting
  let parsed: any;
  try {
    parsed = JSON.parse(query);
  } catch {
    throw new Error(
      'MongoDB queries must be JSON: { "collection": "name", "operation": "find|insertOne|updateOne|...", ... }'
    );
  }

  const { collection: colName, operation = 'find', filter = {}, pipeline, options = {}, document, documents, update, replacement, keys, indexName } = parsed;

  // Check permission before connecting
  const op = detectMongoOperation(operation);
  assertPermission(db, op, MONGO_OPERATION_LABELS);

  // createCollection / dropCollection / createIndex / dropIndex don't require collection
  if (!colName && !['createCollection', 'dropCollection', 'createIndex', 'dropIndex'].includes(operation)) {
    throw new Error('MongoDB query must include "collection" field');
  }

  const uri = db.connection_string || buildMongoUri(db);
  const conn = await mongoCreateConnection(uri, 10000);
  try {
    const rawDb = mongoGetDb(conn, db.database_name);
    const col = colName ? rawDb.collection(colName) : null;

    // ── Read operations ──────────────────────────────────────────────────────
    if (operation === 'aggregate') {
      const rows = await col!.aggregate(pipeline ?? []).toArray();
      return { rows: rows.map((r: any) => ({ ...r, _id: r._id?.toString() })), rowCount: rows.length };
    }

    if (operation === 'countDocuments') {
      const count = await col!.countDocuments(filter);
      return { rows: [{ count }], rowCount: 1 };
    }

    if (operation === 'find') {
      const limit = options.limit ?? 100;
      const rows = await col!.find(filter, { ...options, limit }).toArray();
      return {
        rows: rows.map((r: any) => ({ ...r, _id: r._id?.toString() })),
        rowCount: rows.length,
      };
    }

    // ── Insert operations ────────────────────────────────────────────────────
    if (operation === 'insertOne') {
      if (!document) throw new Error('"document" field required for insertOne');
      const result = await col!.insertOne(document);
      return { rows: [{ insertedId: result.insertedId?.toString(), acknowledged: result.acknowledged }], rowCount: 1 };
    }

    if (operation === 'insertMany') {
      if (!documents || !Array.isArray(documents)) throw new Error('"documents" array required for insertMany');
      const result = await col!.insertMany(documents);
      return { rows: [{ insertedCount: result.insertedCount, acknowledged: result.acknowledged }], rowCount: result.insertedCount };
    }

    // ── Update operations ────────────────────────────────────────────────────
    if (operation === 'updateOne') {
      if (!update) throw new Error('"update" field required for updateOne');
      const result = await col!.updateOne(filter, update, options);
      return { rows: [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }], rowCount: result.modifiedCount };
    }

    if (operation === 'updateMany') {
      if (!update) throw new Error('"update" field required for updateMany');
      const result = await col!.updateMany(filter, update, options);
      return { rows: [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }], rowCount: result.modifiedCount };
    }

    if (operation === 'replaceOne') {
      if (!replacement) throw new Error('"replacement" field required for replaceOne');
      const result = await col!.replaceOne(filter, replacement, options);
      return { rows: [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }], rowCount: result.modifiedCount };
    }

    // ── Delete operations ────────────────────────────────────────────────────
    if (operation === 'deleteOne') {
      const result = await col!.deleteOne(filter);
      return { rows: [{ deletedCount: result.deletedCount, acknowledged: result.acknowledged }], rowCount: result.deletedCount };
    }

    if (operation === 'deleteMany') {
      const result = await col!.deleteMany(filter);
      return { rows: [{ deletedCount: result.deletedCount, acknowledged: result.acknowledged }], rowCount: result.deletedCount };
    }

    // ── DDL operations ───────────────────────────────────────────────────────
    if (operation === 'createCollection') {
      if (!colName) throw new Error('"collection" field required for createCollection');
      await rawDb.createCollection(colName, options);
      return { rows: [{ created: colName }], rowCount: 1 };
    }

    if (operation === 'dropCollection') {
      if (!colName) throw new Error('"collection" field required for dropCollection');
      await rawDb.dropCollection(colName);
      return { rows: [{ dropped: colName }], rowCount: 1 };
    }

    if (operation === 'createIndex') {
      if (!keys) throw new Error('"keys" field required for createIndex');
      const indexName2 = await col!.createIndex(keys, options);
      return { rows: [{ indexName: indexName2 }], rowCount: 1 };
    }

    if (operation === 'dropIndex') {
      if (!indexName) throw new Error('"indexName" field required for dropIndex');
      await col!.dropIndex(indexName);
      return { rows: [{ dropped: indexName }], rowCount: 1 };
    }

    throw new Error(`Unknown MongoDB operation: "${operation}"`);
  } finally {
    await conn.close().catch(() => {});
  }
}

function buildMongoUri(db: DatabaseRecord): string {
  const user = db.username ? encodeURIComponent(db.username) : '';
  const pass = db.password ? encodeURIComponent(db.password) : '';
  const auth = user ? `${user}:${pass}@` : '';
  const host = db.host || 'localhost';
  const port = db.port || 27017;
  const dbName = db.database_name || 'test';
  return `mongodb://${auth}${host}:${port}/${dbName}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function testConnection(db: DatabaseRecord): Promise<boolean> {
  switch (db.type) {
    case 'postgresql': return pgTestConnection(db);
    case 'mysql': return mysqlTestConnection(db);
    case 'sqlite': return sqliteTestConnection(db);
    case 'mongodb': return mongoTestConnection(db);
    default: throw new Error(`Unsupported database type: ${db.type}`);
  }
}

export async function introspectSchema(db: DatabaseRecord): Promise<SchemaInfo> {
  switch (db.type) {
    case 'postgresql': return pgIntrospect(db);
    case 'mysql': return mysqlIntrospect(db);
    case 'sqlite': return sqliteIntrospect(db);
    case 'mongodb': return mongoIntrospect(db);
    default: throw new Error(`Unsupported database type: ${db.type}`);
  }
}

export async function executeQuery(
  db: DatabaseRecord,
  query: string,
  params?: any[],
): Promise<QueryResult> {
  switch (db.type) {
    case 'postgresql': return pgExecuteQuery(db, query, params);
    case 'mysql': return mysqlExecuteQuery(db, query, params);
    case 'sqlite': return sqliteExecuteQuery(db, query);
    case 'mongodb': return mongoExecuteQuery(db, query);
    default: throw new Error(`Unsupported database type: ${db.type}`);
  }
}
