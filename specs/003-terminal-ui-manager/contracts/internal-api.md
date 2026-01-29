# Internal Contract: DisplayManager

**Purpose**: Define the standardized interface for all terminal output to ensure UI consistency.

## Singleton Access

```typescript
static getInstance(): DisplayManager
```

## Logging API

Modules must use `.log()` for feedback.

```typescript
log(message: string, options?: {
  source?: string;      // e.g., 'Telegram', 'System'
  level?: 'info' | 'success' | 'warning' | 'error';
}): void;
```

**Behavior**:
1. Checks if global spinner is running.
2. If yes, stops spinner (clearing line).
3. Prints formatted message: `[Source] Message`.
4. If yes, restarts spinner.

## Spinner API

Only the main loop should use these.

- `startSpinner(text?: string)`: Starts `ora` instance.
- `updateSpinner(text: string)`: Updates `ora.text`.
- `stopSpinner(success?: boolean)`: Stops animation.
