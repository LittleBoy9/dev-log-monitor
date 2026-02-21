/**
 * Advanced Features Example
 *
 * Demonstrates advanced dev-log-monitor capabilities:
 * - Custom masking configuration
 * - Alert rules and webhooks
 * - Metrics collection and subscriptions
 * - Async context for request tracing
 * - Programmatic log querying
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/advanced-features.ts
 */

import {
  devLogger,
  configureMasking,
  metrics,
  alerts,
  addAlertRule,
  asyncContext,
  onMetricsUpdate,
  getTraceId,
} from 'dev-log-monitor';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Initialize with storage options
  await devLogger.init({
    port: 3333,
    storageLevel: 'debug',
    maxFileSize: 10 * 1024 * 1024,   // 10MB per file (lower for demo)
    maxTotalSize: 50 * 1024 * 1024,  // 50MB total
    retentionDays: 7,
  });

  console.log('\nAdvanced Features Demo');
  console.log('View logs at http://localhost:3333\n');

  // ========================================
  // 1. CUSTOM MASKING
  // ========================================
  console.log('--- 1. Custom Masking ---\n');

  // Add custom sensitive keys and patterns
  configureMasking({
    sensitiveKeys: ['internalId', 'employeeId'],
    customPatterns: [
      {
        pattern: /ORDER-\d{6,}/g,
        replacement: 'ORDER-[REDACTED]',
        name: 'order_id',
      },
    ],
  });

  const authLogger = devLogger.create('Auth');

  // These values will be automatically masked
  authLogger.info('User authenticated', {
    username: 'john_doe',
    password: 'super_secret_123',   // masked (built-in key)
    apiKey: 'sk_live_abc123xyz',    // masked (built-in key)
    internalId: 'EMP-9876',        // masked (custom key we added)
    role: 'admin',                  // NOT masked (not sensitive)
  });

  // Pattern-based masking in message strings
  authLogger.info('Processing ORDER-123456 for user');
  await sleep(100);

  // ========================================
  // 2. ALERT RULES
  // ========================================
  console.log('--- 2. Alert Rules ---\n');

  // Alert on high error count
  addAlertRule({
    id: 'high-errors',
    name: 'High Error Rate',
    condition: { type: 'error_rate', threshold: 5 },
    handlers: ['console'],
    cooldownMs: 10_000,
  });

  // Alert on specific error patterns
  addAlertRule({
    id: 'db-errors',
    name: 'Database Errors',
    condition: { type: 'pattern', pattern: /database|connection|timeout/i, level: 'error' },
    handlers: ['console'],
    cooldownMs: 5_000,
  });

  // Alert on slow operations
  addAlertRule({
    id: 'slow-ops',
    name: 'Slow Operations',
    condition: { type: 'slow_operation', threshold: 500 },
    handlers: ['console'],
    cooldownMs: 5_000,
  });

  // Custom condition alert
  addAlertRule({
    id: 'payment-failures',
    name: 'Payment Failures',
    condition: {
      type: 'custom',
      check: (entry) =>
        entry.level === 'error' &&
        entry.context === 'PaymentService' &&
        entry.message.includes('failed'),
    },
    handlers: ['console'],
    cooldownMs: 10_000,
  });

  // Trigger some alerts
  const dbLogger = devLogger.create('Database');
  dbLogger.error('Database connection timeout', { host: 'db.example.com', port: 5432 });
  await sleep(50);

  const paymentLogger = devLogger.create('PaymentService');
  paymentLogger.error('Payment processing failed', { reason: 'card_declined', amount: 99.99 });
  await sleep(100);

  // ========================================
  // 3. METRICS
  // ========================================
  console.log('--- 3. Metrics Collection ---\n');

  // Configure metrics
  metrics.configure({
    windowSize: 60_000,             // 1 minute window
    slowOperationThreshold: 200,    // 200ms = slow
    collectSystemInfo: true,
  });

  // Subscribe to metrics updates
  const unsubscribe = onMetricsUpdate((snapshot) => {
    if (snapshot.counts.total > 0 && snapshot.counts.total % 10 === 0) {
      console.log(`[Metrics] Total: ${snapshot.counts.total}, Errors: ${snapshot.counts.error}, Rate: ${snapshot.logsPerSecond.toFixed(1)}/s`);
    }
  });

  // Generate some logs to populate metrics
  const apiLogger = devLogger.create('API');
  for (let i = 0; i < 15; i++) {
    apiLogger.info(`Request ${i + 1} processed`, { status: 200 });
    if (i % 5 === 0) {
      apiLogger.error(`Request ${i + 1} failed`, { status: 500 });
    }
  }

  // Record a timed operation (shows up in metrics)
  const timer = apiLogger.startTimer('external-api-call');
  await sleep(350); // Simulate slow call — will trigger slow_ops alert
  timer.end({ endpoint: '/api/external', status: 200 });

  // Get a snapshot
  const snapshot = metrics.getSnapshot();
  console.log(`\nMetrics snapshot:`);
  console.log(`  Total logs: ${snapshot.counts.total}`);
  console.log(`  Errors: ${snapshot.counts.error}`);
  console.log(`  Error rate: ${snapshot.errorRate.toFixed(2)}/min`);
  console.log(`  Slow operations: ${snapshot.slowOperations.length}`);

  unsubscribe(); // Clean up subscription
  await sleep(100);

  // ========================================
  // 4. ASYNC CONTEXT (Request Tracing)
  // ========================================
  console.log('\n--- 4. Async Context / Request Tracing ---\n');

  // Simulate a request flow with automatic traceId propagation
  await asyncContext.run(
    async () => {
      const traceId = getTraceId();
      console.log(`Request started with traceId: ${traceId}`);

      const userLogger = devLogger.create('UserService');
      userLogger.info('Loading user profile', { userId: 42 });
      await sleep(30);

      // TraceId propagates through async boundaries
      await asyncContext.runAsync(async () => {
        const orderLogger = devLogger.create('OrderService');
        orderLogger.info('Fetching user orders');
        await sleep(50);
        orderLogger.debug('Found 3 orders');
      });

      userLogger.info('Profile loaded');
    },
    { method: 'GET', path: '/users/42' }
  );
  await sleep(50);

  // Another request with a different trace
  await asyncContext.run(
    async () => {
      const traceId = getTraceId();
      console.log(`Another request with traceId: ${traceId}`);

      const logger = devLogger.create('CheckoutService');
      logger.info('Starting checkout', { items: 3 });
      await sleep(40);
      logger.info('Checkout complete');
    },
    { method: 'POST', path: '/checkout' }
  );
  await sleep(100);

  console.log('\nAll demos complete!');
  console.log('Open http://localhost:3333 to explore the logs\n');
  console.log('Press Ctrl+C to exit\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await devLogger.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
