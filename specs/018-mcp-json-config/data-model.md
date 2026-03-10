# Data Model: MCP JSON Configuration

**Feature**: 018-mcp-json-config  
**Date**: February 1, 2026

## Entities

### MCPServerConfig

Represents a single MCP server configuration entry.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transport` | `"stdio" \| "sse"` | Yes | Transport protocol for MCP communication |
| `command` | `string` | Yes | Command to execute (e.g., `"npx"`, `"node"`) |
| `args` | `string[]` | No | Command arguments (default: `[]`) |
| `env` | `Record<string, string>` | No | Environment variables (default: `{}`) |
| `_comment` | `string` | No | Optional documentation comment (ignored at runtime) |

**Validation Rules**:
- `transport` must be one of the allowed values
- `command` must be a non-empty string
- `args` if present, must be an array of strings
- `env` if present, must be an object with string keys and string values

**State Transitions**: N/A (static configuration)

---

### MCPConfigFile

Represents the entire `mcps.json` file structure.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | `string` | No | JSON Schema URL for IDE support |
| `_comment` | `string` | No | File-level documentation |
| `_docs` | `string` | No | Usage documentation |
| `[serverName]` | `MCPServerConfig` | No | Dynamic keys for each MCP server |

**Structure**: Key-value object where:
- Keys starting with `_` or `$` are metadata (ignored)
- All other keys are server names mapped to `MCPServerConfig`

**Validation Rules**:
- File must be valid JSON
- Server names (keys) must be valid identifiers (no spaces, alphanumeric + underscore)
- Each server entry must validate against `MCPServerConfig` schema

---

## Relationships

```
MCPConfigFile (mcps.json)
    │
    └── contains 0..n ──► MCPServerConfig (each server entry)
                              │
                              └── consumed by ──► MultiServerMCPClient
```

---

## File Location

| Environment | Path |
|-------------|------|
| Default | `~/.morpheus/mcps.json` |
| Constant | `PATHS.mcps` in `src/config/paths.ts` |

---

## Default Template

When created by scaffold, the file contains:

```json
{
  "$schema": "https://morpheus.dev/schemas/mcps.json",
  "_comment": "MCP Server Configuration for Morpheus",
  "_docs": "Add your MCP servers below. Each key is a unique server name.",
  "example": {
    "_comment": "EXAMPLE - Remove or replace this entry with your own MCPs",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "your-mcp-package-name"],
    "env": {}
  }
}
```

---

## Runtime Behavior

### Loading Process

1. Check if `PATHS.mcps` exists
2. If not exists → return empty config `{}`
3. Read file contents
4. Parse JSON (catch syntax errors → log error, return `{}`)
5. Filter keys (exclude `$`, `_` prefixed)
6. Validate each server entry with Zod
7. Log warnings for invalid entries
8. Return valid entries only

### Integration with ToolsFactory

```typescript
// Before (hardcoded)
const client = new MultiServerMCPClient({
  mcpServers: { /* hardcoded */ }
});

// After (from config)
const mcpConfig = await loadMCPConfig();
const client = new MultiServerMCPClient({
  mcpServers: mcpConfig
});
```
