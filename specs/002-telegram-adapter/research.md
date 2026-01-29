# Research: Telegram Channel Adapter

## Decisions & Rationale

### 1. Telegram Client Library: `telegraf`

- **Decision**: Use `telegraf` framework.
- **Rationale**: 
    - Popular, well-maintained, and TypeScript friendly.
    - Simplified `launch()` wrapper handles polling automatically.
    - Built-in graceful shutdown via `bot.stop()`.
- **Implementation Note**:
    - Use `bot.launch()` for starting.
    - Bind `process.once('SIGINT', () => bot.stop('SIGINT'))` in the adapter's disconnect logic (or handle via the main lifecycle manager calling `adapter.disconnect()`).

### 2. Configuration Update Logic (`morpheus config set`)

- **Decision**: Implement a custom lightweight `setByPath` utility.
- **Rationale**: 
    - Avoids adding `lodash` (large bundle/dependency) just for one function.
    - Simple specific implementation is sufficient for our `config.yaml` structure.
    - Allows us to coerce types if needed (e.g. "true" -> boolean) inside the wrapper before setting.

### 3. Connection Management

- **Decision**: Managed via `Start` and `Stop` lifecycle hooks.
- **Design**:
    - `TelegramAdapter` class will have `start()` and `stop()` methods.
    - `startCommand` (in CLI) will instantiate the adapter if config is enabled.
    - `stopCommand` sends signal; the running process handles cleanup.
- **Polling**: No special config needed for local dev (default long-polling).

---

## Technical Snippets

### Nested Setter Utility

```typescript
export function setByPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return;
  const target = keys.reduce((acc, key) => {
    if (!acc[key] || typeof acc[key] !== 'object') acc[key] = {};
    return acc[key];
  }, obj);
  target[lastKey] = value;
}
```

### Graceful Stop

```typescript
// Inside Adapter.disconnect()
this.bot.stop('SIGINT');
```
