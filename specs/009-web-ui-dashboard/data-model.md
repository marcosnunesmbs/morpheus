# Data Model & API Contracts

## Entities

### ServerStatus
```typescript
interface ServerStatus {
  status: 'online' | 'starting' | 'stopping';
  uptimeSeconds: number;
  pid: number;
  projectVersion: string; // package.json version
  nodeVersion: string;    // process.version
  agentName: string;      // config.agent.name
}
```

### LogFileInfo
```typescript
interface LogFileInfo {
  name: string;      // e.g., "morpheus-2026-01-29.log"
  size: number;      // bytes
  modified: string;  // ISO date
}
```

### LogEntry (Parsed)
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  metadata?: any;
}
```

## API Specification

**Base URL**: `http://localhost:<PORT>/api`

### 1. System Status
- **GET** `/status`
- **Response**: `200 OK`
  ```json
  {
    "status": "online",
    "uptimeSeconds": 120,
    "pid": 1234,
    "projectVersion": "1.0.0",
    "nodeVersion": "v18.0.0",
    "agentName": "Morpheus"
  }
  ```

### 2. Configuration
- **GET** `/config`
- **Response**: `200 OK` (Returns full config object)
  ```json
  {
    "agent": { ... },
    "llm": { ... }
  }
  ```

- **PUT** `/config`
- **Body**: Partial or Full configuration object.
- **Response**: `200 OK` (Returns updated config)
- **Error**: `400 Bad Request` (Validation failed)

### 3. Logs
- **GET** `/logs`
- **Query Params**: None
- **Response**: `200 OK`
  ```json
  [
    { "name": "morpheus-2026-01-29.log", "size": 1024, "modified": "..." }
  ]
  ```

- **GET** `/logs/:filename`
- **Query Params**: `limit` (optional number of lines, default 50)
- **Response**: `200 OK`
  ```json
  {
    "lines": [
      "2026-01-29T10:00:00 [info] System started",
      "..."
    ]
  }
  ```
