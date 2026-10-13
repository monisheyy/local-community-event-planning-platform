/**
 * Production adapter for Azure SQL Database using the official `mssql` (tedious) driver.
 * All queries are parameterised (no string concatenation) to prevent SQL injection.
 */
import sql from 'mssql';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?Z$/;

function inputType(value) {
  if (value === null || value === undefined) return sql.NVarChar(sql.MAX);
  if (typeof value === 'number') return Number.isInteger(value) ? sql.Int : sql.Float;
  if (typeof value === 'boolean') return sql.Bit;
  if (value instanceof Date) return sql.DateTime2;
  if (typeof value === 'string' && ISO_DATE.test(value)) return sql.DateTime2;
  return sql.NVarChar(sql.MAX);
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

export async function createMssqlAdapter(azure) {
  const poolConfig = azure.connectionString
    ? azure.connectionString
    : {
        server: azure.server,
        database: azure.database,
        user: azure.user,
        password: azure.password,
        options: { encrypt: true, trustServerCertificate: false },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      };

  const pool = await new sql.ConnectionPool(poolConfig).connect();

  const request = (params = {}) => {
    const req = pool.request();
    for (const [name, raw] of Object.entries(params)) {
      const value = typeof raw === 'string' && ISO_DATE.test(raw) ? new Date(raw) : raw ?? null;
      req.input(name, inputType(raw), value);
    }
    return req;
  };

  return {
    dialect: 'mssql',

    async query(text, params) {
      const result = await request(params).query(text);
      return result.recordset.map(normalizeRow);
    },

    async execute(text, params) {
      const result = await request(params).query(text);
      return { rowsAffected: result.rowsAffected.reduce((a, b) => a + b, 0) };
    },

    async exec(script) {
      // Run a multi-statement script; batches are separated by "GO" lines (SSMS convention).
      for (const batch of script.split(/^\s*GO\s*$/im)) {
        if (batch.trim()) await pool.request().batch(batch);
      }
    },

    async tableExists(name) {
      const r = await request({ name }).query('SELECT 1 AS found FROM sys.tables WHERE name = @name');
      return r.recordset.length > 0;
    },

    paginate(text) {
      return `${text} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    },

    async close() {
      await pool.close();
    },
  };
}
