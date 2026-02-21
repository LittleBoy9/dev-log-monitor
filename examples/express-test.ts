/**
 * Express.js Test Example
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/express-test.ts
 * (requires: npm install express tsconfig-paths)
 */

import express, { Request, Response } from 'express';
import { devLogger } from 'dev-log-monitor';

const app = express();

async function main() {
  // Initialize dev-log
  await devLogger.init({ port: 3333 });

  // Add Express middleware — attaches req.log (scoped logger) to every request
  app.use(devLogger.express());

  // Test routes — req.log is typed via Express.Request augmentation
  app.get('/', (req: Request, res: Response) => {
    req.log.info('Home page accessed');
    res.json({ message: 'Hello from Express!' });
  });

  app.get('/users', (req: Request, res: Response) => {
    req.log.info('Fetching users');
    req.log.debug('Query params', { query: req.query });
    res.json({ users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] });
  });

  app.get('/error', (req: Request, res: Response) => {
    req.log.error('Something went wrong!', { code: 'ERR_TEST' });
    res.status(500).json({ error: 'Test error' });
  });

  app.post('/users', express.json(), (req: Request, res: Response) => {
    const logger = devLogger.create('UserController');
    logger.info('Creating new user', { body: req.body });
    logger.warn('This is a warning test');
    res.status(201).json({ id: 3, ...req.body });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await devLogger.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  const PORT = 4000;
  app.listen(PORT, () => {
    devLogger.info('Express server started', { port: PORT });
    console.log(`\nExpress server running at http://localhost:${PORT}`);
    console.log(`View logs at http://localhost:3333\n`);
    console.log('Test endpoints:');
    console.log(`  GET  http://localhost:${PORT}/`);
    console.log(`  GET  http://localhost:${PORT}/users`);
    console.log(`  GET  http://localhost:${PORT}/error`);
    console.log(`  POST http://localhost:${PORT}/users\n`);
  });
}

main().catch(console.error);
