# Quickstart: MCP JSON Configuration

**Feature**: 018-mcp-json-config  
**Estimated Implementation Time**: 2-3 hours

## Overview

This feature replaces hardcoded MCP server definitions with an external JSON configuration file. Users can add/remove MCP servers by editing `~/.morpheus/mcps.json`.

## Implementation Steps

### Step 1: Add MCP Types (5 min)

Create `src/types/mcp.ts` with types from [contracts/mcp-config.ts](contracts/mcp-config.ts):

```typescript
// Copy MCPServerConfig, MCPServersConfig, MCPLoadResult types
// Copy MCPServerConfigSchema, DEFAULT_MCP_TEMPLATE
```

### Step 2: Add Zod Schemas to schemas.ts (5 min)

Add `MCPServerConfigSchema` to `src/config/schemas.ts`:

```typescript
export const MCPServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'sse']),
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  _comment: z.string().optional(),
});
```

### Step 3: Create MCP Loader (20 min)

Create `src/config/mcp-loader.ts`:

```typescript
import fs from 'fs-extra';
import { PATHS } from './paths.js';
import { MCPServerConfigSchema } from './schemas.js';
import { DisplayManager } from '../runtime/display.js';

export async function loadMCPConfig(): Promise<MCPServersConfig> {
  const display = DisplayManager.getInstance();
  
  // 1. Check file exists
  if (!(await fs.pathExists(PATHS.mcps))) {
    display.log('No mcps.json found, starting without MCP tools', { source: 'MCPLoader' });
    return {};
  }
  
  // 2. Read and parse JSON
  let raw: unknown;
  try {
    const content = await fs.readFile(PATHS.mcps, 'utf-8');
    raw = JSON.parse(content);
  } catch (error) {
    display.log(`Failed to parse mcps.json: ${error}`, { level: 'error', source: 'MCPLoader' });
    return {};
  }
  
  // 3. Validate each entry
  const servers: MCPServersConfig = {};
  for (const [key, value] of Object.entries(raw as object)) {
    if (key.startsWith('_') || key.startsWith('$')) continue;
    
    const result = MCPServerConfigSchema.safeParse(value);
    if (result.success) {
      servers[key] = result.data;
      display.log(`Loaded MCP server: ${key}`, { source: 'MCPLoader' });
    } else {
      display.log(`Invalid MCP config for "${key}": ${result.error.message}`, { level: 'warning', source: 'MCPLoader' });
    }
  }
  
  return servers;
}
```

### Step 4: Update scaffold.ts (10 min)

Add `mcps.json` creation to `src/runtime/scaffold.ts`:

```typescript
import { DEFAULT_MCP_TEMPLATE } from '../types/mcp.js';

// In scaffold() function, after directory creation:
if (!(await fs.pathExists(PATHS.mcps))) {
  await fs.writeJson(PATHS.mcps, DEFAULT_MCP_TEMPLATE, { spaces: 2 });
}
```

### Step 5: Update ToolsFactory (15 min)

Modify `src/runtime/tools/factory.ts`:

```typescript
import { loadMCPConfig } from '../../config/mcp-loader.js';

export class ToolsFactory {
  static async create(): Promise<StructuredTool[]> {
    const display = DisplayManager.getInstance();
    
    // Load MCP config from file
    const mcpServers = await loadMCPConfig();
    
    if (Object.keys(mcpServers).length === 0) {
      display.log('No MCP servers configured', { level: 'info', source: 'ToolsFactory' });
      return [];
    }
    
    const client = new MultiServerMCPClient({
      mcpServers,
      onConnectionError: "ignore",
      // ... keep existing hooks
    });
    
    // ... rest of existing code
  }
}
```

### Step 6: Add CLI preAction Hook (5 min)

Update `src/cli/index.ts`:

```typescript
import { scaffold } from '../runtime/scaffold.js';

export async function cli() {
  const program = new Command();
  
  // Add preAction hook for all commands
  program.hook('preAction', async () => {
    await scaffold();
  });
  
  // ... rest of setup
}
```

### Step 7: Remove Hardcoded MCPs (5 min)

Delete the hardcoded `mcpServers` object from `factory.ts` (coingecko, coolify, context7).

## Testing Checklist

- [ ] Run `morpheus init` on fresh install → `mcps.json` created with template
- [ ] Run `morpheus init` again → existing `mcps.json` preserved
- [ ] Run `morpheus start` with empty `mcps.json` → starts with 0 tools
- [ ] Add valid MCP entry → tools loaded on restart
- [ ] Add invalid entry → warning logged, valid entries still load
- [ ] Delete `mcps.json`, run any command → file recreated

## Files Changed

| File | Change |
|------|--------|
| `src/types/mcp.ts` | NEW - MCP types and template |
| `src/config/schemas.ts` | ADD - MCPServerConfigSchema |
| `src/config/mcp-loader.ts` | NEW - Load/validate mcps.json |
| `src/runtime/scaffold.ts` | MODIFY - Add mcps.json creation |
| `src/runtime/tools/factory.ts` | MODIFY - Use loadMCPConfig() |
| `src/cli/index.ts` | MODIFY - Add preAction hook |
