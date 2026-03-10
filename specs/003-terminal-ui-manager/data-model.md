# Data Model: Unified Terminal Output Manager

## Runtime State (DisplayManager)

The `DisplayManager` maintains the state of the CLI UI. It is a singleton to ensure exclusive access to `process.stdout`/`stderr` when a spinner is active.

### Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `instance` | `DisplayManager` (static) | The singleton instance. |
| `spinner` | `Ora` | The active `ora` spinner instance. |
| `isSpinning` | `boolean` | Derived state from `spinner.isSpinning`. |

## Interfaces

```typescript
// src/components/display/types.ts

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogOptions {
  source?: string; // e.g., 'Telegram', 'System', 'LangChain'
  level?: LogLevel;
  showTimestamp?: boolean; // Future proofing
}

export interface IDisplayManager {
  /** Starts the global spinner with a message */
  startSpinner(text: string): void;
  
  /** Updates the spinner text without stopping it */
  updateSpinner(text: string): void;
  
  /** Stops the spinner (optionally with a final message/symbol) */
  stopSpinner(success?: boolean, text?: string): void;

  /** 
   * Thread-safe logging. 
   * If spinner is active: Stop -> Log -> Restart.
   */
  log(message: string, options?: LogOptions): void;
}
```

## Logging Format

Messages will be formatted as:

```text
[Source] Message content
```

Example:
```text
[Telegram] @user: Hello world
[System] Config updated
```

## Module Interaction

1. **`src/cli/commands/start.ts`**:
   - Calls `DisplayManager.getInstance().startSpinner("Agent active...")`.
   - On shutdown, calls `stopSpinner()`.

2. **`src/channels/telegram.ts`**:
   - Calls `DisplayManager.getInstance().log(...)` for incoming messages.
   - Does NOT manage spinner state.
