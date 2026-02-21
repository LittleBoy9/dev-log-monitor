/**
 * Auto Integration Module
 *
 * One-line integration for dev-log-monitor:
 *
 * ```typescript
 * import 'dev-log-monitor/auto';
 * ```
 *
 * That's it! All your console.log, console.error, etc. calls
 * will now appear in the dev-log UI at http://localhost:3333
 */

import { devLogger } from '../core/logger';
import { interceptConsole, restoreConsole } from './console-interceptor';
import { asyncContext, expressContextMiddleware, DevLogContextInterceptor } from './async-context';
import { masker, configureMasking, MaskingOptions } from './masking';
import { wrapLogger, createLogger, registerWrapper } from './logger-wrappers';
import { metrics, MetricsConfig } from './metrics';
import { alerts, AlertsConfig, addAlertRule, addWebhook, AlertRule, WebhookConfig } from './alerts';
import { LogEntry } from '../core/log-entry';
import { StorageLevel } from '../core/config';

export interface AutoConfig {
  /** Port for the web UI (default: 3333) */
  port?: number;
  /** Enable console interception (default: true) */
  interceptConsole?: boolean;
  /** Enable sensitive data masking (default: true) */
  masking?: boolean | MaskingOptions;
  /** Metrics configuration */
  metrics?: MetricsConfig;
  /** Alerts configuration */
  alerts?: AlertsConfig;
  /** Also log to console (default: true) */
  consoleOutput?: boolean;
  /** Log retention days (default: 3) */
  retentionDays?: number;
  /** Log directory (default: .dev-log) */
  logDir?: string;
  /** Automatically wrap popular loggers (default: true) */
  autoWrapLoggers?: boolean;
  /** Max size per daily log file in bytes (default: 50MB) */
  maxFileSize?: number;
  /** Max total size of all log files in bytes (default: 100MB) */
  maxTotalSize?: number;
  /** Minimum log level to persist to disk (default: 'debug') */
  storageLevel?: StorageLevel;
  /** Max metadata JSON size per entry in bytes (default: 4096) */
  maxMetadataSize?: number;
  /** Max parsed stack frames per entry (default: 20) */
  maxStackFrames?: number;
}

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Promise that resolves when auto-init is complete
 * Use: await ready; before logging if you need guaranteed initialization
 */
export let ready: Promise<void> = Promise.resolve();

/**
 * Initialize dev-log with auto-integration features
 */
async function autoInit(config: AutoConfig = {}): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  // Configure core logger - only pass defined values to avoid overriding defaults
  const initConfig: Parameters<typeof devLogger.init>[0] = {
    consoleOutput: config.consoleOutput ?? true,
  };
  if (config.port !== undefined) initConfig.port = config.port;
  if (config.retentionDays !== undefined) initConfig.retentionDays = config.retentionDays;
  if (config.logDir !== undefined) initConfig.logDir = config.logDir;
  if (config.maxFileSize !== undefined) initConfig.maxFileSize = config.maxFileSize;
  if (config.maxTotalSize !== undefined) initConfig.maxTotalSize = config.maxTotalSize;
  if (config.storageLevel !== undefined) initConfig.storageLevel = config.storageLevel;
  if (config.maxMetadataSize !== undefined) initConfig.maxMetadataSize = config.maxMetadataSize;
  if (config.maxStackFrames !== undefined) initConfig.maxStackFrames = config.maxStackFrames;

  await devLogger.init(initConfig);

  // Enable console interception
  if (config.interceptConsole !== false) {
    interceptConsole();
  }

  // Configure masking
  if (config.masking !== false) {
    if (typeof config.masking === 'object') {
      configureMasking(config.masking);
    }
  } else {
    masker.disable();
  }

  // Configure metrics
  if (config.metrics) {
    metrics.configure(config.metrics);
  }

  // Subscribe to metrics for alerts
  metrics.subscribe((snapshot) => {
    alerts.checkMetrics(snapshot);
  });

  // Configure alerts
  if (config.alerts) {
    alerts.configure(config.alerts);
  }

  // Hook into logger to feed metrics and alerts
  devLogger.subscribe((entry: LogEntry) => {
    // Record metrics
    metrics.recordLog(entry.level, entry.message, entry.context);

    // Check operation duration
    if (entry.metadata?.duration && typeof entry.metadata.duration === 'number') {
      metrics.recordOperation(
        entry.metadata.operation as string || 'unknown',
        entry.metadata.duration
      );
    }

    // Check alerts
    alerts.checkEntry(entry);
  });

  initialized = true;
}

/**
 * Shutdown and cleanup
 */
async function autoShutdown(): Promise<void> {
  restoreConsole();
  await devLogger.shutdown();
  initialized = false;
}

/**
 * Check if auto-init has been called
 */
function isAutoInitialized(): boolean {
  return initialized;
}

// Export everything needed for advanced usage
export {
  // Core
  devLogger,
  autoInit,
  autoShutdown,
  isAutoInitialized,

  // Context
  asyncContext,
  expressContextMiddleware,
  DevLogContextInterceptor,

  // Masking
  masker,
  configureMasking,

  // Logger wrapping
  wrapLogger,
  createLogger,
  registerWrapper,

  // Metrics
  metrics,

  // Alerts
  alerts,
  addAlertRule,
  addWebhook,

  // Console control
  interceptConsole,
  restoreConsole,
};

export type { MaskingOptions, MetricsConfig, AlertsConfig, AlertRule, WebhookConfig };

// Auto-initialize when this module is imported
// This makes `import 'dev-log-monitor/auto'` work as a one-liner
ready = (async () => {
  // Only auto-init in development
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // Check for explicit disable
  if (process.env.DEV_LOG_DISABLE === 'true') {
    return;
  }

  // Suppress warnings during auto-init
  devLogger.suppressWarnings(true);

  try {
    const envConfig: AutoConfig = {
      port: parseInt(process.env.DEV_LOG_PORT || '3333', 10),
      interceptConsole: process.env.DEV_LOG_INTERCEPT !== 'false',
      masking: process.env.DEV_LOG_MASKING !== 'false',
    };
    if (process.env.DEV_LOG_RETENTION) envConfig.retentionDays = parseInt(process.env.DEV_LOG_RETENTION, 10);
    if (process.env.DEV_LOG_DIR) envConfig.logDir = process.env.DEV_LOG_DIR;
    if (process.env.DEV_LOG_MAX_FILE_SIZE) envConfig.maxFileSize = parseInt(process.env.DEV_LOG_MAX_FILE_SIZE, 10);
    if (process.env.DEV_LOG_MAX_TOTAL_SIZE) envConfig.maxTotalSize = parseInt(process.env.DEV_LOG_MAX_TOTAL_SIZE, 10);
    if (process.env.DEV_LOG_STORAGE_LEVEL) envConfig.storageLevel = process.env.DEV_LOG_STORAGE_LEVEL as StorageLevel;

    initPromise = autoInit(envConfig);
    await initPromise;
  } catch (error) {
    // Don't crash the app if dev-log fails to init
    console.warn('[dev-log] Auto-init failed:', error);
  } finally {
    devLogger.suppressWarnings(false);
  }
})();
