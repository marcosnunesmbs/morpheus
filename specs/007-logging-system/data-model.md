# Data Model: Logging System

**Branch**: `007-logging-system`
**Date**: 2026-01-29

## Configuration Entities

The primary data structures are extensions to the existing Configuration types.

### `LogConfig`

Added to `src/types/config.ts`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master switch for file logging. |
| `level` | `string` | `'info'` | Minimum severity level to persist. Options: `debug`, `info`, `warn`, `error`. |
| `retention` | `string` | `'14d'` | Duration to keep logs. Format: number + 'd' (days). Passed to `maxFiles` in winston. |

### `MorpheusConfig` (Extended)

```typescript
export interface MorpheusConfig {
  // ... existing fields ...
  logging: LogConfig;
}
```

## Log File Format

**Location**: `~/.morpheus/logs/` or (`%USERPROFILE%\.morpheus\logs\` on Windows).
**Naming Convention**: `morpheus-%DATE%.log` (e.g., `morpheus-2026-01-29.log`).

**Content Structure**:
Each line represents a JSON object or specific text format. We will use a **Text Format** for human readability as requested in Spec.

`[ISO-8601 Timestamp] [Level] Message {JSON Metadata}`

**Example**:
```text
2026-01-29T10:00:00.123Z [info] Daemon initialized {"pid": 4567, "nodeVersion": "v20.10.0"}
2026-01-29T10:01:05.000Z [warn] LLM Provider slow response {"provider": "openai", "latency": 4500}
2026-01-29T10:05:00.000Z [error] Connection timeout {"stack": "Error: ..."}
```

## State Transitions
Logging is stateless (append-only), but file lifecycle is managed:
1.  **Creation**: On first write of the day.
2.  **Append**: On every `log()` call.
3.  **Rotation**: At midnight (handled by library).
4.  **Deletion**: After retention period (handled by library).
