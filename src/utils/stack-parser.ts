import { StackFrame } from '../core/log-entry';
import path from 'path';
import { getProjectRoot } from './source-location';

/**
 * Regex patterns for parsing V8 stack traces
 * Handles various formats:
 *   at Function.name (/path/to/file.js:10:15)
 *   at /path/to/file.js:10:15
 *   at Object.<anonymous> (/path/to/file.js:10:15)
 *   at async Function.name (/path/to/file.js:10:15)
 */
const STACK_LINE_REGEX = /^\s*at\s+(?:(async)\s+)?(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|([^)]+))\)?$/;
const NATIVE_REGEX = /^native|^<anonymous>$|^\[native code\]$/;
const NODE_MODULES_REGEX = /node_modules/;
const NODE_INTERNAL_REGEX = /^(?:node:|internal\/)/;

export interface ParsedStack {
  frames: StackFrame[];
  rawStack: string;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Parse a stack trace string into structured frames
 */
export function parseStack(stack: string | undefined): ParsedStack | undefined {
  if (!stack) return undefined;

  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  let errorType: string | undefined;
  let errorMessage: string | undefined;

  // First line is usually "ErrorType: message"
  if (lines.length > 0 && !lines[0].trim().startsWith('at ')) {
    const firstLine = lines[0];
    const colonIndex = firstLine.indexOf(':');
    if (colonIndex > 0) {
      errorType = firstLine.slice(0, colonIndex).trim();
      errorMessage = firstLine.slice(colonIndex + 1).trim();
    } else {
      errorMessage = firstLine.trim();
    }
  }

  for (const line of lines) {
    const frame = parseStackLine(line);
    if (frame) {
      frames.push(frame);
    }
  }

  return {
    frames,
    rawStack: stack,
    errorType,
    errorMessage,
  };
}

/**
 * Parse a single stack trace line
 */
function parseStackLine(line: string): StackFrame | null {
  const match = line.match(STACK_LINE_REGEX);
  if (!match) return null;

  const [, , functionName, filePath, lineStr, columnStr] = match;

  // Skip if we couldn't extract file info
  if (!filePath || !lineStr) return null;

  const lineNum = parseInt(lineStr, 10);
  const columnNum = parseInt(columnStr || '0', 10);

  // Determine if this is app code or external
  const isNative = NATIVE_REGEX.test(filePath) || NODE_INTERNAL_REGEX.test(filePath);
  const isNodeModules = NODE_MODULES_REGEX.test(filePath);
  const isApp = !isNative && !isNodeModules;

  // Get relative path for display
  const projectRoot = getProjectRoot();
  let relativePath = filePath;
  if (filePath.startsWith(projectRoot)) {
    relativePath = filePath.slice(projectRoot.length + 1);
  }

  return {
    function: cleanFunctionName(functionName || 'anonymous'),
    file: path.basename(filePath),
    path: relativePath,
    line: lineNum,
    column: columnNum,
    isApp,
    isNative,
  };
}

/**
 * Clean up function name for display
 */
function cleanFunctionName(name: string): string {
  // Remove "Object." prefix for anonymous functions
  if (name.startsWith('Object.')) {
    return name.slice(7) || 'anonymous';
  }
  // Remove "Module." prefix
  if (name.startsWith('Module.')) {
    return name.slice(7) || 'anonymous';
  }
  // Handle async wrappers
  if (name === '<anonymous>') {
    return 'anonymous';
  }
  return name;
}

/**
 * Get only app code frames (exclude node_modules and native)
 */
export function getAppFrames(stack: ParsedStack | undefined): StackFrame[] {
  if (!stack) return [];
  return stack.frames.filter((f) => f.isApp);
}

/**
 * Get the most relevant frame (first app code frame)
 */
export function getPrimaryFrame(stack: ParsedStack | undefined): StackFrame | undefined {
  if (!stack) return undefined;
  return stack.frames.find((f) => f.isApp) || stack.frames[0];
}

/**
 * Format a stack frame as a readable string
 */
export function formatFrame(frame: StackFrame): string {
  return `${frame.function} (${frame.path}:${frame.line}:${frame.column})`;
}

/**
 * Format entire parsed stack for display
 */
export function formatParsedStack(stack: ParsedStack | undefined, options?: {
  maxFrames?: number;
  appOnly?: boolean;
}): string {
  if (!stack) return '';

  const { maxFrames = 10, appOnly = false } = options || {};
  let frames = appOnly ? getAppFrames(stack) : stack.frames;

  if (frames.length > maxFrames) {
    frames = frames.slice(0, maxFrames);
  }

  const lines: string[] = [];

  if (stack.errorType || stack.errorMessage) {
    lines.push(`${stack.errorType || 'Error'}: ${stack.errorMessage || ''}`);
  }

  for (const frame of frames) {
    const prefix = frame.isApp ? '❯' : ' ';
    lines.push(`  ${prefix} at ${formatFrame(frame)}`);
  }

  return lines.join('\n');
}
