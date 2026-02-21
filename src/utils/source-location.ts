import { CallerInfo } from '../core/log-entry';
import path from 'path';

/**
 * Captures the source location (file, line, column, function) of the caller.
 * Uses V8 stack trace API for accurate information.
 */
export function getCallerInfo(skipFrames: number = 3): CallerInfo | undefined {
  const originalPrepare = Error.prepareStackTrace;
  const originalLimit = Error.stackTraceLimit;

  try {
    Error.stackTraceLimit = skipFrames + 1;
    Error.prepareStackTrace = (_, stack) => stack;

    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];

    if (!stack || stack.length <= skipFrames) {
      return undefined;
    }

    const frame = stack[skipFrames];
    if (!frame) {
      return undefined;
    }

    const filePath = frame.getFileName() || 'unknown';
    const fileName = path.basename(filePath);
    const line = frame.getLineNumber() || 0;
    const column = frame.getColumnNumber() || 0;

    // Get function name with class/object context
    let functionName = frame.getFunctionName() || 'anonymous';
    const typeName = frame.getTypeName();
    const methodName = frame.getMethodName();

    if (typeName && methodName && !functionName.includes('.')) {
      functionName = `${typeName}.${methodName}`;
    }

    return {
      file: fileName,
      path: filePath,
      line,
      column,
      function: functionName,
    };
  } catch {
    return undefined;
  } finally {
    Error.prepareStackTrace = originalPrepare;
    Error.stackTraceLimit = originalLimit;
  }
}

/**
 * Format caller info as a readable string
 */
export function formatCallerInfo(caller: CallerInfo | undefined): string {
  if (!caller) return '';
  return `${caller.file}:${caller.line} → ${caller.function}()`;
}

/**
 * Get the project root directory (for relative paths)
 */
let projectRoot: string | null = null;

export function setProjectRoot(root: string): void {
  projectRoot = root;
}

export function getProjectRoot(): string {
  if (projectRoot) return projectRoot;
  return process.cwd();
}

/**
 * Convert absolute path to relative (for cleaner display)
 */
export function toRelativePath(absolutePath: string): string {
  const root = getProjectRoot();
  if (absolutePath.startsWith(root)) {
    return absolutePath.slice(root.length + 1); // +1 for the slash
  }
  return absolutePath;
}
