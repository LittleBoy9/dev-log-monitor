import { BreadcrumbEntry, CallerInfo, LogLevel } from '../core/log-entry';

interface InternalBreadcrumb {
  timestamp: string;
  unix: number;
  level: LogLevel;
  message: string;
  context?: string;
  caller?: CallerInfo;
  traceId?: string;
}

/**
 * Breadcrumb collector - stores recent logs for error context
 * Maintains separate trails per traceId (request) and a global trail
 */
class BreadcrumbCollector {
  private globalTrail: InternalBreadcrumb[] = [];
  private traceTrails: Map<string, InternalBreadcrumb[]> = new Map();
  private maxBreadcrumbs: number;
  private maxAge: number; // ms
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { maxBreadcrumbs?: number; maxAge?: number }) {
    this.maxBreadcrumbs = options?.maxBreadcrumbs || 50;
    this.maxAge = options?.maxAge || 60000; // 1 minute default
    this.startCleanupInterval();
  }

  /**
   * Start periodic cleanup of old traces
   */
  private startCleanupInterval(): void {
    // Run cleanup every 10 seconds (unref to not block process exit)
    this.cleanupTimer = setInterval(() => this.cleanupOldTraces(), 10_000);
    this.cleanupTimer.unref();
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Add a breadcrumb to the trail
   */
  add(entry: {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: string;
    caller?: CallerInfo;
    traceId?: string;
  }): void {
    const breadcrumb: InternalBreadcrumb = {
      timestamp: entry.timestamp,
      unix: Date.now(),
      level: entry.level,
      message: entry.message,
      context: entry.context,
      caller: entry.caller,
      traceId: entry.traceId,
    };

    // Add to global trail
    this.globalTrail.push(breadcrumb);
    this.trimTrail(this.globalTrail);

    // Add to trace-specific trail if traceId exists
    if (entry.traceId) {
      let trail = this.traceTrails.get(entry.traceId);
      if (!trail) {
        trail = [];
        this.traceTrails.set(entry.traceId, trail);
      }
      trail.push(breadcrumb);
      this.trimTrail(trail);
    }
  }

  /**
   * Get breadcrumbs for an error
   * Prioritizes trace-specific breadcrumbs, falls back to context-matched or global
   */
  getBreadcrumbs(options: {
    traceId?: string;
    context?: string;
    limit?: number;
  }): BreadcrumbEntry[] {
    const { traceId, context, limit = 10 } = options;
    const now = Date.now();

    let trail: InternalBreadcrumb[];

    // Prefer trace-specific trail
    if (traceId && this.traceTrails.has(traceId)) {
      trail = this.traceTrails.get(traceId)!;
    } else if (context) {
      // Filter global trail by context
      trail = this.globalTrail.filter(
        (b) => b.context === context || !b.context
      );
    } else {
      trail = this.globalTrail;
    }

    // Get last N breadcrumbs, excluding the current error itself
    const recentBreadcrumbs = trail.slice(-limit - 1, -1);

    return recentBreadcrumbs.map((b) => ({
      timestamp: b.timestamp,
      level: b.level,
      message: this.truncateMessage(b.message),
      context: b.context,
      caller: b.caller,
      msAgo: now - b.unix,
    }));
  }

  /**
   * Clear trail for a specific trace (call when request completes)
   */
  clearTrace(traceId: string): void {
    this.traceTrails.delete(traceId);
  }

  /**
   * Clear all breadcrumbs
   */
  clear(): void {
    this.globalTrail = [];
    this.traceTrails.clear();
  }

  /**
   * Trim trail to max size
   */
  private trimTrail(trail: InternalBreadcrumb[]): void {
    if (trail.length > this.maxBreadcrumbs) {
      trail.splice(0, trail.length - this.maxBreadcrumbs);
    }
  }

  /**
   * Remove old traces to prevent memory leaks
   */
  private cleanupOldTraces(): void {
    const now = Date.now();
    const cutoff = now - this.maxAge;

    for (const [traceId, trail] of this.traceTrails.entries()) {
      // Remove trail if all breadcrumbs are old
      if (trail.length === 0 || trail[trail.length - 1].unix < cutoff) {
        this.traceTrails.delete(traceId);
      }
    }

    // Also clean global trail
    const firstValidIndex = this.globalTrail.findIndex((b) => b.unix >= cutoff);
    if (firstValidIndex > 0) {
      this.globalTrail.splice(0, firstValidIndex);
    }
  }

  /**
   * Truncate long messages for breadcrumb display
   */
  private truncateMessage(message: string, maxLength: number = 100): string {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength - 3) + '...';
  }
}

// Singleton instance
export const breadcrumbs = new BreadcrumbCollector();

// Export class for custom instances
export { BreadcrumbCollector };
