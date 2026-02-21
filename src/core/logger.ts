import { randomUUID } from 'crypto';
import { LogEntry, LogLevel, LogSource } from './log-entry';
import { DevLogConfig, getConfig, setConfig } from './config';
import { JsonlStorage } from '../storage/jsonl-storage';
import { DevLogServer } from '../server/server';
import { getCallerInfo, setProjectRoot } from '../utils/source-location';
import { parseStack } from '../utils/stack-parser';
import { breadcrumbs } from '../utils/breadcrumbs';
import { timing, createTimer } from '../utils/timing';

type LogCallback = (entry: LogEntry) => void;

/** Timer returned by startTimer for measuring operation duration */
export interface OperationTimer {
  /** Get elapsed time in milliseconds */
  elapsed(): number;
  /** End the timer and log the duration */
  end(metadata?: Record<string, unknown>): void;
}

export interface ScopedLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  log(message: string, metadata?: Record<string, unknown>): void;
  /** Start a timer for measuring operation duration */
  startTimer(operation: string): OperationTimer;
}

/** Options for creating a scoped logger */
export interface ScopedLoggerOptions {
  traceId?: string;
  spanId?: string;
}

class DevLogger {
  private static instance: DevLogger;
  private initialized = false;
  private storage: JsonlStorage | null = null;
  private server: DevLogServer | null = null;
  private subscribers: Set<LogCallback> = new Set();
  private _suppressWarnings = false;

  private constructor() {}

  /** Suppress "not initialized" warnings (used during auto-init) */
  suppressWarnings(suppress: boolean): void {
    this._suppressWarnings = suppress;
  }

  static getInstance(): DevLogger {
    if (!DevLogger.instance) {
      DevLogger.instance = new DevLogger();
    }
    return DevLogger.instance;
  }

  async init(config?: Partial<DevLogConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (config) {
      setConfig(config);
    }

    const currentConfig = getConfig();

    // Initialize timing and set project root for relative paths
    timing.reset();
    setProjectRoot(process.cwd());

    this.storage = new JsonlStorage({
      logDir: currentConfig.logDir,
      retentionDays: currentConfig.retentionDays,
      maxFileSize: currentConfig.maxFileSize,
      maxTotalSize: currentConfig.maxTotalSize,
      storageLevel: currentConfig.storageLevel,
      maxMetadataSize: currentConfig.maxMetadataSize,
      maxStackFrames: currentConfig.maxStackFrames,
    });
    await this.storage.init();

    this.server = new DevLogServer(currentConfig.port, this.storage);
    await this.server.start();

    this.subscribe((entry) => {
      this.server?.broadcast(entry);
    });

    this.initialized = true;

    const port = currentConfig.port;
    console.log(`\x1b[36m[dev-log]\x1b[0m UI available at \x1b[4mhttp://localhost:${port}\x1b[0m`);
  }

  async shutdown(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    if (this.storage) {
      this.storage.destroy();
      this.storage = null;
    }
    this.initialized = false;
    this.subscribers.clear();
  }

  subscribe(callback: LogCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(entry: LogEntry): void {
    for (const callback of this.subscribers) {
      try {
        callback(entry);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  private createEntry(
    level: LogLevel,
    message: string,
    source: LogSource,
    context?: string,
    metadata?: Record<string, unknown>,
    options?: { traceId?: string; spanId?: string; skipFrames?: number }
  ): LogEntry {
    const timestamp = new Date().toISOString();

    // Capture caller info (file, line, function)
    const caller = getCallerInfo(options?.skipFrames ?? 4);

    // Get timing information
    const timingInfo = timing.getTiming(context);

    const entry: LogEntry = {
      id: randomUUID(),
      timestamp,
      level,
      message,
      source,
      context,
      metadata,
      caller,
      timing: timingInfo,
      traceId: options?.traceId,
      spanId: options?.spanId,
    };

    // Handle stack trace from metadata
    if (metadata?.stack && typeof metadata.stack === 'string') {
      entry.stack = metadata.stack;
      entry.parsedStack = parseStack(metadata.stack)?.frames;
      delete entry.metadata?.stack;
    }

    // Handle Error objects
    if (metadata instanceof Error) {
      entry.stack = metadata.stack;
      entry.parsedStack = parseStack(metadata.stack)?.frames;
      entry.metadata = {
        errorName: metadata.name,
        errorMessage: metadata.message,
      };
    }

    // For errors, attach breadcrumbs (what happened before)
    if (level === 'error') {
      entry.breadcrumbs = breadcrumbs.getBreadcrumbs({
        traceId: options?.traceId,
        context,
        limit: 10,
      });
    }

    // Add this log to breadcrumb trail (for future errors)
    breadcrumbs.add({
      timestamp,
      level,
      message,
      context,
      caller,
      traceId: options?.traceId,
    });

    return entry;
  }

  private writeLog(entry: LogEntry): void {
    if (!this.initialized) {
      if (!this._suppressWarnings) {
        console.warn('[dev-log] Logger not initialized. Call devLogger.init() first.');
      }
      return;
    }

    // Skip console output for console-intercepted logs (they already print via original console)
    if (getConfig().consoleOutput && entry.source !== 'console') {
      this.printToConsole(entry);
    }

    // Storage.append() uses appendFileSync internally, so this is synchronous
    // despite the Promise<void> return type in the Storage interface.
    this.storage?.append(entry);
    this.notify(entry);
  }

  private printToConsole(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m',
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    };
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';
    const color = colors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextStr = entry.context ? `[${entry.context}] ` : '';

    // Format timing delta
    let timingStr = '';
    if (entry.timing && entry.timing.sinceLast > 0) {
      const delta = entry.timing.sinceLast;
      if (delta < 1000) {
        timingStr = ` ${dim}+${delta}ms${reset}`;
      } else {
        timingStr = ` ${dim}+${(delta / 1000).toFixed(1)}s${reset}`;
      }
    }

    // Format caller info
    let callerStr = '';
    if (entry.caller) {
      callerStr = ` ${dim}← ${entry.caller.file}:${entry.caller.line}${reset}`;
    }

    console.log(`${color}${levelStr}${reset} ${contextStr}${entry.message}${timingStr}${callerStr}`);

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`      ${dim}${JSON.stringify(entry.metadata)}${reset}`);
    }

    if (entry.stack) {
      console.log(`${color}${entry.stack}${reset}`);
    }
  }

  // Plain Node.js logging methods
  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createEntry('debug', message, 'node', undefined, metadata);
    this.writeLog(entry);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createEntry('info', message, 'node', undefined, metadata);
    this.writeLog(entry);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createEntry('warn', message, 'node', undefined, metadata);
    this.writeLog(entry);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createEntry('error', message, 'node', undefined, metadata);
    this.writeLog(entry);
  }

  log(message: string, metadata?: Record<string, unknown>): void {
    this.info(message, metadata);
  }

  // Create a scoped logger for a specific context
  create(context: string, source: LogSource = 'node', options?: ScopedLoggerOptions): ScopedLogger {
    const { traceId, spanId } = options || {};
    const self = this;

    return {
      debug: (message: string, metadata?: Record<string, unknown>) => {
        const entry = self.createEntry('debug', message, source, context, metadata, { traceId, spanId, skipFrames: 4 });
        self.writeLog(entry);
      },
      info: (message: string, metadata?: Record<string, unknown>) => {
        const entry = self.createEntry('info', message, source, context, metadata, { traceId, spanId, skipFrames: 4 });
        self.writeLog(entry);
      },
      warn: (message: string, metadata?: Record<string, unknown>) => {
        const entry = self.createEntry('warn', message, source, context, metadata, { traceId, spanId, skipFrames: 4 });
        self.writeLog(entry);
      },
      error: (message: string, metadata?: Record<string, unknown>) => {
        const entry = self.createEntry('error', message, source, context, metadata, { traceId, spanId, skipFrames: 4 });
        self.writeLog(entry);
      },
      log: (message: string, metadata?: Record<string, unknown>) => {
        const entry = self.createEntry('info', message, source, context, metadata, { traceId, spanId, skipFrames: 4 });
        self.writeLog(entry);
      },
      startTimer: (operation: string) => {
        const timer = createTimer();
        return {
          elapsed: () => timer.elapsed(),
          end: (metadata?: Record<string, unknown>) => {
            const duration = timer.elapsed();
            const entry = self.createEntry('info', `${operation} completed`, source, context, {
              ...metadata,
              operation,
              duration,
              durationFormatted: duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`,
            }, { traceId, spanId, skipFrames: 4 });
            self.writeLog(entry);
          },
        };
      },
    };
  }

  // Internal method for adapters to log entries
  _log(
    level: LogLevel,
    message: string,
    source: LogSource,
    context?: string,
    metadata?: Record<string, unknown>
  ): void {
    const entry = this.createEntry(level, message, source, context, metadata);
    this.writeLog(entry);
  }

  // Get NestJS adapter
  nest(): import('../adapters/nest.adapter').NestAdapter {
    // Dynamic import to avoid circular dependency issues
    const { NestAdapter } = require('../adapters/nest.adapter');
    return new NestAdapter(this);
  }

  // Get Express middleware
  express(): import('../adapters/express.adapter').ExpressMiddleware {
    const { createExpressMiddleware } = require('../adapters/express.adapter');
    return createExpressMiddleware(this);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Internal method for console interceptor
  _logFromConsole(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    options?: { traceId?: string; requestId?: string; skipFrames?: number }
  ): void {
    const entry = this.createEntry(
      level,
      message,
      'console' as LogSource,
      undefined,
      metadata,
      { traceId: options?.traceId, skipFrames: options?.skipFrames ?? 5 }
    );
    this.writeLog(entry);
  }

  // Internal method for logger wrappers (winston, pino, etc.)
  _logFromWrapper(
    level: LogLevel,
    message: string,
    source: LogSource,
    context?: string,
    metadata?: Record<string, unknown>,
    options?: { traceId?: string; requestId?: string }
  ): void {
    const entry = this.createEntry(level, message, source, context, metadata, {
      traceId: options?.traceId,
      skipFrames: 6,
    });
    this.writeLog(entry);
  }
}

export const devLogger = DevLogger.getInstance();
