import fs from 'fs-extra';
import { z } from 'zod';
import { PATHS } from './paths.js';
import { MCPServerConfigSchema } from './schemas.js';
import { DisplayManager } from '../runtime/display.js';
import type { MCPServersConfig } from '../types/mcp.js';

export async function loadMCPConfig(): Promise<MCPServersConfig> {
  const display = DisplayManager.getInstance();
  const servers: MCPServersConfig = {};

  if (!await fs.pathExists(PATHS.mcps)) {
    return servers;
  }

  let rawConfig: any;
  try {
     const content = await fs.readFile(PATHS.mcps, 'utf-8');
     if (!content.trim()) return servers; // Handle empty file
     rawConfig = JSON.parse(content);
  } catch (err: any) {
    display.log(`Failed to parse mcps.json: ${err.message}`, { level: 'error', source: 'Config' });
    return servers;
  }

  // Filter metadata keys (starting with _ or $) and the "example" template key
  const entries = Object.entries(rawConfig).filter(([key]) => !key.startsWith('_') && !key.startsWith('$') && key !== 'example');

  for (const [name, config] of entries) {
    try {
        const validated = MCPServerConfigSchema.parse(config);
        servers[name] = validated;
        display.log(`Loaded MCP server: ${name}`, { level: 'debug', source: 'Config' });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
             const issues = err.issues.map(i => i.message).join(', ');
             display.log(`Invalid MCP server '${name}': ${issues}`, { level: 'warning', source: 'Config' });
        } else {
             display.log(`Invalid MCP server '${name}': ${err.message}`, { level: 'warning', source: 'Config' });
        }
    }
  }

  return servers;
}
