/** Create (or with --reset, recreate) the database schema. Usage: npm run db:init [-- --reset] */
import fs from 'node:fs';
import { config } from '../config.js';
import { initDb, closeDb, getDb, ensureSchema } from './index.js';

const reset = process.argv.includes('--reset');

if (reset && config.db.driver === 'sqlite' && fs.existsSync(config.db.sqliteFile)) {
  fs.rmSync(config.db.sqliteFile);
  console.log('[db] removed', config.db.sqliteFile);
}

await initDb();
if (reset && config.db.driver === 'mssql') {
  const db = getDb();
  for (const t of ['notifications', 'comments', 'registrations', 'events', 'users']) {
    await db.exec(`IF OBJECT_ID('dbo.${t}', 'U') IS NOT NULL DROP TABLE dbo.${t};`);
  }
  await ensureSchema(db);
}
console.log(`[db] schema ready (${config.db.driver})`);
await closeDb();
