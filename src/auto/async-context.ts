/**
 * AsyncLocalStorage-based context tracking
 * Automatically correlates logs within the same request/operation
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  /** Unique trace ID for the entire request */
  traceId: string;
  /** Shorter request ID */
  requestId: string;
  /** Request start time */
  startTime: number;
  /** HTTP method (if applicable) */
  method?: string;
  /** Request path (if applicable) */
  path?: string;
  /** User ID (if set) */
  userId?: string | number;
  /** Additional custom context */
  custom?: Record<string, unknown>;
}

class AsyncContext {
  private storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function within a request context
   * All async operations within this function will have access to the context
   */
  run<T>(callback: () => T, context?: Partial<RequestContext>): T {
    const ctx: RequestContext = {
      traceId: context?.traceId || randomUUID(),
      requestId: context?.requestId || this.generateShortId(),
      startTime: context?.startTime || Date.now(),
      method: context?.method,
      path: context?.path,
      userId: context?.userId,
      custom: context?.custom,
    };

    return this.storage.run(ctx, callback);
  }

  /**
   * Run an async function within a request context
   */
  async runAsync<T>(callback: () => Promise<T>, context?: Partial<RequestContext>): Promise<T> {
    return this.run(callback, context);
  }

  /**
   * Get the current request context (if any)
   */
  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current trace ID (if any)
   */
  getTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  /**
   * Get the current request ID (if any)
   */
  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  /**
   * Update the current context with additional data
   */
  update(data: Partial<RequestContext>): void {
    const current = this.storage.getStore();
    if (current) {
      Object.assign(current, data);
    }
  }

  /**
   * Set a custom context value
   */
  set(key: string, value: unknown): void {
    const current = this.storage.getStore();
    if (current) {
      if (!current.custom) {
        current.custom = {};
      }
      current.custom[key] = value;
    }
  }

  /**
   * Get a custom context value
   */
  get<T = unknown>(key: string): T | undefined {
    return this.storage.getStore()?.custom?.[key] as T | undefined;
  }

  /**
   * Get elapsed time since request start
   */
  getElapsed(): number {
    const ctx = this.storage.getStore();
    return ctx ? Date.now() - ctx.startTime : 0;
  }

  /**
   * Generate a short unique ID (8 characters)
   */
  private generateShortId(): string {
    return randomUUID().split('-')[0];
  }
}

// Singleton instance
export const asyncContext = new AsyncContext();

/** Minimal request shape for Express compatibility without requiring express types */
interface MinimalRequest {
  method: string;
  url: string;
  path?: string;
  [key: string]: unknown;
}

/** Minimal response shape for Express/NestJS compatibility */
interface MinimalResponse {
  setHeader(name: string, value: string): void;
  [key: string]: unknown;
}

/** Minimal NestJS ExecutionContext shape */
interface MinimalExecutionContext {
  switchToHttp(): {
    getRequest(): MinimalRequest;
    getResponse(): MinimalResponse;
  };
}

/** Minimal NestJS CallHandler shape */
interface MinimalCallHandler {
  handle(): unknown;
}

/**
 * Express middleware for automatic context creation
 */
export function expressContextMiddleware() {
  return (req: MinimalRequest, res: MinimalResponse, next: () => void) => {
    asyncContext.run(
      () => {
        // Add context to request object for user access
        req.traceId = asyncContext.getTraceId();
        req.requestId = asyncContext.getRequestId();

        // Add trace ID to response headers
        const traceId = asyncContext.getTraceId();
        if (traceId) {
          res.setHeader('X-Trace-Id', traceId);
        }

        next();
      },
      {
        method: req.method,
        path: req.path || req.url,
      }
    );
  };
}

/**
 * NestJS interceptor for automatic context creation
 * Usage: app.useGlobalInterceptors(new DevLogContextInterceptor())
 */
export class DevLogContextInterceptor {
  intercept(context: MinimalExecutionContext, next: MinimalCallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return asyncContext.runAsync(async () => {
      const traceId = asyncContext.getTraceId();
      if (traceId) {
        response.setHeader('X-Trace-Id', traceId);
      }
      return next.handle();
    }, {
      method: request.method,
      path: request.path || request.url,
    });
  }
}

/**
 * Decorator for wrapping a function with context
 */
export function withContext<T extends (...args: unknown[]) => unknown>(
  fn: T,
  contextFactory?: (...args: Parameters<T>) => Partial<RequestContext>
): T {
  return ((...args: Parameters<T>) => {
    const ctx = contextFactory ? contextFactory(...args) : {};
    return asyncContext.run(() => fn(...args), ctx);
  }) as T;
}
