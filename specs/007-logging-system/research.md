# Research: Logging System

**Branch**: `007-logging-system`
**Date**: 2026-01-29

## Library Selection

### Decision
Use **Winston** (`winston`) combined with **Winston Daily Rotate File** (`winston-daily-rotate-file`).

### Rationale
- **Winston** is the most established logging library for Node.js.
- It supports multiple transports (Console + File) simultaneously, which matches our requirement for "Dual Output".
- **Daily Rotate File** is a mature plugin that handles the complexity of file rotation, naming, and cleanup (retention) automatically.
- Excellent TypeScript support via `@types/winston` and built-in types for the transport.

### Alternatives Considered
- **Pino**: Faster and JSON-native. *Rejection*: While performance is higher, Morpheus is a local CLI where extreme throughput isn't the bottleneck. Winston's formatting features are more flexible for the "human-readable" requirements of a local agent log.
- **Console-redirect**: Manually piping stdout/stderr. *Rejection*: Hard to separate "UI logs" (spinner) from "Audit logs" (debug info). Hard to implement rotation robustly.

## Implementation Pattern

### DisplayManager Singleton
The `DisplayManager` is already the single point of entry for distinct UI output (`log`, `startSpinner`). We will enhance it to hold the Winston logger instance.

- **Initialization**: Lazy-loading or Constructor-based. Since `DisplayManager` is a singleton accessed at startup, we can initialize the logger in the constructor.
- **Config Dependence**: The logger needs `ConfigManager` to know the Log Level and Retention. `ConfigManager` loads asynchronously (`load()`). We may need an `initialize()` method on `DisplayManager` that is called after `config.load()` in `bin/morpheus.js`.

### Configuration Schema
We will extend the existing Zod schema in `src/config/manager.ts`.

```typescript
// Proposed Zod Fragment
logging: z.object({
  enabled: z.boolean().default(true),
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  retention: z.string().default('14d'),
}).default(DEFAULT_CONFIG.logging)
```

## Unknowns Resolved
- **Daily Rotation Config**: valid keys are `datePattern`, `zippedArchive`, `maxSize`, `maxFiles` (which maps to retention).
- **Paths**: We need to ensure `~/.morpheus/logs` is created. `winston-daily-rotate-file` handles simple directory creation, but explicit `fs.ensureDir` in `ConfigManager` or `DisplayManager` logic is safer.
