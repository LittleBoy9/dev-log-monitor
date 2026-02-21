/**
 * Logger Wrappers for Popular Logging Libraries
 * Automatically intercept winston, pino, bunyan, and custom loggers
 */

import { devLogger } from '../core/logger';
import { asyncContext } from './async-context';
import { masker } from './masking';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerWrapper {
  name: string;
  wrap: (logger: any) => any;
  unwrap?: () => void;
}

const wrappers: Map<string, LoggerWrapper> = new Map();
const wrappedLoggers: WeakSet<any> = new WeakSet();

/**
 * Generic function to forward logs to dev-log
 */
function forwardToDevLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
  source = 'custom'
): void {
  if (!devLogger.isInitialized()) return;

  const ctx = asyncContext.getContext();
  const maskedMetadata = metadata ? masker.mask(metadata) as Record<string, unknown> : undefined;

  try {
    (devLogger as any)._logFromWrapper(level, message, source, undefined, maskedMetadata, {
      traceId: ctx?.traceId,
      requestId: ctx?.requestId,
    });
  } catch {
    // Silently ignore
  }
}

/**
 * Winston Wrapper
 */
const winstonWrapper: LoggerWrapper = {
  name: 'winston',
  wrap: (logger: any) => {
    if (wrappedLoggers.has(logger)) return logger;

    const originalLog = logger.log.bind(logger);

    logger.log = function (levelOrInfo: any, message?: any, ...meta: any[]) {
      // Handle both winston 2.x and 3.x APIs
      let level: string;
      let msg: string;
      let metadata: Record<string, unknown> | undefined;

      if (typeof levelOrInfo === 'object') {
        // Winston 3.x format: { level, message, ...metadata }
        level = levelOrInfo.level;
        msg = levelOrInfo.message;
        const { level: _l, message: _m, ...rest } = levelOrInfo;
        metadata = Object.keys(rest).length > 0 ? rest : undefined;
      } else {
        // Winston 2.x format: level, message, metadata
        level = levelOrInfo;
        msg = message;
        metadata = meta[0] && typeof meta[0] === 'object' ? meta[0] : undefined;
      }

      // Map winston levels to our levels
      const levelMap: Record<string, LogLevel> = {
        silly: 'debug',
        debug: 'debug',
        verbose: 'debug',
        info: 'info',
        warn: 'warn',
        warning: 'warn',
        error: 'error',
      };

      const mappedLevel = levelMap[level] || 'info';
      forwardToDevLog(mappedLevel, msg, metadata, 'winston');

      return originalLog(levelOrInfo, message, ...meta);
    };

    // Also wrap convenience methods
    ['debug', 'info', 'warn', 'error', 'verbose', 'silly'].forEach(level => {
      if (typeof logger[level] === 'function') {
        const original = logger[level].bind(logger);
        logger[level] = function (message: any, ...meta: any[]) {
          const levelMap: Record<string, LogLevel> = {
            silly: 'debug',
            debug: 'debug',
            verbose: 'debug',
            info: 'info',
            warn: 'warn',
            error: 'error',
          };
          const mappedLevel = levelMap[level] || 'info';
          const metadata = meta[0] && typeof meta[0] === 'object' ? meta[0] : undefined;
          forwardToDevLog(mappedLevel, String(message), metadata, 'winston');
          return original(message, ...meta);
        };
      }
    });

    wrappedLoggers.add(logger);
    return logger;
  },
};

/**
 * Pino Wrapper
 */
const pinoWrapper: LoggerWrapper = {
  name: 'pino',
  wrap: (logger: any) => {
    if (wrappedLoggers.has(logger)) return logger;

    const levels: Array<{ name: string; mapped: LogLevel }> = [
      { name: 'trace', mapped: 'debug' },
      { name: 'debug', mapped: 'debug' },
      { name: 'info', mapped: 'info' },
      { name: 'warn', mapped: 'warn' },
      { name: 'error', mapped: 'error' },
      { name: 'fatal', mapped: 'error' },
    ];

    levels.forEach(({ name, mapped }) => {
      if (typeof logger[name] === 'function') {
        const original = logger[name].bind(logger);
        logger[name] = function (...args: any[]) {
          // Pino supports: logger.info(obj, msg), logger.info(msg), logger.info(msg, ...interpolation)
          let message: string;
          let metadata: Record<string, unknown> | undefined;

          if (args.length === 0) {
            message = '';
          } else if (typeof args[0] === 'object' && args[0] !== null) {
            metadata = args[0];
            message = args[1] || '';
          } else {
            message = String(args[0]);
            if (args.length > 1) {
              // Interpolation values
              message = message.replace(/%[sdjo]/g, () => String(args.shift() || ''));
            }
          }

          forwardToDevLog(mapped, message, metadata, 'pino');
          return original(...args);
        };
      }
    });

    // Handle child loggers
    if (typeof logger.child === 'function') {
      const originalChild = logger.child.bind(logger);
      logger.child = function (bindings: any) {
        const child = originalChild(bindings);
        return pinoWrapper.wrap(child);
      };
    }

    wrappedLoggers.add(logger);
    return logger;
  },
};

/**
 * Bunyan Wrapper
 */
const bunyanWrapper: LoggerWrapper = {
  name: 'bunyan',
  wrap: (logger: any) => {
    if (wrappedLoggers.has(logger)) return logger;

    const levels: Array<{ name: string; mapped: LogLevel }> = [
      { name: 'trace', mapped: 'debug' },
      { name: 'debug', mapped: 'debug' },
      { name: 'info', mapped: 'info' },
      { name: 'warn', mapped: 'warn' },
      { name: 'error', mapped: 'error' },
      { name: 'fatal', mapped: 'error' },
    ];

    levels.forEach(({ name, mapped }) => {
      if (typeof logger[name] === 'function') {
        const original = logger[name].bind(logger);
        logger[name] = function (...args: any[]) {
          // Bunyan: logger.info(obj, msg), logger.info(msg), logger.info(err, msg)
          let message: string;
          let metadata: Record<string, unknown> | undefined;

          if (args[0] instanceof Error) {
            metadata = {
              error: args[0].message,
              stack: args[0].stack,
            };
            message = args[1] || args[0].message;
          } else if (typeof args[0] === 'object' && args[0] !== null) {
            metadata = args[0];
            message = args[1] || '';
          } else {
            message = args.map(String).join(' ');
          }

          forwardToDevLog(mapped, message, metadata, 'bunyan');
          return original(...args);
        };
      }
    });

    // Handle child loggers
    if (typeof logger.child === 'function') {
      const originalChild = logger.child.bind(logger);
      logger.child = function (options: any) {
        const child = originalChild(options);
        return bunyanWrapper.wrap(child);
      };
    }

    wrappedLoggers.add(logger);
    return logger;
  },
};

/**
 * Console Logger Wrapper (for custom console-style loggers)
 */
const consoleStyleWrapper: LoggerWrapper = {
  name: 'console-style',
  wrap: (logger: any) => {
    if (wrappedLoggers.has(logger)) return logger;

    const methodMappings: Array<{ methods: string[]; level: LogLevel }> = [
      { methods: ['debug', 'trace', 'verbose'], level: 'debug' },
      { methods: ['info', 'log'], level: 'info' },
      { methods: ['warn', 'warning'], level: 'warn' },
      { methods: ['error', 'fatal', 'critical'], level: 'error' },
    ];

    methodMappings.forEach(({ methods, level }) => {
      methods.forEach(method => {
        if (typeof logger[method] === 'function') {
          const original = logger[method].bind(logger);
          logger[method] = function (...args: any[]) {
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            const metadata = args.find(arg => typeof arg === 'object' && arg !== null);
            forwardToDevLog(level, message, metadata, 'custom');
            return original(...args);
          };
        }
      });
    });

    wrappedLoggers.add(logger);
    return logger;
  },
};

// Register built-in wrappers
wrappers.set('winston', winstonWrapper);
wrappers.set('pino', pinoWrapper);
wrappers.set('bunyan', bunyanWrapper);
wrappers.set('console-style', consoleStyleWrapper);

/**
 * Wrap any logger
 */
export function wrapLogger(logger: any, type?: 'winston' | 'pino' | 'bunyan' | 'console-style' | 'auto'): any {
  if (!logger) return logger;

  // Auto-detect logger type
  const detectedType = type === 'auto' || !type ? detectLoggerType(logger) : type;

  if (!detectedType) {
    // Fall back to console-style wrapper
    return consoleStyleWrapper.wrap(logger);
  }

  const wrapper = wrappers.get(detectedType);
  if (wrapper) {
    return wrapper.wrap(logger);
  }

  return logger;
}

/**
 * Detect logger type by duck typing
 */
function detectLoggerType(logger: any): string | null {
  if (!logger) return null;

  // Winston: has transports array and log method
  if (logger.transports && Array.isArray(logger.transports) && typeof logger.log === 'function') {
    return 'winston';
  }

  // Pino: has specific pino properties
  if (logger.bindings && typeof logger.bindings === 'function' && logger.level) {
    return 'pino';
  }

  // Bunyan: has streams array and _level
  if (logger.streams && Array.isArray(logger.streams) && typeof logger._level !== 'undefined') {
    return 'bunyan';
  }

  // Generic console-style logger
  if (typeof logger.info === 'function' || typeof logger.log === 'function') {
    return 'console-style';
  }

  return null;
}

/**
 * Register a custom logger wrapper
 */
export function registerWrapper(name: string, wrapper: LoggerWrapper): void {
  wrappers.set(name, wrapper);
}

/**
 * Create a dev-log compatible logger from scratch
 */
export function createLogger(context?: string) {
  return devLogger.create(context || 'app', 'custom');
}

/**
 * Try to auto-wrap a module's default export
 */
export function autoWrapModule(moduleName: string): void {
  try {
    const mod = require(moduleName);
    const logger = mod.default || mod;

    if (logger && typeof logger === 'object') {
      wrapLogger(logger, 'auto');
    }
  } catch {
    // Module not installed, ignore
  }
}
