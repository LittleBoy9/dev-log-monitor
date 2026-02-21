import { TimingInfo } from '../core/log-entry';

/**
 * Timing tracker for performance monitoring
 */
class TimingTracker {
  private startTime: number = Date.now();
  private startHr: [number, number] = process.hrtime();
  private lastLogTime: Map<string, number> = new Map(); // context -> timestamp

  /**
   * Reset the start time (call on logger init)
   */
  reset(): void {
    this.startTime = Date.now();
    this.startHr = process.hrtime();
    this.lastLogTime.clear();
  }

  /**
   * Get timing info for a log entry
   */
  getTiming(context?: string): TimingInfo {
    const now = Date.now();
    const hr = process.hrtime(this.startHr);
    const sinceStart = Math.round((hr[0] * 1000) + (hr[1] / 1000000));

    // Calculate time since last log in same context
    const contextKey = context || '__global__';
    const lastTime = this.lastLogTime.get(contextKey) || now;
    const sinceLast = now - lastTime;
    this.lastLogTime.set(contextKey, now);

    return {
      unix: now,
      sinceStart,
      sinceLast,
      hr: process.hrtime(),
    };
  }

  /**
   * Get elapsed time since logger started
   */
  getElapsed(): number {
    const hr = process.hrtime(this.startHr);
    return Math.round((hr[0] * 1000) + (hr[1] / 1000000));
  }

  /**
   * Format timing for display
   */
  formatTiming(timing: TimingInfo): string {
    const delta = timing.sinceLast;
    if (delta < 1) return '';
    if (delta < 1000) return `+${delta}ms`;
    if (delta < 60000) return `+${(delta / 1000).toFixed(1)}s`;
    return `+${(delta / 60000).toFixed(1)}m`;
  }
}

// Singleton instance
export const timing = new TimingTracker();

// Export class for custom instances
export { TimingTracker };

/**
 * Timer helper for measuring operation duration
 */
export interface Timer {
  end(metadata?: Record<string, unknown>): number;
  elapsed(): number;
}

/**
 * Create a timer for measuring operation duration
 */
export function createTimer(): Timer {
  const start = process.hrtime();

  return {
    elapsed(): number {
      const hr = process.hrtime(start);
      return Math.round((hr[0] * 1000) + (hr[1] / 1000000));
    },
    end(metadata?: Record<string, unknown>): number {
      return this.elapsed();
    },
  };
}
