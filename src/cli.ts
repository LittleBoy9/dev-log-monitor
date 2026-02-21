#!/usr/bin/env node

import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), '.dev-log');

function printHelp() {
  console.log(`
dev-log CLI

Usage:
  dev-log <command>

Commands:
  clear     Clear all stored logs
  status    Show log storage status
  help      Show this help message

Examples:
  npx dev-log clear
  npx dev-log status
`);
}

function clearLogs() {
  if (!existsSync(LOG_DIR)) {
    console.log('No logs to clear.');
    return;
  }

  try {
    rmSync(LOG_DIR, { recursive: true, force: true });
    console.log('All logs cleared successfully.');
  } catch (error) {
    console.error('Failed to clear logs:', error);
    process.exit(1);
  }
}

function showStatus() {
  if (!existsSync(LOG_DIR)) {
    console.log('Log directory: Not created yet');
    console.log('Total files: 0');
    console.log('Total size: 0 bytes');
    return;
  }

  try {
    const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'));
    let totalSize = 0;

    for (const file of files) {
      const filePath = join(LOG_DIR, file);
      const stats = statSync(filePath);
      totalSize += stats.size;
    }

    console.log(`Log directory: ${LOG_DIR}`);
    console.log(`Total files: ${files.length}`);
    console.log(`Total size: ${formatBytes(totalSize)}`);

    if (files.length > 0) {
      console.log('\nLog files:');
      for (const file of files.sort().reverse()) {
        const filePath = join(LOG_DIR, file);
        const stats = statSync(filePath);
        console.log(`  ${file} (${formatBytes(stats.size)})`);
      }
    }
  } catch (error) {
    console.error('Failed to read log status:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'clear':
    clearLogs();
    break;
  case 'status':
    showStatus();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}\n`);
    }
    printHelp();
    process.exit(command ? 1 : 0);
}
