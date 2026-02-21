import { devLogger, ScopedLogger } from '../core/logger';

/** Minimal request shape for Express compatibility without requiring express types */
interface MinimalRequest {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  log?: ScopedLogger;
  [key: string]: unknown;
}

/** Minimal response shape for Express compatibility without requiring express types */
interface MinimalResponse {
  statusCode: number;
  on(event: string, listener: () => void): void;
  [key: string]: unknown;
}

export type ExpressMiddleware = (req: MinimalRequest, res: MinimalResponse, next: () => void) => void;

// Extend Express Request type (for TypeScript users)
declare global {
  namespace Express {
    interface Request {
      log: ScopedLogger;
    }
  }
}

export function createExpressMiddleware(logger: typeof devLogger): ExpressMiddleware {
  return (req: MinimalRequest, res: MinimalResponse, next: () => void) => {
    const startTime = Date.now();

    // Attach a scoped logger to the request
    req.log = logger.create('express', 'express');

    // Log the incoming request
    logger._log('info', `${req.method} ${req.path}`, 'express', 'request', {
      method: req.method,
      url: req.url,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      logger._log(level, `${req.method} ${req.path} ${statusCode}`, 'express', 'response', {
        method: req.method,
        path: req.path,
        statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
}
