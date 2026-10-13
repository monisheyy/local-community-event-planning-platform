import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let adapter = null;

/** Connect to the configured database (Azure SQL or local SQLite) and ensure the schema exists. */
export async function initDb(overrides = {}) {
  if (adapter) return adapter;
  const driver = overrides.driver || config.db.driver;
  if (driver === 'mssql') {
    const { createMssqlAdapter } = await import('./adapters/mssql.js');
    adapter = await createMssqlAdapter(config.db.azure);
  } else {
    const { createSqliteAdapter } = await import('./adapters/sqlite.js');
    adapter = await createSqliteAdapter({ file: overrides.sqliteFile ?? config.db.sqliteFile });
  }
  await ensureSchema(adapter);
  return adapter;
}

export async function ensureSchema(db) {
  const file = db.dialect === 'mssql' ? 'schema.mssql.sql' : 'schema.sqlite.sql';
  await db.exec(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

export function getDb() {
  if (!adapter) throw new Error('Database not initialised - call initDb() first');
  return adapter;
}

export async function closeDb() {
  if (adapter) await adapter.close();
  adapter = null;
}
