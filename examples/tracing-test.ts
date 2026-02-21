/**
 * Enhanced Tracing Test Example
 * Demonstrates: caller info, timing, breadcrumbs, stack traces, timers
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/tracing-test.ts
 */

import { devLogger } from 'dev-log-monitor';

// Simulate a service with multiple functions
class UserService {
  private logger = devLogger.create('UserService');

  async findUser(id: number) {
    this.logger.debug('Looking up user', { id });
    await this.simulateDbQuery(50);
    this.logger.info('User found', { id, name: 'John Doe' });
    return { id, name: 'John Doe' };
  }

  async createUser(data: { name: string; email: string }) {
    this.logger.info('Creating new user', { data });

    // Use timer to measure operation
    const timer = this.logger.startTimer('database-insert');
    await this.simulateDbQuery(150);
    timer.end({ table: 'users', rows: 1 });

    return { id: Math.floor(Math.random() * 1000), ...data };
  }

  async deleteUser(id: number) {
    this.logger.warn('Deleting user - this action is irreversible', { id });
    await this.simulateDbQuery(30);
    this.logger.info('User deleted successfully', { id });
  }

  private simulateDbQuery(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class OrderService {
  private logger = devLogger.create('OrderService');

  async processOrder(userId: number, items: string[]) {
    this.logger.info('Processing order', { userId, itemCount: items.length });

    // Simulate multiple steps with breadcrumb trail
    this.logger.debug('Validating inventory');
    await this.sleep(20);

    this.logger.debug('Calculating totals');
    await this.sleep(30);

    this.logger.debug('Processing payment');
    await this.sleep(100);

    // Simulate an error to show breadcrumbs
    if (items.includes('out-of-stock-item')) {
      const error = new Error('Item out of stock: out-of-stock-item');
      this.logger.error('Order processing failed', {
        stack: error.stack,
        errorName: error.name,
        errorMessage: error.message,
      });
      throw error;
    }

    this.logger.info('Order completed', { orderId: 'ORD-' + Date.now() });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Function that throws error with stack trace
function deepFunction() {
  innerFunction();
}

function innerFunction() {
  throw new Error('Something went wrong in the inner function!');
}

async function main() {
  // Initialize dev-log
  await devLogger.init({ port: 3333 });

  console.log('\nEnhanced Tracing Demo\n');
  console.log('View logs at http://localhost:3333\n');

  const userService = new UserService();
  const orderService = new OrderService();

  // Demo 1: Basic logging with caller info
  console.log('Demo 1: Caller info tracking...');
  devLogger.info('Application started');
  await sleep(100);

  // Demo 2: Service logging with timing
  console.log('Demo 2: Timing between logs...');
  await userService.findUser(123);
  await sleep(200);
  await userService.createUser({ name: 'Jane', email: 'jane@example.com' });
  await sleep(50);

  // Demo 3: Timer for measuring operations
  console.log('Demo 3: Operation timers...');
  const logger = devLogger.create('MainApp');
  const timer = logger.startTimer('full-user-flow');
  await userService.findUser(456);
  await userService.deleteUser(789);
  timer.end({ operationType: 'user-management' });

  // Demo 4: Breadcrumbs on error
  console.log('Demo 4: Breadcrumbs (logs before error)...');
  try {
    await orderService.processOrder(123, ['item1', 'out-of-stock-item', 'item3']);
  } catch {
    // Error already logged by service
  }

  // Demo 5: Stack trace parsing
  console.log('Demo 5: Parsed stack traces...');
  try {
    deepFunction();
  } catch (e: unknown) {
    const err = e as Error;
    devLogger.error('Caught error with full stack', {
      stack: err.stack,
      errorType: err.name,
    });
  }

  // Demo 6: Multiple rapid logs to show timing deltas
  console.log('Demo 6: Rapid logging with deltas...');
  const rapidLogger = devLogger.create('RapidTest');
  for (let i = 1; i <= 5; i++) {
    rapidLogger.debug(`Step ${i} of 5`);
    await sleep(Math.random() * 100);
  }

  console.log('\nAll demos complete!');
  console.log('Open http://localhost:3333 to see the enhanced log viewer\n');
  console.log('Features to explore in the UI:');
  console.log('  - Click on any log to expand details');
  console.log('  - See source location (file:line -> function)');
  console.log('  - See timing deltas between logs');
  console.log('  - Errors show breadcrumbs (what happened before)');
  console.log('  - Errors show parsed stack traces');

  // Keep server running
  console.log('\nPress Ctrl+C to exit\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await devLogger.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
