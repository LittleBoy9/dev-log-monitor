/**
 * Full NestJS Server Example - Live Demo
 *
 * Demonstrates ALL features of dev-log-monitor:
 * - One-line integration with console.log interception
 * - Multiple log levels and sources
 * - Timing between operations
 * - Breadcrumbs before errors
 * - Parsed stack traces
 * - Sensitive data masking
 * - Rich metadata
 *
 * Run with: npx ts-node --project examples/tsconfig.json examples/nestjs-full/main.ts
 */

// ONE LINE INTEGRATION - just add this import!
import '../../dist/auto';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { devLogger } from '../..';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: devLogger.nest(),  // Optional: use dev-log as NestJS logger
  });

  // Add request tracing middleware
  app.use((req: any, res: any, next: any) => {
    req.traceId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    next();
  });

  const PORT = 4000;
  await app.listen(PORT);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           dev-log-monitor - Live Demo Server                 ║
╠══════════════════════════════════════════════════════════════╣
║  📺 Log Viewer:  http://localhost:3333                       ║
║  🌐 API Server:  http://localhost:${PORT}                       ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('📋 DEMO ENDPOINTS:\n');

  console.log('  🎬 SHOWCASE (Start Here!)');
  console.log('    GET  /test/showcase       - Complete feature demonstration\n');

  console.log('  📝 BASIC LOGGING');
  console.log('    GET  /test/console        - Console.log interception demo');
  console.log('    GET  /test/levels         - All log levels (debug/info/warn/error)');
  console.log('    GET  /test/mixed          - Mixed console.log + devLogger\n');

  console.log('  ⏱️  TIMING & PERFORMANCE');
  console.log('    GET  /test/timers         - Operation timers with duration');
  console.log('    GET  /test/timing         - Timing deltas between logs\n');

  console.log('  ❌ ERRORS & EXCEPTIONS');
  console.log('    GET  /test/errors         - Various error types demo');
  console.log('    GET  /test/breadcrumbs    - Error with full breadcrumb trail');
  console.log('    GET  /test/deep-error     - Nested async error (5 levels deep)');
  console.log('    GET  /test/http-error     - HTTP 404 exception\n');

  console.log('  🔒 SENSITIVE DATA');
  console.log('    GET  /test/sensitive      - Auto-masking demo (password, token, etc.)');
  console.log('    POST /test/sensitive      - POST with sensitive body data\n');

  console.log('  🛒 COMPLEX FLOWS');
  console.log('    GET  /test/checkout       - Successful e-commerce checkout');
  console.log('    GET  /test/checkout-fail  - Failed checkout with rollback');
  console.log('    GET  /test/concurrent     - Concurrent operations');
  console.log('    GET  /test/services       - Multi-service call chain\n');

  console.log('  ⚡ STRESS TEST');
  console.log('    GET  /test/rapid/100      - Rapid logging (100 logs)');
  console.log('    GET  /test/rapid/500      - Rapid logging (500 logs)\n');

  console.log('  📦 OTHER MODULES');
  console.log('    GET  /users               - List users');
  console.log('    GET  /products            - List products');
  console.log('    GET  /orders              - List orders');
  console.log('    POST /auth/login          - Login (body: {email, password})\n');

  console.log('━'.repeat(62));
  console.log('💡 TIP: Open http://localhost:3333 in a browser first,');
  console.log('        then call the endpoints to see logs in real-time!');
  console.log('━'.repeat(62));
  console.log('\nPress Ctrl+C to exit\n');
}

bootstrap().catch(console.error);
