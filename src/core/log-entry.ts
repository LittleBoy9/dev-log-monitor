export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogSource = 'nest' | 'express' | 'node' | 'console' | 'winston' | 'pino' | 'bunyan' | 'custom';

/**
 * Parsed stack frame for beautiful error display
 */
export interface StackFrame {
  function: string;      // "UserService.createUser"
  file: string;          // "user.service.ts"
  path: string;          // "/src/services/user.service.ts"
  line: number;          // 42
  column: number;        // 15
  isApp: boolean;        // true = app code, false = node_modules
  isNative: boolean;     // true = native V8 code
}

/**
 * Source location where the log was called
 */
export interface CallerInfo {
  file: string;          // "user.service.ts"
  path: string;          // "/src/services/user.service.ts"
  line: number;          // 42
  column: number;        // 15
  function: string;      // "createUser"
}

/**
 * Timing information for performance tracking
 */
export interface TimingInfo {
  unix: number;          // Unix timestamp in ms
  sinceStart: number;    // ms since logger initialized
  sinceLast: number;     // ms since last log (same context)
  hr: [number, number];  // High-resolution time [seconds, nanoseconds]
}

/**
 * Breadcrumb entry - simplified log for trail before errors
 */
export interface BreadcrumbEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  caller?: CallerInfo;
  msAgo: number;         // How many ms before the error
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  source: LogSource;

  // Enhanced tracing
  caller?: CallerInfo;           // Where the log was called
  timing?: TimingInfo;           // Performance timing
  traceId?: string;              // Request trace ID
  spanId?: string;               // Operation span ID
  parsedStack?: StackFrame[];    // Parsed stack frames (for errors)
  breadcrumbs?: BreadcrumbEntry[]; // Logs leading up to this (for errors)
}

export interface LogFilter {
  level?: LogLevel | LogLevel[];
  context?: string;
  search?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  traceId?: string;              // Filter by trace ID
  file?: string;                 // Filter by source file
}
