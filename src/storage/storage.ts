import { LogEntry, LogFilter } from '../core/log-entry';

export interface Storage {
  init(): Promise<void>;
  append(entry: LogEntry): Promise<void>;
  query(filter?: LogFilter): Promise<LogEntry[]>;
  clear(): Promise<void>;
  cleanup(): Promise<void>;
}
