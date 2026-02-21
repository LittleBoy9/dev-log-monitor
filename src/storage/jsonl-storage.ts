import { existsSync, mkdirSync, readdirSync, unlinkSync, appendFileSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { LogEntry, LogFilter, LogLevel } from '../core/log-entry';
import { Storage } from './storage';
import { StorageLevel } from '../core/config';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface JsonlStorageOptions {
  logDir: string;
  retentionDays?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  storageLevel?: StorageLevel;
  maxMetadataSize?: number;
  maxStackFrames?: number;
}

export class JsonlStorage implements Storage {
  private logDir: string;
  private retentionDays: number;
  private maxFileSize: number;
  private maxTotalSize: number;
  private storageLevel: StorageLevel;
  private maxMetadataSize: number;
  private maxStackFrames: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: JsonlStorageOptions) {
    this.logDir = options.logDir;
    this.retentionDays = options.retentionDays ?? 3;
    this.maxFileSize = options.maxFileSize ?? 50 * 1024 * 1024;
    this.maxTotalSize = options.maxTotalSize ?? 100 * 1024 * 1024;
    this.storageLevel = options.storageLevel ?? 'debug';
    this.maxMetadataSize = options.maxMetadataSize ?? 4096;
    this.maxStackFrames = options.maxStackFrames ?? 20;
  }

  async init(): Promise<void> {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
    await this.cleanup();
    this.startCleanupInterval();
  }

  /**
   * Stop periodic cleanup (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startCleanupInterval(): void {
    // Run cleanup every 60 seconds (unref to not block process exit)
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(() => {
        // Ignore cleanup errors
      });
    }, 60_000);
    this.cleanupTimer.unref();
  }

  private getFileName(date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0];
    return `logs-${dateStr}.jsonl`;
  }

  private getFilePath(date: Date = new Date()): string {
    return join(this.logDir, this.getFileName(date));
  }

  async append(entry: LogEntry): Promise<void> {
    // Filter by storage level — entries below the threshold are not persisted
    if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[this.storageLevel]) {
      return;
    }

    const filePath = this.getFilePath();

    // Check file size before writing
    if (this.maxFileSize > 0) {
      try {
        if (existsSync(filePath)) {
          const stats = statSync(filePath);
          if (stats.size >= this.maxFileSize) {
            this.pruneFile(filePath);
          }
        }
      } catch {
        // If we can't stat the file, continue writing
      }
    }

    // Truncate the entry before serialization
    const trimmedEntry = this.trimEntry(entry);
    const line = JSON.stringify(trimmedEntry) + '\n';
    appendFileSync(filePath, line, 'utf-8');
  }

  /**
   * Trim an entry to reduce its storage size
   */
  private trimEntry(entry: LogEntry): LogEntry {
    const trimmed = { ...entry };

    // Cap parsed stack frames
    if (trimmed.parsedStack && trimmed.parsedStack.length > this.maxStackFrames) {
      trimmed.parsedStack = trimmed.parsedStack.slice(0, this.maxStackFrames);
    }

    // Cap metadata size
    if (trimmed.metadata) {
      const metaJson = JSON.stringify(trimmed.metadata);
      if (metaJson.length > this.maxMetadataSize) {
        trimmed.metadata = { _truncated: true, _originalSize: metaJson.length, summary: metaJson.slice(0, this.maxMetadataSize - 100) + '...' };
      }
    }

    // Cap raw stack trace string (keep first 4KB)
    if (trimmed.stack && trimmed.stack.length > 4096) {
      trimmed.stack = trimmed.stack.slice(0, 4096) + '\n  ... (stack truncated)';
    }

    return trimmed;
  }

  /**
   * Prune a file that has exceeded maxFileSize by keeping only the newest half
   */
  private pruneFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      // Keep the most recent half
      const keepFrom = Math.floor(lines.length / 2);
      const kept = lines.slice(keepFrom).join('\n') + '\n';
      writeFileSync(filePath, kept, 'utf-8');
    } catch {
      // If pruning fails, just continue
    }
  }

  async query(filter?: LogFilter): Promise<LogEntry[]> {
    const entries: LogEntry[] = [];
    const files = this.getLogFiles();

    for (const file of files) {
      const filePath = join(this.logDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;
            entries.push(entry);
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    let filtered = entries;

    if (filter) {
      if (filter.level) {
        const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
        filtered = filtered.filter((e) => levels.includes(e.level));
      }

      if (filter.context) {
        filtered = filtered.filter((e) => e.context === filter.context);
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.message.toLowerCase().includes(searchLower) ||
            e.context?.toLowerCase().includes(searchLower) ||
            JSON.stringify(e.metadata || {}).toLowerCase().includes(searchLower)
        );
      }

      if (filter.since) {
        const sinceDate = new Date(filter.since);
        filtered = filtered.filter((e) => new Date(e.timestamp) >= sinceDate);
      }

      if (filter.until) {
        const untilDate = new Date(filter.until);
        filtered = filtered.filter((e) => new Date(e.timestamp) <= untilDate);
      }
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter?.offset) {
      filtered = filtered.slice(filter.offset);
    }

    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  private getLogFiles(): string[] {
    if (!existsSync(this.logDir)) {
      return [];
    }

    return readdirSync(this.logDir)
      .filter((file) => file.startsWith('logs-') && file.endsWith('.jsonl'))
      .sort()
      .reverse();
  }

  async clear(): Promise<void> {
    const files = this.getLogFiles();
    for (const file of files) {
      try {
        unlinkSync(join(this.logDir, file));
      } catch {
        // Ignore deletion errors
      }
    }
  }

  async cleanup(): Promise<void> {
    // 1. Retention-based cleanup: remove files older than retentionDays
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const files = this.getLogFiles();
    for (const file of files) {
      const match = file.match(/logs-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (match) {
        const fileDate = new Date(match[1]);
        if (fileDate < cutoffDate) {
          try {
            unlinkSync(join(this.logDir, file));
          } catch {
            // Ignore deletion errors
          }
        }
      }
    }

    // 2. Total size enforcement: delete oldest files until under maxTotalSize
    if (this.maxTotalSize > 0) {
      this.enforceTotalSize();
    }
  }

  /**
   * Delete oldest log files until total size is under maxTotalSize
   */
  private enforceTotalSize(): void {
    // Get files sorted oldest first (ascending date)
    const files = this.getLogFiles().reverse();
    let totalSize = 0;
    const fileSizes: Array<{ file: string; size: number }> = [];

    for (const file of files) {
      try {
        const stats = statSync(join(this.logDir, file));
        totalSize += stats.size;
        fileSizes.push({ file, size: stats.size });
      } catch {
        // Skip files we can't stat
      }
    }

    // Remove oldest files until under limit
    let i = 0;
    while (totalSize > this.maxTotalSize && i < fileSizes.length) {
      try {
        unlinkSync(join(this.logDir, fileSizes[i].file));
        totalSize -= fileSizes[i].size;
      } catch {
        // Ignore deletion errors
      }
      i++;
    }
  }

  getContexts(): string[] {
    const contexts = new Set<string>();
    const files = this.getLogFiles();

    for (const file of files) {
      const filePath = join(this.logDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;
            if (entry.context) {
              contexts.add(entry.context);
            }
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return Array.from(contexts).sort();
  }
}
