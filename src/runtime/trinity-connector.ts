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

function buildConnectionString(db: DatabaseRecord): string {
  if (db.connection_string) return db.connection_string;

  const user = db.username || '';
  const pass = db.password ? `:${encodeURIComponent(db.password)}` : '';
  const host = db.host || 'localhost';
  const port = db.port || defaultPort(db.type);
  const dbName = db.database_name || '';

  switch (db.type) {
    case 'postgresql':
      return `postgresql://${user}${pass ? `${user ? '' : ''}${pass}` : ''}@${host}:${port}/${dbName}`;
    case 'mysql':
      return `mysql://${user}${pass}@${host}:${port}/${dbName}`;
    default:
      return '';
  }
}

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
      // MySQL returns information_schema columns in uppercase on some versions
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
  // mysql2 accepts a URI string directly (not wrapped in { uri: '...' })
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
  const filePath = db.connection_string || db.database_name;
  if (!filePath) throw new Error('SQLite database file path not specified');

  const { default: Database } = await import('better-sqlite3');
  const sqliteDb = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const isSelect = /^\s*SELECT/i.test(query);
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

// ─── MongoDB ─────────────────────────────────────────────────────────────────

async function mongoTestConnection(db: DatabaseRecord): Promise<boolean> {
  const { MongoClient } = await import('mongodb');
  const uri = db.connection_string || buildMongoUri(db);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

async function mongoIntrospect(db: DatabaseRecord): Promise<SchemaInfo> {
  const { MongoClient } = await import('mongodb');
  const uri = db.connection_string || buildMongoUri(db);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const dbName = db.database_name || 'test';
    const mongoDb = client.db(dbName);
    const collections = await mongoDb.listCollections().toArray();

    const tables: TableInfo[] = [];
    for (const col of collections) {
      // Sample up to 100 documents to infer field names
      const docs = await mongoDb.collection(col.name).find().limit(100).toArray();
      const fieldSet = new Set<string>();
      for (const doc of docs) {
        for (const key of Object.keys(doc)) {
          fieldSet.add(key);
        }
      }
      tables.push({
        name: col.name,
        columns: Array.from(fieldSet).map((f) => ({ name: f, type: 'mixed' })),
      });
    }
    return { tables };
  } finally {
    await client.close().catch(() => {});
  }
}

async function mongoExecuteQuery(db: DatabaseRecord, query: string): Promise<QueryResult> {
  const { MongoClient } = await import('mongodb');
  const uri = db.connection_string || buildMongoUri(db);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const dbName = db.database_name || 'test';
    const mongoDb = client.db(dbName);

    // Parse query as JSON-encoded MongoDB command
    // Expected format: { "collection": "name", "operation": "find", "filter": {}, "options": {} }
    let parsed: any;
    try {
      parsed = JSON.parse(query);
    } catch {
      throw new Error(
        'MongoDB queries must be JSON: { "collection": "name", "operation": "find|aggregate|countDocuments", "filter": {}, "options": {} }'
      );
    }

    const { collection: colName, operation = 'find', filter = {}, pipeline, options = {} } = parsed;
    if (!colName) throw new Error('MongoDB query must include "collection" field');

    const col = mongoDb.collection(colName);

    if (operation === 'aggregate') {
      const rows = await col.aggregate(pipeline ?? []).toArray();
      return { rows: rows.map((r) => ({ ...r, _id: r._id?.toString() })), rowCount: rows.length };
    }

    if (operation === 'countDocuments') {
      const count = await col.countDocuments(filter);
      return { rows: [{ count }], rowCount: 1 };
    }

    // Default: find
    const limit = options.limit ?? 100;
    const rows = await col.find(filter, { ...options, limit }).toArray();
    return {
      rows: rows.map((r) => ({ ...r, _id: r._id?.toString() })),
      rowCount: rows.length,
    };
  } finally {
    await client.close().catch(() => {});
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
