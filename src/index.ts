// Main exports
export { devLogger } from './core/logger';
export type { ScopedLogger, ScopedLoggerOptions, OperationTimer } from './core/logger';
export type {
  LogEntry,
  LogLevel,
  LogSource,
  LogFilter,
  StackFrame,
  CallerInfo,
  TimingInfo,
  BreadcrumbEntry,
} from './core/log-entry';
export type { DevLogConfig, StorageLevel } from './core/config';

// Utilities
export { getCallerInfo, setProjectRoot } from './utils/source-location';
export { parseStack, getAppFrames, getPrimaryFrame } from './utils/stack-parser';
export type { ParsedStack } from './utils/stack-parser';
export { breadcrumbs } from './utils/breadcrumbs';
export { createTimer } from './utils/timing';

// NestJS adapter
export { NestAdapter, createNestLogger } from './adapters/nest.adapter';
export type { LoggerService } from './adapters/nest.adapter';

// Express adapter
export { createExpressMiddleware } from './adapters/express.adapter';
export type { ExpressMiddleware } from './adapters/express.adapter';

// Auto integration features (also available via 'dev-log-monitor/auto')
export { asyncContext, expressContextMiddleware, DevLogContextInterceptor } from './auto/async-context';
export type { RequestContext } from './auto/async-context';
export { masker, configureMasking, maskData } from './auto/masking';
export type { MaskingOptions } from './auto/masking';
export { wrapLogger, createLogger, registerWrapper } from './auto/logger-wrappers';
export { metrics } from './auto/metrics';
export type { MetricsSnapshot, MetricsConfig } from './auto/metrics';
export { alerts, configureAlerts, addAlertRule, addWebhook } from './auto/alerts';
export type { AlertsConfig, AlertRule, WebhookConfig, Alert, AlertCondition } from './auto/alerts';

// Re-export auto init for programmatic use
export { autoInit } from './auto/index';

// Convenience helpers
import { asyncContext as _asyncContext } from './auto/async-context';
import { metrics as _metrics } from './auto/metrics';

/** Get current trace ID from async context */
export function getTraceId(): string | undefined {
  return _asyncContext.getTraceId();
}

/** Get current request ID from async context */
export function getRequestId(): string | undefined {
  return _asyncContext.getRequestId();
}

/** Get current metrics snapshot */
export function getMetrics() {
  return _metrics.getSnapshot();
}

/** Subscribe to metrics updates */
export function onMetricsUpdate(callback: (snapshot: import('./auto/metrics').MetricsSnapshot) => void) {
  return _metrics.subscribe(callback);
}

// Default export for convenience
import { devLogger } from './core/logger';
export default devLogger;
