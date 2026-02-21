/**
 * Metrics and Analytics System
 * Track log frequency, error rates, performance metrics, and more
 */

import { LogLevel } from '../core/log-entry';

interface LogCount {
  debug: number;
  info: number;
  warn: number;
  error: number;
  total: number;
}

interface TimeWindow {
  startTime: number;
  counts: LogCount;
  contexts: Map<string, LogCount>;
  errors: Array<{
    timestamp: number;
    message: string;
    context?: string;
  }>;
  slowOperations: Array<{
    timestamp: number;
    operation: string;
    duration: number;
  }>;
}

interface PerformanceMetric {
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  window: {
    startTime: number;
    duration: number;
  };
  counts: LogCount;
  contextCounts: Record<string, LogCount>;
  errorRate: number;
  logsPerSecond: number;
  recentErrors: Array<{
    timestamp: number;
    message: string;
    context?: string;
  }>;
  slowOperations: Array<{
    timestamp: number;
    operation: string;
    duration: number;
  }>;
  performance: Record<string, PerformanceMetric>;
  systemInfo?: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  };
}

export interface MetricsConfig {
  /** Time window for metrics collection in milliseconds (default: 5 minutes) */
  windowSize?: number;
  /** Maximum number of recent errors to keep (default: 100) */
  maxRecentErrors?: number;
  /** Maximum number of slow operations to track (default: 50) */
  maxSlowOperations?: number;
  /** Threshold for slow operation in milliseconds (default: 1000) */
  slowOperationThreshold?: number;
  /** Collect system info (memory, uptime) (default: true) */
  collectSystemInfo?: boolean;
}

const DEFAULT_CONFIG: Required<MetricsConfig> = {
  windowSize: 5 * 60 * 1000, // 5 minutes
  maxRecentErrors: 100,
  maxSlowOperations: 50,
  slowOperationThreshold: 1000,
  collectSystemInfo: true,
};

class Metrics {
  private config: Required<MetricsConfig>;
  private currentWindow: TimeWindow;
  private performance: Map<string, PerformanceMetric> = new Map();
  private listeners: Set<(snapshot: MetricsSnapshot) => void> = new Set();
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: MetricsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentWindow = this.createWindow();
  }

  private createWindow(): TimeWindow {
    return {
      startTime: Date.now(),
      counts: { debug: 0, info: 0, warn: 0, error: 0, total: 0 },
      contexts: new Map(),
      errors: [],
      slowOperations: [],
    };
  }

  private rotateWindowIfNeeded(): void {
    const now = Date.now();
    if (now - this.currentWindow.startTime >= this.config.windowSize) {
      // Create new window
      this.currentWindow = this.createWindow();
    }
  }

  /**
   * Record a log entry
   */
  recordLog(level: LogLevel, message: string, context?: string): void {
    this.rotateWindowIfNeeded();

    // Update global counts
    this.currentWindow.counts[level]++;
    this.currentWindow.counts.total++;

    // Update context-specific counts
    if (context) {
      let contextCounts = this.currentWindow.contexts.get(context);
      if (!contextCounts) {
        contextCounts = { debug: 0, info: 0, warn: 0, error: 0, total: 0 };
        this.currentWindow.contexts.set(context, contextCounts);
      }
      contextCounts[level]++;
      contextCounts.total++;
    }

    // Track errors
    if (level === 'error') {
      this.currentWindow.errors.push({
        timestamp: Date.now(),
        message,
        context,
      });

      // Trim if needed
      if (this.currentWindow.errors.length > this.config.maxRecentErrors) {
        this.currentWindow.errors = this.currentWindow.errors.slice(-this.config.maxRecentErrors);
      }
    }
  }

  /**
   * Record an operation with its duration
   */
  recordOperation(operation: string, duration: number): void {
    // Update performance metrics
    let metric = this.performance.get(operation);
    if (!metric) {
      metric = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0,
      };
      this.performance.set(operation, metric);
    }

    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.avgDuration = metric.totalDuration / metric.count;

    // Track slow operations
    if (duration >= this.config.slowOperationThreshold) {
      this.rotateWindowIfNeeded();
      this.currentWindow.slowOperations.push({
        timestamp: Date.now(),
        operation,
        duration,
      });

      // Trim if needed
      if (this.currentWindow.slowOperations.length > this.config.maxSlowOperations) {
        this.currentWindow.slowOperations = this.currentWindow.slowOperations.slice(-this.config.maxSlowOperations);
      }
    }
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    this.rotateWindowIfNeeded();

    const now = Date.now();
    const windowDuration = now - this.currentWindow.startTime;
    const seconds = windowDuration / 1000;

    // Convert contexts map to object
    const contextCounts: Record<string, LogCount> = {};
    this.currentWindow.contexts.forEach((counts, context) => {
      contextCounts[context] = { ...counts };
    });

    // Convert performance map to object
    const performanceObj: Record<string, PerformanceMetric> = {};
    this.performance.forEach((metric, operation) => {
      performanceObj[operation] = { ...metric };
    });

    const snapshot: MetricsSnapshot = {
      timestamp: now,
      window: {
        startTime: this.currentWindow.startTime,
        duration: windowDuration,
      },
      counts: { ...this.currentWindow.counts },
      contextCounts,
      errorRate: seconds > 0 ? (this.currentWindow.counts.error / seconds) * 60 : 0, // errors per minute
      logsPerSecond: seconds > 0 ? this.currentWindow.counts.total / seconds : 0,
      recentErrors: [...this.currentWindow.errors],
      slowOperations: [...this.currentWindow.slowOperations],
      performance: performanceObj,
    };

    if (this.config.collectSystemInfo) {
      snapshot.systemInfo = {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    }

    return snapshot;
  }

  /**
   * Subscribe to periodic metrics snapshots
   */
  subscribe(callback: (snapshot: MetricsSnapshot) => void, intervalMs = 10000): () => void {
    this.listeners.add(callback);

    // Start interval if not already running
    if (!this.snapshotInterval) {
      this.snapshotInterval = setInterval(() => {
        const snapshot = this.getSnapshot();
        this.listeners.forEach(listener => {
          try {
            listener(snapshot);
          } catch {
            // Ignore listener errors
          }
        });
      }, intervalMs);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.snapshotInterval) {
        clearInterval(this.snapshotInterval);
        this.snapshotInterval = null;
      }
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.currentWindow = this.createWindow();
    this.performance.clear();
  }

  /**
   * Get error rate (errors per minute)
   */
  getErrorRate(): number {
    const snapshot = this.getSnapshot();
    return snapshot.errorRate;
  }

  /**
   * Get logs per second
   */
  getLogsPerSecond(): number {
    const snapshot = this.getSnapshot();
    return snapshot.logsPerSecond;
  }

  /**
   * Get performance metrics for a specific operation
   */
  getOperationMetrics(operation: string): PerformanceMetric | undefined {
    return this.performance.get(operation);
  }

  /**
   * Configure metrics
   */
  configure(config: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const metrics = new Metrics();
