/**
 * Local development / test adapter backed by sql.js (SQLite compiled to WebAssembly).
 * No native compilation is needed, so it runs on any machine with Node.js.
 * The database is kept in memory and flushed to disk after every write.
 */
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

export async function createSqliteAdapter({ file }) {
  const SQL = await initSqlJs();
  const inMemory = !file || file === ':memory:';
  const db = !inMemory && fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');

  let flushTimer = null;
  const persist = () => {
    if (inMemory) return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(db.export()));
    }, 25);
  };

  // sql.js expects named parameters with their prefix, e.g. { '@id': 1 }
  const bind = (params = {}) =>
    Object.fromEntries(Object.entries(params).map(([k, v]) => [`@${k}`, v === undefined ? null : v]));

  return {
    dialect: 'sqlite',

    async query(sql, params) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(bind(params));
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },

    async execute(sql, params) {
      db.run(sql, bind(params));
      const rowsAffected = db.getRowsModified();
      persist();
      return { rowsAffected };
    },

    async exec(script) {
      db.exec(script);
      persist();
    },

    async tableExists(name) {
      const rows = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name.replace(/'/g, "''")}'`);
      return rows.length > 0;
    },

    paginate(sql) {
      return `${sql} LIMIT @limit OFFSET @offset`;
    },

    async close() {
      clearTimeout(flushTimer);
      if (!inMemory) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(db.export()));
      }
      db.close();
    },
  };
}
