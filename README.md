# dev-log-monitor

> Lightweight local log diagnostics for NestJS, Express, and Node.js development

[![npm version](https://img.shields.io/npm/v/dev-log-monitor.svg)](https://www.npmjs.com/package/dev-log-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Your existing logger + console.log(), but finally usable.**

A zero-dependency development logger with real-time web UI, error tracing, breadcrumbs, and beautiful stack trace visualization. Works with ANY existing logger (console, winston, pino, bunyan, or custom).

## ✨ Features

- **One-Line Integration** - Just add `import 'dev-log-monitor/auto'` to intercept all logs
- **Works with Any Logger** - Console, Winston, Pino, Bunyan, or any custom logger
- **Real-time Web UI** - View logs at `http://localhost:3333` with live updates
- **Source Location Tracking** - See exactly where each log was called (`file:line -> function()`)
- **Timing Deltas** - Track time between logs (`+50ms`, `+1.2s`)
- **Breadcrumbs** - See what happened before errors (last 10 logs)
- **Parsed Stack Traces** - App code highlighted, node_modules collapsed
- **Request Correlation** - Track logs across async operations with trace IDs
- **Sensitive Data Masking** - Auto-mask passwords, tokens, credit cards
- **Alerting** - Get notified via webhooks when errors occur
- **Metrics** - Track error rates, log frequency, and performance
- **Dark/Light Theme** - Easy on the eyes
- **Keyboard Shortcuts** - Navigate quickly with vim-style shortcuts
- **Export** - Download logs as JSON, CSV, or text
- **Zero Dependencies** - No external runtime dependencies

## Installation

```bash
npm install dev-log-monitor
```

## Quick Start (One-Line Integration)

The easiest way to use dev-log-monitor is with auto-integration. Just add one import at the top of your entry file:

```typescript
// Add this ONE LINE at the very top of your entry file (before other imports)
import 'dev-log-monitor/auto';

// Your existing code works unchanged
console.log('This will appear in the dev-log UI!');
console.error('Errors too!');
```

That's it! Open http://localhost:3333 to view your logs.

### How Auto-Integration Works

When you import `dev-log-monitor/auto`:

1. **Console Interception** - All `console.log`, `console.error`, `console.warn`, `console.debug` calls are captured
2. **Source Tracking** - Each log shows the exact file and line number where it was called
3. **Request Context** - Logs from the same request are automatically correlated
4. **Sensitive Data Masking** - Passwords, tokens, and other sensitive data are automatically masked

### Remove for Production

The auto-integration automatically disables itself in production:

```typescript
// Automatically skips when NODE_ENV=production
import 'dev-log-monitor/auto';
```

Or use environment variables:

```bash
# Disable dev-log entirely
DEV_LOG_DISABLE=true

# Or use production mode
NODE_ENV=production
```

## Configuration

### Auto-Integration Config

Configure via environment variables:

```bash
DEV_LOG_PORT=3333           # UI server port
DEV_LOG_DIR=.dev-log        # Log storage directory
DEV_LOG_RETENTION=3         # Days to keep logs
DEV_LOG_CONSOLE=true        # Also print to console
DEV_LOG_DISABLED=false      # Disable entirely
```

Or configure programmatically:

```typescript
import { autoInit } from 'dev-log-monitor';

await autoInit({
  port: 3333,
  logDir: '.dev-log',
  retentionDays: 3,
  consoleOutput: true,
  interceptConsole: true,
});
```

### Sensitive Data Masking

Configure which data to mask:

```typescript
import { configureMasking } from 'dev-log-monitor';

configureMasking({
  enabled: true,
  sensitiveKeys: ['password', 'token', 'secret', 'apiKey', 'authorization'],
  patterns: [
    { name: 'credit-card', pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD ****]' },
    { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN ***]' },
  ],
  maskChar: '*',
});
```

Default masked keys: `password`, `passwd`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `auth`, `credential`, `private`, `ssn`, `creditCard`, `cardNumber`

## Working with Existing Loggers

### Winston

```typescript
import 'dev-log-monitor/auto';
import winston from 'winston';
import { wrapLogger } from 'dev-log-monitor';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
});

// Wrap your existing logger
const wrappedLogger = wrapLogger(logger, 'winston');

wrappedLogger.info('This appears in dev-log UI!');
```

### Pino

```typescript
import 'dev-log-monitor/auto';
import pino from 'pino';
import { wrapLogger } from 'dev-log-monitor';

const logger = pino();
const wrappedLogger = wrapLogger(logger, 'pino');

wrappedLogger.info('This appears in dev-log UI!');
```

### Bunyan

```typescript
import 'dev-log-monitor/auto';
import bunyan from 'bunyan';
import { wrapLogger } from 'dev-log-monitor';

const logger = bunyan.createLogger({ name: 'myapp' });
const wrappedLogger = wrapLogger(logger, 'bunyan');

wrappedLogger.info('This appears in dev-log UI!');
```

### Custom Logger

```typescript
import { wrapLogger } from 'dev-log-monitor';

const myCustomLogger = {
  info: (msg: string) => { /* ... */ },
  error: (msg: string) => { /* ... */ },
};

const wrappedLogger = wrapLogger(myCustomLogger, 'custom');
```

## Framework Integration

### NestJS

```typescript
// main.ts
import 'dev-log-monitor/auto';
import { NestFactory } from '@nestjs/core';
import { devLogger, DevLogContextInterceptor } from 'dev-log-monitor';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: devLogger.nest(),  // Optional: Replace NestJS logger
  });

  // Add request context tracking
  app.useGlobalInterceptors(new DevLogContextInterceptor());

  await app.listen(3000);
}
bootstrap();
```

Use in services:

```typescript
import { Injectable } from '@nestjs/common';
import { devLogger } from 'dev-log-monitor';

@Injectable()
export class UserService {
  private logger = devLogger.create('UserService');

  async createUser(data: CreateUserDto) {
    this.logger.info('Creating user', { email: data.email });
    // Logs will be correlated by request
  }
}
```

### Express

```typescript
import 'dev-log-monitor/auto';
import express from 'express';
import { expressContextMiddleware } from 'dev-log-monitor';

const app = express();

// Add request context tracking (optional but recommended)
app.use(expressContextMiddleware());

app.get('/api/users', (req, res) => {
  console.log('Fetching users');  // Automatically captured!
  req.log?.info('Request received');  // Or use scoped logger
  res.json({ users: [] });
});

app.listen(3000);
```

### Plain Node.js

```typescript
import 'dev-log-monitor/auto';

// All console.log calls are now captured
console.log('Application started');
console.warn('Cache miss', { key: 'user:123' });
console.error('Database connection failed');

// Or use the devLogger directly
import { devLogger } from 'dev-log-monitor';
devLogger.info('Direct log', { data: 'value' });
```

## Request Context & Correlation

Track logs across async operations:

```typescript
import { asyncContext, getTraceId } from 'dev-log-monitor';

// Wrap async operations to correlate logs
asyncContext.run({ traceId: 'request-123' }, async () => {
  console.log('Start processing');  // traceId: request-123
  await someAsyncOperation();
  console.log('Done processing');   // traceId: request-123
});

// Get current trace ID anywhere
const traceId = getTraceId();
```

## Alerting

Get notified when important events occur:

```typescript
import { addAlertRule, addWebhook } from 'dev-log-monitor';

// Add a webhook endpoint
addWebhook({
  url: 'https://hooks.slack.com/services/xxx',
  events: ['error'],
});

// Custom alert rules
addAlertRule({
  name: 'high-error-rate',
  condition: { type: 'error_rate', threshold: 0.1, window: 60000 },
  action: 'webhook',
  webhookUrl: 'https://hooks.slack.com/services/xxx',
});

addAlertRule({
  name: 'payment-errors',
  condition: { type: 'pattern', pattern: /payment.*failed/i },
  action: 'webhook',
  webhookUrl: 'https://hooks.slack.com/services/xxx',
});
```

## Metrics

Track log statistics:

```typescript
import { getMetrics, onMetricsUpdate } from 'dev-log-monitor';

// Get current metrics
const metrics = getMetrics();
console.log(metrics);
// {
//   total: 1234,
//   byLevel: { debug: 100, info: 800, warn: 200, error: 134 },
//   bySource: { console: 500, nest: 400, express: 334 },
//   errorRate: 0.108,
//   logsPerSecond: 2.5,
//   avgResponseTime: 45.2
// }

// Subscribe to metrics updates
const unsubscribe = onMetricsUpdate((metrics) => {
  if (metrics.errorRate > 0.1) {
    console.warn('High error rate detected!');
  }
});
```

## Web UI

After adding the import, open http://localhost:3333 in your browser.

### Features

- **Real-time streaming** - Logs appear instantly via WebSocket
- **Filter by level** - Click debug/info/warn/error buttons
- **Filter by source** - Filter by console/nest/express/winston/pino/etc.
- **Filter by time** - Last 5m, 15m, 1h, 24h
- **Filter by context** - Filter by service/module
- **Full-text search** - With regex support and case sensitivity toggle
- **Dark/Light theme** - Toggle with `t` key or button

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `j` | Next log |
| `k` | Previous log |
| `Enter` | Expand/collapse selected |
| `1-4` | Filter by level (1=debug, 4=error) |
| `t` | Toggle theme |
| `m` | Toggle metrics panel |
| `e` | Export logs |
| `c` | Clear logs |
| `?` | Show keyboard shortcuts |
| `Esc` | Close modals/clear selection |

### Export

Export logs via the UI or programmatically:

```typescript
// In browser console or via UI
// Supports JSON, CSV, and plain text formats
```

### Enhanced Error Display

Click on an error to see full details:

```
+--------------------------------------------------------------+
| ERROR  [OrderService]              +150ms  <- order.ts:45    |
+--------------------------------------------------------------+
| Order processing failed                                       |
|                                                               |
| Source: order.service.ts:45:12 -> processOrder()             |
|                                                               |
| BREADCRUMBS (what happened before)                 last 180ms |
|  +- 14:32:05.720  DEBUG  Validating inventory                |
|  +- 14:32:05.750  DEBUG  Calculating totals                  |
|  +- 14:32:05.850  DEBUG  Processing payment                  |
|                                                               |
| STACK TRACE                                   [Copy] [Raw]    |
|  > OrderService.processOrder    order.service.ts:45:12       |
|    OrderController.create       order.controller.ts:28       |
|    ... 5 more frames (node_modules)          [expand]        |
+--------------------------------------------------------------+
```

## CLI

```bash
# Clear all logs
npx dev-log-monitor clear

# Show log storage status
npx dev-log-monitor status

# Help
npx dev-log-monitor help
```

## API Reference

### Auto-Integration

| Export | Description |
|--------|-------------|
| `import 'dev-log-monitor/auto'` | One-line auto-integration |
| `autoInit(config)` | Configure and initialize manually |
| `configureMasking(config)` | Configure sensitive data masking |
| `wrapLogger(logger, type?)` | Wrap existing logger |
| `asyncContext` | Request context manager |
| `getTraceId()` | Get current trace ID |
| `getRequestId()` | Get current request ID |
| `expressContextMiddleware()` | Express middleware for context |
| `DevLogContextInterceptor` | NestJS interceptor for context |

### Alerting

| Export | Description |
|--------|-------------|
| `addAlertRule(rule)` | Add custom alert rule |
| `removeAlertRule(name)` | Remove alert rule |
| `addWebhook(config)` | Add webhook endpoint |
| `removeWebhook(url)` | Remove webhook |

### Metrics

| Export | Description |
|--------|-------------|
| `getMetrics()` | Get current metrics snapshot |
| `onMetricsUpdate(callback)` | Subscribe to metrics updates |

### Core Logger

| Method | Description |
|--------|-------------|
| `devLogger.init(config?)` | Initialize manually (not needed with /auto) |
| `devLogger.debug(message, metadata?)` | Log debug message |
| `devLogger.info(message, metadata?)` | Log info message |
| `devLogger.warn(message, metadata?)` | Log warning message |
| `devLogger.error(message, metadata?)` | Log error message |
| `devLogger.create(context, source?)` | Create scoped logger |
| `devLogger.nest()` | Get NestJS adapter |
| `devLogger.express()` | Get Express middleware |
| `devLogger.shutdown()` | Gracefully shutdown |

### Scoped Logger

| Method | Description |
|--------|-------------|
| `logger.debug(message, metadata?)` | Log debug with context |
| `logger.info(message, metadata?)` | Log info with context |
| `logger.warn(message, metadata?)` | Log warning with context |
| `logger.error(message, metadata?)` | Log error with context |
| `logger.startTimer(operation)` | Start operation timer |

## Log Storage

Logs are stored in `.dev-log/` directory in JSONL format.
Files are named by date: `logs-YYYY-MM-DD.jsonl`.

Add to your `.gitignore`:

```
.dev-log/
```

## Requirements

- Node.js >= 18.0.0
- TypeScript (optional, but recommended)

## Peer Dependencies (Optional)

- `@nestjs/common` >= 9.0.0 (for NestJS adapter)
- `express` >= 4.0.0 (for Express middleware)

## Migration from v0.0.x

If you were using the manual integration:

```typescript
// Before (v0.0.x)
import { devLogger } from 'dev-log-monitor';
await devLogger.init({ port: 3333 });
devLogger.info('Hello');

// After (v0.1.x) - Option 1: Auto-integration (recommended)
import 'dev-log-monitor/auto';
console.log('Hello');  // Automatically captured!

// After (v0.1.x) - Option 2: Keep using devLogger directly
import 'dev-log-monitor/auto';
import { devLogger } from 'dev-log-monitor';
devLogger.info('Hello');  // No need to call init()
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
