# Internal API Contracts: Logging System

**Branch**: `007-logging-system`
**Date**: 2026-01-29

## `IDisplayManager` Interface

Located in `src/runtime/types.ts` (or `src/types/display.ts`).
We are adding initialization capabilities.

```typescript
export interface LogOptions {
  level?: 'debug' | 'info' | 'warning' | 'error' | 'success'; 
  source?: string;
  // Metadata for structured logging (audit)
  meta?: Record<string, any>;
}

export interface IDisplayManager {
  // Existing methods
  startSpinner(text?: string): void;
  updateSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
  log(message: string, options?: LogOptions): void;

  // NEW: Initialize logging with config
  // (Optional depending on if we do it in constructor or explicit call)
  initialize(config: LogConfig): Promise<void>;
}
```

## `DisplayManager` Implementation

The singleton implementation will behave as follows:

- **`initialize(config: LogConfig)`**:
  - Validates `config`.
  - Configures `winston` Logger.
  - Adds `DailyRotateFile` transport.
  - Ensures `LOGS_DIR` exists.

- **`log(message, options)`**:
  - **Console Output**: Continues to use `ora` / `chalk` for user feedback.
  - **File Output**:
    - Maps `options.level` to Winston levels.
    - `success` (UI) -> `info` (File).
    - `warning` (UI) -> `warn` (File).
    - Writes `message` + `options.meta` to logger.
