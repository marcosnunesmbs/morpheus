import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';

import { MCPConfigFileSchema, MCPServerConfigSchema } from './schemas.js';
import { DEFAULT_MCP_TEMPLATE, type MCPConfigFile, type MCPServerConfig } from '../types/mcp.js';
import { MORPHEUS_ROOT } from './paths.js';

export type MCPServerRecord = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
};

const MCP_FILE_NAME = 'mcps.json';
const RESERVED_KEYS = new Set(['$schema']);

const readConfigFile = async (): Promise<MCPConfigFile> => {
  const configPath = path.join(MORPHEUS_ROOT, MCP_FILE_NAME);

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as MCPConfigFile;
    return MCPConfigFileSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_MCP_TEMPLATE as MCPConfigFile;
    }

    throw error;
  }
};

const writeConfigFile = async (config: MCPConfigFile): Promise<void> => {
  const configPath = path.join(MORPHEUS_ROOT, MCP_FILE_NAME);
  const tmpPath = configPath + '.tmp';
  const serialized = JSON.stringify(config, null, 2) + '\n';
  // Atomic write: write to temp file first, then rename — prevents partial writes from corrupting the live file
  await fs.writeFile(tmpPath, serialized, 'utf-8');
  await fs.rename(tmpPath, configPath);
};

const isMetadataKey = (key: string): boolean => key.startsWith('_') || RESERVED_KEYS.has(key);

const normalizeName = (rawName: string): string => rawName.replace(/^\$/, '');

const findRawKey = (config: MCPConfigFile, name: string): string | null => {
  const direct = name in config ? name : null;
  if (direct) return direct;

  const prefixed = `$${name}`;
  if (prefixed in config) return prefixed;

  return null;
};

const ensureValidName = (name: string): void => {
  if (!name || name.trim().length === 0) {
    throw new Error('Name is required.');
  }

  if (name.startsWith('_') || name === '$schema') {
    throw new Error('Reserved names cannot be used for MCP servers.');
  }
};

export class MCPManager {
  private static reloadCallback: (() => Promise<void>) | null = null;

  /** Called by Oracle after initialization so MCPManager can trigger a full agent reload. */
  static registerReloadCallback(fn: () => Promise<void>): void {
    MCPManager.reloadCallback = fn;
  }

  /**
   * Reloads MCP tools across all agents (Oracle provider, Neo catalog, Trinity catalog).
   * Requires Oracle to have been initialized (and thus have registered its callback).
   */
  static async reloadAgents(): Promise<void> {
    if (!MCPManager.reloadCallback) {
      throw new Error('Reload callback not registered — Oracle must be initialized before calling reloadAgents().');
    }
    await MCPManager.reloadCallback();
  }

  static async listServers(): Promise<MCPServerRecord[]> {
    const config = await readConfigFile();
    const servers: MCPServerRecord[] = [];

    for (const [rawName, value] of Object.entries(config)) {
      if (isMetadataKey(rawName)) continue;
      if (rawName === '$schema') continue;
      if (!value || typeof value !== 'object') continue;

      try {
        const parsed = MCPServerConfigSchema.parse(value);
        const enabled = !rawName.startsWith('$');
        servers.push({
          name: normalizeName(rawName),
          enabled,
          config: parsed,
        });
      } catch {
        continue;
      }
    }

    return servers;
  }

  static async addServer(name: string, config: MCPServerConfig): Promise<void> {
    ensureValidName(name);
    const parsedConfig = MCPServerConfigSchema.parse(config);
    const file = await readConfigFile();

    const existing = findRawKey(file, name);
    if (existing) {
      throw new Error(`Server "${name}" already exists.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      next[key] = value;
    }

    next[name] = parsedConfig;
    await writeConfigFile(next);
  }

  static async updateServer(name: string, config: MCPServerConfig): Promise<void> {
    ensureValidName(name);
    const parsedConfig = MCPServerConfigSchema.parse(config);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) {
        next[key] = parsedConfig;
      } else {
        next[key] = value;
      }
    }

    await writeConfigFile(next);
  }

  static async deleteServer(name: string): Promise<void> {
    ensureValidName(name);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) continue;
      next[key] = value;
    }

    await writeConfigFile(next);
  }

  static async setServerEnabled(name: string, enabled: boolean): Promise<void> {
    ensureValidName(name);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const targetKey = enabled ? normalizeName(rawKey) : `$${normalizeName(rawKey)}`;
    const next: MCPConfigFile = {};

    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) {
        next[targetKey] = value;
      } else {
        next[key] = value;
      }
    }

    await writeConfigFile(next);
  }
}
