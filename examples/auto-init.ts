/**
 * Auto-Init Example — Zero-Config One-Liner
 *
 * Just import 'dev-log-monitor/auto' and all console.log/warn/error/debug
 * calls are automatically captured and shown in the web UI.
 *
 * No manual init needed. Configure via environment variables.
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/auto-init.ts
 *
 * Environment variables (all optional):
 *   DEV_LOG_PORT=3333              Port for the web UI
 *   DEV_LOG_DIR=.dev-log           Log storage directory
 *   DEV_LOG_RETENTION=3            Days to keep logs
 *   DEV_LOG_CONSOLE=true           Also print to console (set 'false' to suppress)
 *   DEV_LOG_INTERCEPT=true         Intercept console.log calls (set 'false' to disable)
 *   DEV_LOG_MASKING=true           Auto-mask sensitive data (set 'false' to disable)
 *   DEV_LOG_STORAGE_LEVEL=debug    Minimum level to persist (debug|info|warn|error)
 *   DEV_LOG_MAX_FILE_SIZE=52428800 Max per-file size in bytes (default 50MB)
 *   DEV_LOG_MAX_TOTAL_SIZE=104857600 Max total log size (default 100MB)
 *   DEV_LOG_DISABLE=true           Disable dev-log entirely
 *   DEV_LOG_DISABLED=true          Alias for DEV_LOG_DISABLE
 *   NODE_ENV=production            Also disables dev-log (production safety)
 */

// This single import does everything:
// - Initializes the logger
// - Starts the web UI server
// - Intercepts all console methods
// - Enables sensitive data masking
import 'dev-log-monitor/auto';

// Wait for auto-init to complete before logging
import { ready } from 'dev-log-monitor/auto';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Ensure auto-init is done (usually instant, but good practice)
  await ready;

  console.log('\nAuto-Init Demo — zero config!');
  console.log('View logs at http://localhost:3333\n');

  // All console methods are captured automatically
  console.log('This is a regular log message');
  console.info('Info: Application started');
  console.debug('Debug: Internal state', { ready: true, mode: 'development' });
  console.warn('Warning: Deprecated API used');
  console.error('Error: Something went wrong');
  await sleep(100);

  // Sensitive data is automatically masked
  console.log('User login attempt', {
    email: 'john@example.com',
    password: 'secret123',       // <-- will be masked as ****
    apiKey: 'sk_live_abc123',    // <-- will be masked
    token: 'eyJhbGciOiJIUzI1...',// <-- will be masked
  });
  await sleep(50);

  // Objects and errors work too
  console.log('Server config', {
    host: 'localhost',
    port: 4000,
    database: 'myapp',
    secret: 'db_password_here', // <-- masked
  });

  console.error(new Error('Uncaught exception example'));
  await sleep(50);

  // You can also use devLogger directly alongside console interception
  const { devLogger } = await import('dev-log-monitor');
  const logger = devLogger.create('MyService');
  logger.info('Scoped logger still works with auto-init');
  logger.debug('Mixed usage: console + devLogger');

  console.log('\nAll demos complete!');
  console.log('Open http://localhost:3333 to see the logs\n');
  console.log('Press Ctrl+C to exit\n');

  // Graceful shutdown
  const { autoShutdown } = await import('dev-log-monitor/auto');
  const shutdown = async () => {
    console.log('\nShutting down...');
    await autoShutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
