import cors from 'cors';
import express from 'express';

import { config } from './config.js';
import { productsRouter } from './products.routes.js';

/**
 * SECURITY NOTE: these routes are intentionally unauthenticated so the demo
 * runs with zero setup. Before exposing this API outside localhost, add
 * authentication and authorisation in front of the products router.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // Cap the body size so a malformed client cannot exhaust memory.
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/products', productsRouter);

  // 404 for anything else under the API surface.
  app.use((req, res) => {
    res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}` } });
  });

  // Central error handler. Keeps internals out of the response body.
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { message: 'Request body must be valid JSON.' } });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: { message: 'Request body is too large.' } });
    }

    console.error('[api] unhandled error:', error);
    return res.status(500).json({ error: { message: 'Something went wrong.' } });
  });

  return app;
}
