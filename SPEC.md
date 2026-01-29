# Logging System Specification

## 1. Overview
Currently, `DisplayManager` outputs only to `console`. To aid in debugging daemon processes and auditing agent behavior, we need a persistent logging system. This system will intercept all display calls and persist them to the local filesystem within the `.morpheus` structure.

## 2. Goals
- **Persistence:** Save logs to `~/.morpheus/logs/`.
- **Dual Output:** Unify console (UX) and file (Audit) logic behind `DisplayManager`.
- **Rotation:** Manage file sizes automatically (Daily Rotation) to prevent disk bloat.
- **Configurable:** Allow users to define retention policies and log levels via `config.yaml`.

## 3. Architecture

### 3.1. Libraries
We will use standard Node.js logging libraries to handle async writes and rotation safely.
- `winston`: Core logging logic.
- `winston-daily-rotate-file`: Handling file rotation (e.g., `morpheus-2024-01-01.log`).

### 3.2. Configuration (`src/config/`)
Extend the `ConfigManager` schema (Zod) to include a logging section.

**Schema Update:**
```typescript
interface LogConfig {
  enabled: boolean;       // default: true
  level: LogLevel;       // 'debug' | 'info' | 'warn' | 'error'
  retention: string;     // default: '14d' (14 days)
}
```

### 3.3. Paths (`src/config/paths.ts`)
Define the new constant for the logs directory.
- `LOGS_DIR`: `path.join(HOME_DIR, '.morpheus', 'logs')`

## 4. Implementation Details

### 4.1. DisplayManager Refactor (`src/runtime/display.ts`)

The `DisplayManager` singleton must initialize the logger during its instantiation or lazy-load it on the first call.

**Class Structure:**
```typescript
import winston from 'winston';

export class DisplayManager {
  private static instance: DisplayManager;
  private logger: winston.Logger | null = null;

  private constructor() {
    this.initializeLogger();
  }

  private initializeLogger() {
    // 1. Read config via ConfigManager
    // 2. Ensure logical directory exists
    // 3. Setup Winston transports (Console is NOT needed here, we do it manually for UI control)
    // 4. Add DailyRotateFile transport pointing to LOGS_DIR
  }

  // Wrappers
  public log(message: string, meta?: any) {
    console.log(message); // Existing UI Logic
    this.logger?.info(message, meta); // New File Logic
  }

  public error(message: string, error?: Error) {
    console.error(message); // Existing UI Logic
    this.logger?.error(message, { stack: error?.stack }); // New File Logic
  }
}
```

### 4.2. Log Format
The file logs should be machine-parseable but human-readable.

**Format:**
`[ISO-TIMESTAMP] [LEVEL] MESSAGE {METADATA}`

**Example:**
```text
2024-01-29T10:00:00.000Z [info] Daemon started successfully {"pid": 1234}
2024-01-29T10:05:00.000Z [info] Processing message from Telegram {"user": "123456"}
2024-01-29T10:05:02.000Z [error] Provider connection failed {"provider": "openai"}
```

## 5. Workflow Changes

1.  **Daemon Start:** When `npm start -- start` runs, it calls `DisplayManager.getInstance()`. This triggers logger initialization.
2.  **Runtime:** Any call to `agent.chat()` or system errors logged via `display.log()` are automatically appended to the day's log file.
3.  **Maintenance:** The `winston-daily-rotate-file` transport will automatically delete files older than `config.logging.retention`.

## 6. Action Items
1.  `npm install winston winston-daily-rotate-file`.
2.  Update `src/config/paths.ts`.
3.  Update `src/types/config.ts` and `src/config/manager.ts` (Zod schema).
4.  Refactor `src/runtime/display.ts`.
