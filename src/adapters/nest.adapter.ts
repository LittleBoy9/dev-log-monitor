import { devLogger, ScopedLogger } from '../core/logger';
import { LogLevel } from '../core/log-entry';

// NestJS LoggerService interface (we don't want to depend on @nestjs/common)
export interface LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  debug?(message: unknown, ...optionalParams: unknown[]): void;
  verbose?(message: unknown, ...optionalParams: unknown[]): void;
  fatal?(message: unknown, ...optionalParams: unknown[]): void;
  setLogLevels?(levels: string[]): void;
}

export class NestAdapter implements LoggerService {
  private logger: typeof devLogger;
  private context?: string;

  constructor(logger: typeof devLogger, context?: string) {
    this.logger = logger;
    this.context = context;
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    return JSON.stringify(message);
  }

  private extractContext(optionalParams: unknown[]): { context?: string; metadata?: Record<string, unknown> } {
    let context = this.context;
    let metadata: Record<string, unknown> | undefined;

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        context = param;
      } else if (param instanceof Error) {
        metadata = {
          ...(metadata || {}),
          error: param.message,
          stack: param.stack,
        };
      } else if (typeof param === 'object' && param !== null) {
        metadata = { ...(metadata || {}), ...(param as Record<string, unknown>) };
      }
    }

    return { context, metadata };
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);
    this.logger._log('info', this.formatMessage(message), 'nest', context, metadata);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);

    // Handle Error objects in message
    if (message instanceof Error) {
      this.logger._log('error', message.message, 'nest', context, {
        ...metadata,
        stack: message.stack,
      });
      return;
    }

    this.logger._log('error', this.formatMessage(message), 'nest', context, metadata);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);
    this.logger._log('warn', this.formatMessage(message), 'nest', context, metadata);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);
    this.logger._log('debug', this.formatMessage(message), 'nest', context, metadata);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);
    this.logger._log('debug', this.formatMessage(message), 'nest', context, metadata);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = this.extractContext(optionalParams);
    this.logger._log('error', this.formatMessage(message), 'nest', context, {
      ...metadata,
      fatal: true,
    });
  }

  setLogLevels(_levels: string[]): void {
    // No-op for now, we log everything
  }
}

// Factory function to create a scoped NestJS logger
export function createNestLogger(context: string): ScopedLogger {
  return devLogger.create(context, 'nest');
}
