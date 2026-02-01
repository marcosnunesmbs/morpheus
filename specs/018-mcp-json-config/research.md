# Research: MCP JSON Configuration

**Feature**: 018-mcp-json-config  
**Date**: February 1, 2026

## Research Tasks

### 1. MCP Configuration Format

**Question**: What format should `mcps.json` use to configure MCP servers?

**Decision**: Use the same structure as `@langchain/mcp-adapters` `MultiServerMCPClient` expects.

**Rationale**: 
- Direct compatibility with existing `MultiServerMCPClient` API
- No transformation layer needed
- Users familiar with LangChain MCP adapters will recognize the format

**Alternatives Considered**:
- Custom simplified format → Rejected: requires transformation, loses flexibility
- YAML format → Rejected: JSON matches file extension, better IDE support for JSON Schema

**Reference**: Current hardcoded structure in `factory.ts`:
```typescript
mcpServers: {
  serverName: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "package-name"],
    env: { "KEY": "value" }
  }
}
```

---

### 2. Validation Strategy

**Question**: How to validate MCP configuration entries?

**Decision**: Use Zod schemas (already used in project) with per-entry validation.

**Rationale**:
- Consistent with existing `ConfigSchema` in `src/config/schemas.ts`
- Allows partial validation (skip invalid entries, load valid ones)
- Provides clear error messages

**Alternatives Considered**:
- JSON Schema with `ajv` → Rejected: adds new dependency, Zod already available
- No validation → Rejected: poor DX, silent failures

---

### 3. Template File Structure

**Question**: What should the default `mcps.json` template contain?

**Decision**: Include commented example entries with documentation.

**Template Structure**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "_comment": "MCP Server Configuration for Morpheus. Add your MCP servers below.",
  "_docs": "Each key is a unique server name. Required: transport, command. Optional: args, env.",
  "example-server": {
    "_comment": "EXAMPLE - Remove or modify this entry",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "your-mcp-package"],
    "env": {}
  }
}
```

**Rationale**:
- JSON doesn't support comments, but `_comment` fields are conventional
- Example entry teaches by demonstration
- `$schema` enables IDE autocompletion (future enhancement)

---

### 4. CLI Hook Location

**Question**: Where to call scaffold verification for all CLI commands?

**Decision**: Add `preAction` hook in `src/cli/index.ts` to call `scaffold()` before any command.

**Rationale**:
- Single point of modification
- Commander.js supports `preAction` hooks natively
- Ensures all commands have scaffold guarantee

**Implementation**:
```typescript
program.hook('preAction', async () => {
  await scaffold();
});
```

**Alternatives Considered**:
- Call scaffold in each command → Rejected: repetitive, easy to forget
- Only on `init` and `start` → Rejected: doesn't fulfill FR-006

---

### 5. Error Handling Behavior

**Question**: How to handle various error states?

**Decision**: Graceful degradation with clear logging.

| State | Behavior |
|-------|----------|
| File missing | Create with template (via scaffold) |
| Invalid JSON syntax | Log error, return empty MCP config |
| Invalid entry (partial) | Log warning, skip entry, continue with valid entries |
| MCP connection failure | Use existing `onConnectionError: "ignore"` |

**Rationale**: Agent should always start. MCP tools are enhancement, not requirement.

---

### 6. Idempotency Guarantee

**Question**: How to ensure scaffold is safe for concurrent/repeated execution?

**Decision**: Use `fs.pathExists()` check before any write operation.

**Rationale**:
- Already used in current `scaffold.ts` for `config.yaml`
- Atomic check-then-create pattern
- No file locking needed for this use case

---

## Resolved Clarifications

All technical questions resolved. No NEEDS CLARIFICATION markers remain.

## Dependencies Identified

| Dependency | Status | Notes |
|------------|--------|-------|
| `fs-extra` | ✅ Already installed | Used in scaffold.ts |
| `zod` | ✅ Already installed | Used in schemas.ts |
| `@langchain/mcp-adapters` | ✅ Already installed | Used in factory.ts |
| Commander.js hooks | ✅ Available | Part of commander package |
