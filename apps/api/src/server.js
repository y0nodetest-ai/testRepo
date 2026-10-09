import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, getDb } from './db.js';

getDb(); // open + migrate + seed before accepting traffic

const server = createApp().listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
  console.log(`[api] database: ${config.databaseFile}`);
  console.log(
    `[api] cors origins: ${
      config.corsOriginsAreExplicit ? config.corsOrigins.join(', ') : 'any localhost port (dev default)'
    }`,
  );
  console.warn('[api] NOTE: these endpoints are unauthenticated. Add auth before exposing them beyond localhost.');
});

function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
