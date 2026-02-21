import { join } from 'path';

export type StorageLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DevLogConfig {
  port: number;
  logDir: string;
  retentionDays: number;
  consoleOutput: boolean;
  /** Maximum size per daily log file in bytes (default: 50MB). Oldest entries are pruned when exceeded. */
  maxFileSize: number;
  /** Maximum total size of all log files in bytes (default: 100MB). Oldest files are deleted when exceeded. */
  maxTotalSize: number;
  /** Minimum log level to persist to disk (default: 'debug'). Logs below this still appear in the live UI. */
  storageLevel: StorageLevel;
  /** Maximum size of metadata JSON per entry in bytes (default: 4096). Larger metadata is truncated. */
  maxMetadataSize: number;
  /** Maximum number of parsed stack frames to store per entry (default: 20). */
  maxStackFrames: number;
}

const DEFAULT_CONFIG: DevLogConfig = {
  port: 3333,
  logDir: join(process.cwd(), '.dev-log'),
  retentionDays: 3,
  consoleOutput: true,
  maxFileSize: 50 * 1024 * 1024,   // 50 MB
  maxTotalSize: 100 * 1024 * 1024, // 100 MB
  storageLevel: 'debug',
  maxMetadataSize: 4096,           // 4 KB
  maxStackFrames: 20,
};

let currentConfig: DevLogConfig = { ...DEFAULT_CONFIG };

export function getConfig(): DevLogConfig {
  return { ...currentConfig };
}

export function setConfig(config: Partial<DevLogConfig>): void {
  if (config.port !== undefined) {
    if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) {
      throw new Error(`[dev-log] Invalid port: ${config.port}. Must be an integer between 0 and 65535.`);
    }
  }

  if (config.retentionDays !== undefined) {
    if (!Number.isInteger(config.retentionDays) || config.retentionDays < 1) {
      throw new Error(`[dev-log] Invalid retentionDays: ${config.retentionDays}. Must be a positive integer.`);
    }
  }

  if (config.logDir !== undefined) {
    if (typeof config.logDir !== 'string' || config.logDir.trim() === '') {
      throw new Error(`[dev-log] Invalid logDir: must be a non-empty string.`);
    }
  }

  if (config.maxFileSize !== undefined) {
    if (typeof config.maxFileSize !== 'number' || config.maxFileSize < 1024) {
      throw new Error(`[dev-log] Invalid maxFileSize: ${config.maxFileSize}. Must be at least 1024 bytes.`);
    }
  }

  if (config.maxTotalSize !== undefined) {
    if (typeof config.maxTotalSize !== 'number' || config.maxTotalSize < 1024) {
      throw new Error(`[dev-log] Invalid maxTotalSize: ${config.maxTotalSize}. Must be at least 1024 bytes.`);
    }
  }

  if (config.storageLevel !== undefined) {
    const validLevels: StorageLevel[] = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.storageLevel)) {
      throw new Error(`[dev-log] Invalid storageLevel: ${config.storageLevel}. Must be one of: ${validLevels.join(', ')}.`);
    }
  }

  currentConfig = { ...currentConfig, ...config };
}

export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}
