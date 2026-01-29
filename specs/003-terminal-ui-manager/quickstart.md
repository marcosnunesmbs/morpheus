# Developer Quickstart: Using DisplayManager

## Introduction

The `DisplayManager` handles simultaneous CLI output (streaming logs vs. static status spinner). All terminal logging should go through this manager instead of `console.log`.

## Usage

### 1. Import and Log

```typescript
import { DisplayManager } from '../../runtime/display.js'; // Adjust path

// Simple log
DisplayManager.getInstance().log('Hello World');

// Structured log
DisplayManager.getInstance().log('User connected', {
  source: 'Telegram',
  level: 'success'
});
```

### 2. Managing the Spinner (Process Owner Only)

Only the `start` command (or main process) should control the spinner.

```typescript
const display = DisplayManager.getInstance();

display.startSpinner('Agent active...');

// ... do work ...

display.updateSpinner('Processing request...');
```

## Migration Guide

**Before**:
```typescript
console.log(chalk.blue(`[Telegram] ${msg}`));
```

**After**:
```typescript
DisplayManager.getInstance().log(msg, { source: 'Telegram' });
```
