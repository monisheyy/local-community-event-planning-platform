import { config } from './config.js';
import { initDb, closeDb } from './db/index.js';
import { createApp } from './app.js';

async function main() {
  if (config.appInsightsConnectionString) {
    // Azure Monitor / Application Insights: request, dependency and exception telemetry
    try {
      const appInsights = (await import('applicationinsights')).default;
      appInsights.setup(config.appInsightsConnectionString).setAutoCollectConsole(true, true).start();
      console.log('[monitor] Application Insights enabled');
    } catch (err) {
      console.warn('[monitor] Application Insights not available:', err.message);
    }
  }

  await initDb();
  // Zero-config local runs get demo data automatically; on Azure set SEED_DEMO_DATA=true once.
  if (config.db.driver === 'sqlite' || process.env.SEED_DEMO_DATA === 'true') {
    const { seed } = await import('./db/seed.js');
    await seed({ quiet: true });
  }
  const app = createApp();
  const server = app.listen(config.port, (err) => {
    if (err) {
      console.error(
        err.code === 'EADDRINUSE'
          ? `[api] Port ${config.port} is already in use. Stop the other server or set PORT in backend/.env`
          : err,
      );
      process.exit(1);
    }
    console.log(`[api] Community Events API listening on http://localhost:${config.port}`);
    console.log(`[api] database: ${config.db.driver} | storage: ${config.storage.driver}`);
  });

  const shutdown = async () => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
