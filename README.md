<p align="center">
  <img src="https://img.shields.io/npm/v/dev-log-monitor.svg?style=flat-square&color=D6BD98&labelColor=1A3636" alt="npm version">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square&labelColor=1A3636" alt="License: MIT">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-677D6A?style=flat-square&labelColor=1A3636" alt="Node >= 18">
  <img src="https://img.shields.io/badge/dependencies-0-40534C?style=flat-square&labelColor=1A3636" alt="Zero Dependencies">
  <img src="https://img.shields.io/npm/dm/dev-log-monitor.svg?style=flat-square&color=D6BD98&labelColor=1A3636" alt="Downloads">
</p>

<h1 align="center">dev-log-monitor</h1>

<p align="center">
  <strong>Your existing logger + console.log(), but finally usable.</strong><br>
  <sub>Real-time web UI &bull; Error tracing &bull; Breadcrumbs &bull; Data masking &bull; Zero dependencies</sub>
</p>

<p align="center">
  <a href="https://littleboy9.github.io/dev-log-monitor/">Website</a> &nbsp;&bull;&nbsp;
  <a href="https://www.npmjs.com/package/dev-log-monitor">npm</a> &nbsp;&bull;&nbsp;
  <a href="https://github.com/LittleBoy9/dev-log-monitor/issues">Issues</a>
</p>

<br>

---

## Quick Start

```bash
npm install dev-log-monitor
```

```typescript
// Add this ONE LINE at the top of your entry file
import 'dev-log-monitor/auto';

// That's it. Open http://localhost:3333
console.log('This will appear in the dev-log UI!');
```

> Auto-disables in production (`NODE_ENV=production`). Zero config needed.

---

## Why dev-log-monitor?

| Problem | Solution |
|---------|----------|
| "Which console.log printed this?" | Source location tracking (`file:line -> function()`) |
| "What happened before the crash?" | Breadcrumbs - last 10 logs before any error |
| "I can't read these stack traces" | Parsed & highlighted - your code vs node_modules |
| "Logs are flying by too fast" | Real-time web UI with filtering, search, and export |
| "Sensitive data in logs" | Auto-masks passwords, tokens, cards, SSNs (72+ fields) |
| "Different loggers everywhere" | Works with console, Winston, Pino, Bunyan, or custom |

---

## Features

<table>
<tr>
<td width="50%">

**One-Line Integration**<br>
<code>import 'dev-log-monitor/auto'</code> intercepts all console methods, starts the UI, and enables masking.

**Real-Time Web UI**<br>
Beautiful log viewer at `localhost:3333` with WebSocket live updates, dark/light themes, and vim-style keyboard shortcuts.

**Source Location**<br>
Every log shows file, line, column, and function name. No more guessing.

**Breadcrumbs**<br>
See the last 10 logs before any error. Full context for every crash.

</td>
<td width="50%">

**Sensitive Data Masking**<br>
Auto-redacts passwords, tokens, API keys, credit cards, SSNs. Add custom patterns too.

**Timing & Metrics**<br>
Timing deltas between logs, operation timers, error rates, and throughput tracking.

**Parsed Stack Traces**<br>
App code highlighted, node_modules collapsed. Copy or expand with one click.

**Alerts & Webhooks**<br>
Get notified on error spikes, pattern matches, or slow operations.

</td>
</tr>
</table>

---

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
    logger: devLogger.nest(),
  });
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
  }
}
```

### Express

```typescript
import 'dev-log-monitor/auto';
import express from 'express';
import { expressContextMiddleware } from 'dev-log-monitor';

const app = express();
app.use(expressContextMiddleware());

app.get('/api/users', (req, res) => {
  console.log('Fetching users');  // Automatically captured!
  res.json({ users: [] });
});

app.listen(3000);
```

### Winston / Pino / Bunyan

```typescript
import 'dev-log-monitor/auto';
import { wrapLogger } from 'dev-log-monitor';

// Winston
import winston from 'winston';
const winstonLogger = winston.createLogger({ level: 'info', transports: [new winston.transports.Console()] });
const logger = wrapLogger(winstonLogger, 'winston');

// Pino
import pino from 'pino';
const pinoLogger = wrapLogger(pino(), 'pino');

// Bunyan
import bunyan from 'bunyan';
const bunyanLogger = wrapLogger(bunyan.createLogger({ name: 'myapp' }), 'bunyan');
```

### Plain Node.js

```typescript
import 'dev-log-monitor/auto';

// All console calls are now captured
console.log('Application started');
console.warn('Cache miss', { key: 'user:123' });
console.error('Database connection failed');

// Or use the devLogger directly
import { devLogger } from 'dev-log-monitor';
devLogger.info('Direct log', { data: 'value' });
```

---

## Configuration

All config via environment variables - no config files needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_LOG_PORT` | `3333` | Web UI port |
| `DEV_LOG_DIR` | `.dev-log` | Log storage directory |
| `DEV_LOG_RETENTION` | `3` | Days to keep logs |
| `DEV_LOG_CONSOLE` | `true` | Also print to console |
| `DEV_LOG_INTERCEPT` | `true` | Intercept console.log calls |
| `DEV_LOG_MASKING` | `true` | Auto-mask sensitive data |
| `DEV_LOG_STORAGE_LEVEL` | `debug` | Minimum level to persist |
| `DEV_LOG_DISABLE` | `false` | Disable entirely |

Or configure programmatically:

```typescript
import { autoInit } from 'dev-log-monitor';

await autoInit({
  port: 3333,
  logDir: '.dev-log',
  retentionDays: 3,
  consoleOutput: true,
  interceptConsole: true,
  storageLevel: 'debug',
  maxFileSize: 50 * 1024 * 1024,
  maxTotalSize: 100 * 1024 * 1024,
});
```

---

## Web UI

Open `http://localhost:3333` after adding the import.

**Keyboard Shortcuts:**

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `/` | Focus search | `t` | Toggle theme |
| `j/k` | Next/prev log | `m` | Toggle metrics |
| `Enter` | Expand/collapse | `e` | Export logs |
| `1-4` | Filter by level | `c` | Clear logs |
| `?` | Show shortcuts | `Esc` | Close/clear |

**Error details** show source location, breadcrumbs (last 10 logs before the error), and parsed stack traces with your app code highlighted.

---

## Request Context & Correlation

```typescript
import { asyncContext, getTraceId } from 'dev-log-monitor';

asyncContext.run(() => {
  console.log('Start processing');  // auto-assigned traceId
  someAsyncOperation().then(() => {
    console.log('Done processing');  // same traceId
  });
}, { method: 'GET', path: '/api/users' });
```

---

## Alerting

```typescript
import { addAlertRule, addWebhook } from 'dev-log-monitor';

addWebhook('slack', { url: 'https://hooks.slack.com/services/xxx', method: 'POST' });

addAlertRule({
  id: 'high-error-rate',
  name: 'High Error Rate',
  condition: { type: 'error_rate', threshold: 5 },
  handlers: ['webhook:slack', 'console'],
  cooldownMs: 60_000,
});
```

---

## Sensitive Data Masking

```typescript
import { configureMasking } from 'dev-log-monitor';

configureMasking({
  enabled: true,
  sensitiveKeys: ['myCustomSecret'],
  customPatterns: [
    { name: 'order-id', pattern: /ORDER-\d{6,}/g, replacement: 'ORDER-[REDACTED]' },
  ],
  fullMask: false,
  maskChar: '*',
});
```

> Built-in: `password`, `token`, `apiKey`, `authorization`, `ssn`, `creditCard`, `cvv`, `pin`, and 50+ more.

---

## API Reference

<details>
<summary><strong>Auto-Integration</strong></summary>

| Export | Description |
|--------|-------------|
| `import 'dev-log-monitor/auto'` | One-line auto-integration |
| `autoInit(config)` | Configure and initialize manually |
| `configureMasking(options)` | Configure sensitive data masking |
| `wrapLogger(logger, type?)` | Wrap existing logger |
| `asyncContext` | Request context manager |
| `getTraceId()` | Get current trace ID |
| `getRequestId()` | Get current request ID |
| `expressContextMiddleware()` | Express middleware for context |
| `DevLogContextInterceptor` | NestJS interceptor for context |

</details>

<details>
<summary><strong>Alerting</strong></summary>

| Export | Description |
|--------|-------------|
| `addAlertRule(rule)` | Add custom alert rule |
| `addWebhook(name, config)` | Add named webhook endpoint |
| `configureAlerts(config)` | Configure alerts with rules and webhooks |

</details>

<details>
<summary><strong>Metrics</strong></summary>

| Export | Description |
|--------|-------------|
| `getMetrics()` | Get current metrics snapshot |
| `onMetricsUpdate(callback)` | Subscribe to metrics updates (returns unsubscribe fn) |

</details>

<details>
<summary><strong>Core Logger</strong></summary>

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

</details>

<details>
<summary><strong>Scoped Logger</strong></summary>

| Method | Description |
|--------|-------------|
| `logger.debug(message, metadata?)` | Log debug with context |
| `logger.info(message, metadata?)` | Log info with context |
| `logger.warn(message, metadata?)` | Log warning with context |
| `logger.error(message, metadata?)` | Log error with context |
| `logger.startTimer(operation)` | Start operation timer |

</details>

---

## CLI

```bash
npx dev-log-monitor clear    # Clear all logs
npx dev-log-monitor status   # Show storage status
npx dev-log-monitor help     # Help
```

---

## Log Storage

Logs are stored in `.dev-log/` in JSONL format, named by date (`logs-YYYY-MM-DD.jsonl`).

Add to `.gitignore`:
```
.dev-log/
```

## Requirements

- **Node.js** >= 18.0.0
- **TypeScript** optional, but recommended
- **Peer deps** (optional): `@nestjs/common` >= 9.0.0, `express` >= 4.0.0

---

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request at [GitHub](https://github.com/LittleBoy9/dev-log-monitor).
