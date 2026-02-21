/**
 * Basic Node.js Example — No Framework Required
 *
 * Demonstrates all core features of dev-log-monitor:
 * - Manual initialization with config
 * - All log levels (debug, info, warn, error)
 * - Scoped loggers with context
 * - Operation timers
 * - Error logging with stack traces and breadcrumbs
 * - Graceful shutdown
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/basic-node.ts
 *
 * Environment variables (all optional):
 *   DEV_LOG_PORT=3333              Port for the web UI
 *   DEV_LOG_DIR=.dev-log           Log storage directory
 *   DEV_LOG_RETENTION=3            Days to keep logs
 *   DEV_LOG_CONSOLE=true           Also print to console
 *   DEV_LOG_STORAGE_LEVEL=debug    Minimum level to persist (debug|info|warn|error)
 *   DEV_LOG_MAX_FILE_SIZE=52428800 Max per-file size in bytes (default 50MB)
 *   DEV_LOG_MAX_TOTAL_SIZE=104857600 Max total log size in bytes (default 100MB)
 *   DEV_LOG_DISABLE=true           Disable dev-log entirely
 *   DEV_LOG_DISABLED=true          Alias for DEV_LOG_DISABLE
 */

import { devLogger } from 'dev-log-monitor';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Initialize with explicit config (all fields optional, shown with defaults)
  await devLogger.init({
    port: 3333,                       // Web UI port
    logDir: '.dev-log',               // Where JSONL log files are stored
    retentionDays: 3,                 // Auto-delete logs older than this
    consoleOutput: true,              // Also print to stdout
    storageLevel: 'debug',            // Minimum level to persist to disk
    maxFileSize: 50 * 1024 * 1024,    // 50MB per daily file
    maxTotalSize: 100 * 1024 * 1024,  // 100MB total across all files
  });

  console.log('\nBasic Node.js Demo');
  console.log('View logs at http://localhost:3333\n');

  // --- 1. Direct logging (no context) ---
  devLogger.debug('Application starting');
  devLogger.info('Server initialized', { pid: process.pid, nodeVersion: process.version });
  devLogger.warn('Using default config — set DEV_LOG_PORT to customize');
  await sleep(50);

  // --- 2. Scoped loggers (with context name) ---
  const dbLogger = devLogger.create('Database');
  const cacheLogger = devLogger.create('Cache');

  dbLogger.info('Connecting to database', { host: 'localhost', port: 5432 });
  await sleep(30);
  dbLogger.debug('Connection pool created', { min: 2, max: 10 });

  cacheLogger.info('Redis connected', { host: 'localhost', port: 6379 });
  cacheLogger.debug('Cache warmed up', { keys: 150 });
  await sleep(50);

  // --- 3. Operation timers ---
  const apiLogger = devLogger.create('API');

  const timer1 = apiLogger.startTimer('fetch-users');
  await sleep(120); // simulate DB query
  timer1.end({ rows: 42, table: 'users' });

  const timer2 = apiLogger.startTimer('send-email');
  await sleep(200); // simulate external API call
  timer2.end({ to: 'user@example.com', template: 'welcome' });

  // --- 4. Breadcrumbs + error logging ---
  const orderLogger = devLogger.create('OrderService');

  // These become breadcrumbs visible on the error below
  orderLogger.debug('Validating cart items');
  await sleep(20);
  orderLogger.debug('Checking inventory', { items: 3 });
  await sleep(30);
  orderLogger.info('Inventory confirmed');
  await sleep(20);
  orderLogger.debug('Processing payment');
  await sleep(100);

  // Log an error — breadcrumbs show what happened before
  try {
    throw new Error('Payment gateway timeout after 30s');
  } catch (e: unknown) {
    const err = e as Error;
    orderLogger.error('Payment processing failed', {
      stack: err.stack,
      gateway: 'stripe',
      amount: 99.99,
    });
  }

  // --- 5. Different log sources ---
  const nestStyleLogger = devLogger.create('UserController', 'nest');
  nestStyleLogger.info('GET /users called', { method: 'GET', path: '/users' });

  await sleep(50);

  console.log('\nAll demos complete!');
  console.log('Open http://localhost:3333 to explore the logs\n');
  console.log('Press Ctrl+C to exit\n');

  // --- Graceful shutdown ---
  const shutdown = async () => {
    console.log('\nShutting down...');
    await devLogger.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
