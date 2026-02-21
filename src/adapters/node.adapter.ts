import { devLogger, ScopedLogger } from '../core/logger';
import { DevLogConfig } from '../core/config';

export async function init(config?: Partial<DevLogConfig>): Promise<void> {
  await devLogger.init(config);
}

export function create(context: string): ScopedLogger {
  return devLogger.create(context, 'node');
}

export function debug(message: string, metadata?: Record<string, unknown>): void {
  devLogger.debug(message, metadata);
}

export function info(message: string, metadata?: Record<string, unknown>): void {
  devLogger.info(message, metadata);
}

export function warn(message: string, metadata?: Record<string, unknown>): void {
  devLogger.warn(message, metadata);
}

export function error(message: string, metadata?: Record<string, unknown>): void {
  devLogger.error(message, metadata);
}

export function log(message: string, metadata?: Record<string, unknown>): void {
  devLogger.log(message, metadata);
}

export async function shutdown(): Promise<void> {
  await devLogger.shutdown();
}
