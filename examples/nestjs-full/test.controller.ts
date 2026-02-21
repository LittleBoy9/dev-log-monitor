import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { devLogger } from 'dev-log-monitor';

// Custom error classes for demo
class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public transactionId?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class DatabaseError extends Error {
  constructor(
    message: string,
    public query?: string,
    public table?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Comprehensive Test Controller for Live Demo
 * Showcases ALL features of dev-log-monitor
 */
@Controller('test')
export class TestController {
  private logger = devLogger.create('TestController', 'nest');

  // ========================================
  // BASIC LOGGING DEMOS
  // ========================================

  /**
   * Demo: All log levels with console.log
   */
  @Get('console')
  consoleDemo() {
    console.log('📝 This is a regular console.log - captured automatically!');
    console.info('ℹ️ Console.info works too');
    console.debug('🔍 Debug messages for detailed tracing');
    console.warn('⚠️ Warning: Something might be wrong');
    console.error('❌ Error logged via console.error');

    // With metadata
    console.log('User action', { userId: 123, action: 'click', page: '/dashboard' });
    console.log('API Response', { status: 200, data: { items: 5 } });

    return {
      message: 'Console logging demo complete!',
      hint: 'All console.log calls appear in the dev-log UI',
      url: 'http://localhost:3333',
    };
  }

  /**
   * Demo: All log levels with devLogger
   */
  @Get('levels')
  allLevels() {
    this.logger.debug('DEBUG: Detailed diagnostic information');
    this.logger.info('INFO: General operational messages');
    this.logger.warn('WARN: Warning conditions');
    this.logger.error('ERROR: Error conditions');

    // With rich metadata
    this.logger.info('Request processed', {
      method: 'GET',
      path: '/api/users',
      duration: 45,
      status: 200,
    });

    return {
      message: 'All log levels demonstrated',
      levels: ['debug', 'info', 'warn', 'error'],
    };
  }

  /**
   * Demo: Mixed console.log and devLogger
   */
  @Get('mixed')
  async mixedLogging() {
    console.log('🚀 Starting mixed logging demo');
    this.logger.info('DevLogger: Processing request');

    await this.delay(50);
    console.log('Step 1 completed');
    this.logger.debug('DevLogger: Step 1 details', { items: 10 });

    await this.delay(30);
    console.warn('Step 2 had a warning');
    this.logger.warn('DevLogger: Warning details', { reason: 'slow response' });

    await this.delay(40);
    console.log('✅ Mixed logging demo complete');
    this.logger.info('DevLogger: Request completed');

    return { message: 'Mixed logging demo complete!' };
  }

  // ========================================
  // TIMING & PERFORMANCE DEMOS
  // ========================================

  /**
   * Demo: Operation timers
   */
  @Get('timers')
  async timerDemo() {
    this.logger.info('Starting timer demo');

    // Fast operation
    const fast = this.logger.startTimer('fast-operation');
    await this.delay(50);
    fast.end({ result: 'quick!' });

    // Medium operation
    const medium = this.logger.startTimer('database-query');
    await this.delay(250);
    medium.end({ rows: 150, table: 'users' });

    // Slow operation
    const slow = this.logger.startTimer('external-api-call');
    await this.delay(800);
    slow.end({ endpoint: 'https://api.example.com', status: 200 });

    // Very slow operation
    const verySlow = this.logger.startTimer('batch-processing');
    await this.delay(1500);
    verySlow.end({ processed: 1000, failed: 2 });

    this.logger.info('Timer demo complete');

    return {
      message: 'Timer demo complete!',
      hint: 'Look at the timing badges (+Xms) on each log',
    };
  }

  /**
   * Demo: Timing deltas between logs
   */
  @Get('timing')
  async timingDemo() {
    console.log('⏱️ Timing demo started');

    await this.delay(10);
    console.log('Quick step (+10ms)');

    await this.delay(100);
    console.log('Medium step (+100ms)');

    await this.delay(500);
    console.log('Slow step (+500ms)');

    await this.delay(1000);
    console.log('Very slow step (+1s)');

    await this.delay(50);
    console.log('✅ Timing demo complete');

    return {
      message: 'Timing demo complete!',
      hint: 'Notice the timing deltas showing time between logs',
    };
  }

  // ========================================
  // ERROR & EXCEPTION DEMOS
  // ========================================

  /**
   * Demo: Various error types
   */
  @Get('errors')
  async errorTypes() {
    this.logger.info('Starting error types demo');

    // TypeError
    try {
      const obj: any = null;
      obj.someMethod();
    } catch (e: any) {
      this.logger.error('TypeError occurred', { stack: e.stack, type: 'TypeError' });
    }

    await this.delay(100);

    // RangeError
    try {
      const arr = new Array(-1);
    } catch (e: any) {
      this.logger.error('RangeError occurred', { stack: e.stack, type: 'RangeError' });
    }

    await this.delay(100);

    // Custom PaymentError
    try {
      throw new PaymentError('Card declined', 'CARD_DECLINED', 'txn_123456');
    } catch (e: any) {
      this.logger.error('PaymentError occurred', {
        stack: e.stack,
        code: e.code,
        transactionId: e.transactionId,
      });
    }

    await this.delay(100);

    // Custom ValidationError
    try {
      throw new ValidationError('Invalid email format', 'email', 'not-an-email');
    } catch (e: any) {
      this.logger.error('ValidationError occurred', {
        stack: e.stack,
        field: e.field,
        value: e.value,
      });
    }

    await this.delay(100);

    // Custom DatabaseError
    try {
      throw new DatabaseError('Connection timeout', 'SELECT * FROM users', 'users');
    } catch (e: any) {
      this.logger.error('DatabaseError occurred', {
        stack: e.stack,
        query: e.query,
        table: e.table,
      });
    }

    return {
      message: 'Error types demo complete!',
      errors: ['TypeError', 'RangeError', 'PaymentError', 'ValidationError', 'DatabaseError'],
      hint: 'Click on each error to see the stack trace and breadcrumbs',
    };
  }

  /**
   * Demo: Error with full breadcrumb trail
   */
  @Get('breadcrumbs')
  async breadcrumbDemo() {
    console.log('🍞 Starting breadcrumb demo');

    // Build up a trail of what happened
    this.logger.debug('User clicked checkout button');
    await this.delay(30);

    this.logger.debug('Loading cart items', { count: 3 });
    await this.delay(50);

    this.logger.debug('Validating inventory');
    await this.delay(40);

    this.logger.info('Inventory check passed');
    await this.delay(30);

    this.logger.debug('Calculating totals', { subtotal: 99.99, tax: 8.50 });
    await this.delay(20);

    this.logger.debug('Applying discount code', { code: 'SAVE20' });
    await this.delay(60);

    this.logger.info('Discount applied: -$20.00');
    await this.delay(30);

    this.logger.debug('Initializing payment processor');
    await this.delay(100);

    this.logger.debug('Sending payment request');
    await this.delay(150);

    this.logger.warn('Payment gateway slow response');
    await this.delay(200);

    // Now the error happens
    this.logger.error('Payment failed: Card expired', {
      stack: new Error('Card expired').stack,
      cardLast4: '4242',
      expiry: '01/23',
    });

    return {
      message: 'Breadcrumb demo complete!',
      hint: 'Click on the error to see the breadcrumb trail showing what happened before',
    };
  }

  /**
   * Demo: Nested async error with deep stack
   */
  @Get('deep-error')
  async deepErrorDemo() {
    console.log('🕳️ Starting deep error demo');

    try {
      await this.level1();
    } catch (e: any) {
      this.logger.error('Deep error caught at top level', {
        stack: e.stack,
        depth: 5,
      });
    }

    return {
      message: 'Deep error demo complete!',
      hint: 'Check the parsed stack trace - app code vs node_modules',
    };
  }

  private async level1() {
    this.logger.debug('Entering level 1');
    await this.delay(20);
    await this.level2();
  }

  private async level2() {
    this.logger.debug('Entering level 2');
    await this.delay(20);
    await this.level3();
  }

  private async level3() {
    this.logger.debug('Entering level 3');
    await this.delay(20);
    await this.level4();
  }

  private async level4() {
    this.logger.debug('Entering level 4');
    await this.delay(20);
    await this.level5();
  }

  private async level5() {
    this.logger.debug('Entering level 5 - about to fail!');
    await this.delay(20);
    throw new Error('Error at deepest level!');
  }

  /**
   * Demo: HTTP Exception
   */
  @Get('http-error')
  httpErrorDemo() {
    this.logger.info('About to throw HTTP exception');
    this.logger.warn('Resource not found', { resource: 'user', id: 999 });

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'User not found',
        error: 'Not Found',
      },
      HttpStatus.NOT_FOUND,
    );
  }

  // ========================================
  // SENSITIVE DATA MASKING DEMO
  // ========================================

  /**
   * Demo: Sensitive data is automatically masked
   */
  @Post('sensitive')
  sensitiveDataDemo(@Body() body: any) {
    // These should be masked in the logs
    console.log('Received sensitive data', {
      username: body.username || 'john_doe',
      password: body.password || 'super_secret_123',
      email: body.email || 'john@example.com',
      creditCard: body.creditCard || '4111-1111-1111-1111',
      ssn: body.ssn || '123-45-6789',
      apiKey: body.apiKey || 'sk_live_abc123xyz',
      token: body.token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    });

    this.logger.info('Processing user data', {
      user: body.username || 'john_doe',
      password: body.password || 'another_password',
      authorization: 'Bearer token123',
    });

    return {
      message: 'Sensitive data demo complete!',
      hint: 'Check the logs - passwords, tokens, credit cards are masked',
    };
  }

  /**
   * Demo: Sensitive data in GET request
   */
  @Get('sensitive')
  sensitiveGetDemo() {
    console.log('User authentication', {
      email: 'user@example.com',
      password: 'password123',
      apiKey: 'api_key_12345',
      secret: 'my_secret_value',
    });

    return {
      message: 'Sensitive data GET demo complete!',
      hint: 'Passwords, API keys, and secrets are automatically masked',
    };
  }

  // ========================================
  // COMPLEX FLOW DEMOS
  // ========================================

  /**
   * Demo: Successful e-commerce checkout flow
   */
  @Get('checkout')
  async checkoutFlow() {
    const orderId = `ORD-${Date.now()}`;
    console.log(`🛒 Starting checkout flow for order ${orderId}`);

    // Step 1: Validate cart
    this.logger.info('Validating cart', { orderId });
    await this.delay(50);
    this.logger.debug('Cart validated', { items: 3, total: 149.99 });

    // Step 2: Check inventory
    const inventoryTimer = this.logger.startTimer('inventory-check');
    this.logger.info('Checking inventory');
    await this.delay(120);
    inventoryTimer.end({ allAvailable: true });

    // Step 3: Calculate shipping
    this.logger.info('Calculating shipping');
    await this.delay(80);
    this.logger.debug('Shipping calculated', { method: 'express', cost: 9.99 });

    // Step 4: Apply promotions
    this.logger.info('Applying promotions');
    await this.delay(60);
    this.logger.info('Discount applied', { code: 'WELCOME10', discount: 15.00 });

    // Step 5: Process payment
    const paymentTimer = this.logger.startTimer('payment-processing');
    this.logger.info('Processing payment');
    await this.delay(300);
    paymentTimer.end({ status: 'success', transactionId: 'txn_' + Date.now() });

    // Step 6: Create order
    this.logger.info('Creating order record');
    await this.delay(100);

    // Step 7: Send confirmation
    this.logger.info('Sending confirmation email');
    await this.delay(150);

    console.log(`✅ Order ${orderId} completed successfully!`);

    return {
      orderId,
      message: 'Checkout flow complete!',
      hint: 'Watch the timing and flow in the log viewer',
    };
  }

  /**
   * Demo: Failing checkout with rollback
   */
  @Get('checkout-fail')
  async checkoutFailFlow() {
    const orderId = `ORD-${Date.now()}`;
    console.log(`🛒 Starting checkout flow for order ${orderId}`);

    try {
      // Step 1: Validate cart
      this.logger.info('Validating cart', { orderId });
      await this.delay(50);
      this.logger.debug('Cart validated');

      // Step 2: Reserve inventory
      this.logger.info('Reserving inventory');
      await this.delay(100);
      this.logger.debug('Inventory reserved');

      // Step 3: Process payment - FAILS
      this.logger.info('Processing payment');
      await this.delay(200);

      // Simulate payment failure
      throw new PaymentError('Insufficient funds', 'INSUFFICIENT_FUNDS', 'txn_fail_123');
    } catch (error: any) {
      // Log the error
      this.logger.error('Checkout failed', {
        stack: error.stack,
        orderId,
        errorCode: error.code,
      });

      // Rollback
      console.warn('⚠️ Starting rollback...');
      this.logger.warn('Rolling back inventory reservation');
      await this.delay(80);
      this.logger.info('Inventory released');

      console.error(`❌ Order ${orderId} failed`);

      return {
        orderId,
        success: false,
        message: 'Checkout failed - see error logs with breadcrumbs',
        error: error.message,
      };
    }
  }

  /**
   * Demo: Concurrent operations
   */
  @Get('concurrent')
  async concurrentDemo() {
    console.log('🔄 Starting concurrent operations demo');

    const operations = [
      this.simulateOperation('Database Query', 200),
      this.simulateOperation('Cache Lookup', 50),
      this.simulateOperation('External API', 400),
      this.simulateOperation('File Read', 100),
    ];

    this.logger.info('Waiting for all operations to complete');
    await Promise.all(operations);

    console.log('✅ All concurrent operations complete');

    return {
      message: 'Concurrent operations demo complete!',
      hint: 'Notice how logs from different operations interleave',
    };
  }

  private async simulateOperation(name: string, duration: number) {
    const timer = this.logger.startTimer(name);
    this.logger.debug(`${name} started`);
    await this.delay(duration);
    timer.end({ result: 'success' });
  }

  // ========================================
  // SERVICE CALL CHAIN DEMO
  // ========================================

  /**
   * Demo: Multi-service call chain
   */
  @Get('services')
  async serviceChainDemo() {
    console.log('🔗 Starting service chain demo');

    await this.userService();

    console.log('✅ Service chain complete');

    return {
      message: 'Service chain demo complete!',
      hint: 'See how logs flow through different services',
    };
  }

  private async userService() {
    const logger = devLogger.create('UserService', 'nest');
    logger.info('UserService: Fetching user profile');
    await this.delay(50);

    await this.authService();

    logger.debug('UserService: User authenticated');
    await this.delay(30);

    await this.orderService();

    logger.info('UserService: Profile loaded with orders');
  }

  private async authService() {
    const logger = devLogger.create('AuthService', 'nest');
    logger.info('AuthService: Verifying token');
    await this.delay(40);
    logger.debug('AuthService: Token valid', { userId: 123, role: 'admin' });
  }

  private async orderService() {
    const logger = devLogger.create('OrderService', 'nest');
    logger.info('OrderService: Loading user orders');

    const timer = logger.startTimer('fetch-orders');
    await this.delay(150);
    timer.end({ count: 5 });

    logger.debug('OrderService: Orders loaded');
  }

  // ========================================
  // STRESS TEST / RAPID LOGGING
  // ========================================

  /**
   * Demo: Rapid logging (stress test)
   */
  @Get('rapid/:count')
  async rapidLogging(@Param('count') count: string) {
    const n = Math.min(parseInt(count) || 100, 500);
    console.log(`⚡ Starting rapid logging: ${n} logs`);

    const startTime = Date.now();

    for (let i = 0; i < n; i++) {
      const level = i % 4;
      switch (level) {
        case 0:
          this.logger.debug(`Rapid log ${i + 1}/${n}`);
          break;
        case 1:
          this.logger.info(`Rapid log ${i + 1}/${n}`);
          break;
        case 2:
          this.logger.warn(`Rapid log ${i + 1}/${n}`);
          break;
        case 3:
          if (i % 10 === 0) {
            this.logger.error(`Rapid error ${i + 1}/${n}`, {
              stack: new Error('Simulated error').stack
            });
          } else {
            this.logger.info(`Rapid log ${i + 1}/${n}`);
          }
          break;
      }

      if (i % 50 === 0) {
        await this.delay(10); // Small pause every 50 logs
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Rapid logging complete: ${n} logs in ${duration}ms`);

    return {
      message: `Rapid logging complete: ${n} logs`,
      duration: `${duration}ms`,
      logsPerSecond: Math.round((n / duration) * 1000),
    };
  }

  // ========================================
  // ALL-IN-ONE DEMO
  // ========================================

  /**
   * Demo: Complete showcase of all features
   */
  @Get('showcase')
  async showcaseDemo() {
    console.log('🎬 Starting comprehensive showcase');
    console.log('=' .repeat(50));

    // 1. Basic logging
    console.log('\n📝 Section 1: Basic Logging');
    this.logger.debug('Debug message');
    this.logger.info('Info message');
    this.logger.warn('Warning message');
    await this.delay(100);

    // 2. Metadata
    console.log('\n📊 Section 2: Rich Metadata');
    this.logger.info('User action', {
      userId: 123,
      action: 'purchase',
      amount: 99.99,
      items: ['widget', 'gadget'],
    });
    await this.delay(100);

    // 3. Timing
    console.log('\n⏱️ Section 3: Timing');
    const timer = this.logger.startTimer('showcase-operation');
    await this.delay(300);
    timer.end({ status: 'complete' });

    // 4. Sensitive data masking
    console.log('\n🔒 Section 4: Data Masking');
    console.log('User credentials', {
      username: 'demo_user',
      password: 'secret123',
      apiKey: 'key_abc123',
    });
    await this.delay(100);

    // 5. Warning scenario
    console.log('\n⚠️ Section 5: Warnings');
    this.logger.warn('High memory usage', { used: '85%', threshold: '80%' });
    this.logger.warn('Deprecated API called', { endpoint: '/v1/users', useInstead: '/v2/users' });
    await this.delay(100);

    // 6. Error with breadcrumbs
    console.log('\n❌ Section 6: Error with Breadcrumbs');
    this.logger.debug('Operation step 1');
    await this.delay(30);
    this.logger.debug('Operation step 2');
    await this.delay(30);
    this.logger.debug('Operation step 3');
    await this.delay(30);
    this.logger.error('Operation failed at step 3', {
      stack: new Error('Demo error').stack,
      step: 3,
      reason: 'Simulated failure',
    });

    console.log('\n' + '='.repeat(50));
    console.log('🎬 Showcase complete! Open http://localhost:3333');

    return {
      message: 'Comprehensive showcase complete!',
      sections: [
        'Basic Logging',
        'Rich Metadata',
        'Timing',
        'Data Masking',
        'Warnings',
        'Error with Breadcrumbs',
      ],
      url: 'http://localhost:3333',
    };
  }

  // ========================================
  // HELPER
  // ========================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
