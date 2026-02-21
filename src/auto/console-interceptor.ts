/**
 * Console Interceptor - Captures all console.log/warn/error/debug calls
 * This allows dev-log to work with any existing code without changes
 */

import { devLogger } from '../core/logger';
import { getCallerInfo } from '../utils/source-location';
import { asyncContext } from './async-context';

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

let intercepted = false;
let isLogging = false;  // Reentrant guard to prevent infinite loops

/**
 * Format console arguments to a single message string
 */
function formatArgs(args: unknown[]): { message: string; metadata?: Record<string, unknown> } {
  if (args.length === 0) {
    return { message: '' };
  }

  // If first arg is a string, use it as message
  if (typeof args[0] === 'string') {
    const message = args[0];

    // If there are more args, treat them as metadata
    if (args.length > 1) {
      const metadata: Record<string, unknown> = {};
      args.slice(1).forEach((arg, index) => {
        if (arg && typeof arg === 'object' && !(arg instanceof Error)) {
          Object.assign(metadata, arg);
        } else if (arg instanceof Error) {
          metadata.error = {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
          };
        } else {
          metadata[`arg${index + 1}`] = arg;
        }
      });
      return { message, metadata: Object.keys(metadata).length > 0 ? metadata : undefined };
    }

    return { message };
  }

  // If first arg is an object/Error, stringify it
  if (args[0] instanceof Error) {
    const error = args[0];
    return {
      message: error.message,
      metadata: { stack: error.stack, errorName: error.name },
    };
  }

  if (typeof args[0] === 'object') {
    return {
      message: JSON.stringify(args[0]),
      metadata: args[0] as Record<string, unknown>,
    };
  }

  // Fallback: stringify everything
  return { message: args.map(String).join(' ') };
}

/**
 * Create an intercepted console method
 */
function createInterceptor(
  level: 'debug' | 'info' | 'warn' | 'error',
  original: (...args: unknown[]) => void
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    // Prevent infinite loops with reentrant guard
    if (isLogging) {
      return original(...args);
    }

    isLogging = true;
    try {
      const { message, metadata } = formatArgs(args);

      // Get async context if available
      const ctx = asyncContext.getContext();

      // Log to dev-log
      if (devLogger.isInitialized()) {
        devLogger._logFromConsole(level, message, metadata, {
          traceId: ctx?.traceId,
          requestId: ctx?.requestId,
          skipFrames: 5,
        });
      }

      // Also call original console method
      original(...args);
    } catch {
      // Silently ignore errors to not break user's code
      original(...args);
    } finally {
      isLogging = false;
    }
  };
}

/**
 * Start intercepting console methods
 */
export function interceptConsole(): void {
  if (intercepted) return;

  console.log = createInterceptor('info', originalConsole.log);
  console.info = createInterceptor('info', originalConsole.info);
  console.warn = createInterceptor('warn', originalConsole.warn);
  console.error = createInterceptor('error', originalConsole.error);
  console.debug = createInterceptor('debug', originalConsole.debug);

  intercepted = true;
}

/**
 * Stop intercepting and restore original console methods
 */
export function restoreConsole(): void {
  if (!intercepted) return;

  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;

  intercepted = false;
}

/**
 * Check if console is currently being intercepted
 */
export function isIntercepted(): boolean {
  return intercepted;
}

/**
 * Get original console methods (for internal use)
 */
export function getOriginalConsole() {
  return originalConsole;
}
