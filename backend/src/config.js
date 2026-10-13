import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(name, fallback) {
  const value = env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Database selection:
 *  - If AZURE_SQL_CONNECTION_STRING (or AZURE_SQL_SERVER) is set -> Azure SQL Database (mssql driver)
 *  - Otherwise -> local SQLite file (sql.js, no native build required) for development and tests
 */
const useAzureSql = Boolean(env.AZURE_SQL_CONNECTION_STRING || env.AZURE_SQL_SERVER);

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT || 4000),
  corsOrigin: (env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),

  jwt: {
    secret: isProd ? required('JWT_SECRET') : env.JWT_SECRET || 'dev-only-secret-change-me',
    expiresIn: env.JWT_EXPIRES_IN || '7d',
  },

  db: {
    driver: useAzureSql ? 'mssql' : 'sqlite',
    sqliteFile: env.SQLITE_FILE || path.join(ROOT_DIR, 'data', 'community-events.db'),
    azure: {
      connectionString: env.AZURE_SQL_CONNECTION_STRING,
      server: env.AZURE_SQL_SERVER,
      database: env.AZURE_SQL_DATABASE,
      user: env.AZURE_SQL_USER,
      password: env.AZURE_SQL_PASSWORD,
    },
  },

  storage: {
    driver: env.AZURE_STORAGE_CONNECTION_STRING ? 'azure-blob' : 'local',
    connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
    container: env.AZURE_STORAGE_CONTAINER || 'event-images',
    localDir: env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
    maxBytes: 5 * 1024 * 1024,
  },

  appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
};
