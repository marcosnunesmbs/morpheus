#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Load .env file if it exists (Simple shim to avoid 'dotenv' dependency issues)
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Don't overwrite existing env vars
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    // Ignore .env errors
  }
}

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
