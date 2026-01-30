#!/usr/bin/env node

// Suppress experimental warnings for JSON modules
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (
    name === 'warning' &&
    typeof data === 'object' &&
    data.name === 'ExperimentalWarning' &&
    data.message.includes('Importing JSON modules')
  ) {
    return false;
  }
  return originalEmit.apply(process, [name, data, ...args]);
};

// Use dynamic import to ensure the warning suppression is active before the module graph loads
const { cli } = await import('../dist/cli/index.js');
cli();
