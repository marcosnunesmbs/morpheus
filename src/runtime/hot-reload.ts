/**
 * Hot-reload module for Morpheus configuration changes.
 * 
 * This module allows config changes to take effect without restarting the daemon.
 * It reinitializes agents that have already been initialized, and resets lazy-loaded
 * singletons so they pick up new config on next use.
 */

import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from './display.js';
import { Apoc } from './apoc.js';
import { Neo } from './neo.js';
import { Trinity } from './trinity.js';
import { IOracle } from './types.js';

let currentOracle: IOracle | null = null;

/**
 * Register the current Oracle instance for hot-reload.
 * Called from start.ts after Oracle initialization.
 */
export function registerOracleForHotReload(oracle: IOracle): void {
  currentOracle = oracle;
}

/**
 * Hot-reload configuration changes.
 * 
 * This function:
 * 1. Reloads config from disk (zaion.yaml)
 * 2. Reinitializes Oracle with new config
 * 3. Resets subagent singletons (they reinitialize lazily on next use)
 * 
 * Note: Some changes still require full restart:
 * - Channel tokens (Telegram, Discord)
 * - UI port changes
 * - Chronos check_interval_ms
 */
export async function hotReloadConfig(): Promise<{
  success: boolean;
  reinitialized: string[];
  message: string;
}> {
  const display = DisplayManager.getInstance();
  const reinitialized: string[] = [];

  try {
    // 1. Reload configuration from disk
    await ConfigManager.getInstance().load();
    display.log('Configuration reloaded from disk', { source: 'HotReload', level: 'info' });

    // 2. Reinitialize Oracle if it exists
    if (currentOracle && typeof (currentOracle as any).reinitialize === 'function') {
      await (currentOracle as any).reinitialize();
      reinitialized.push('Oracle');
      display.log('Oracle reinitialized with new config', { source: 'HotReload', level: 'info' });
    }

    // 3. Reset subagent singletons - they will reinitialize with new config on next use
    Apoc.resetInstance();
    Neo.resetInstance();
    Trinity.resetInstance();
    reinitialized.push('Apoc', 'Neo', 'Trinity');
    display.log('Subagent singletons reset (will reinitialize on next use)', { source: 'HotReload', level: 'info' });

    return {
      success: true,
      reinitialized,
      message: `Hot-reload complete. Reinitialized: ${reinitialized.join(', ')}`
    };
  } catch (error: any) {
    display.log(`Hot-reload failed: ${error.message}`, { source: 'HotReload', level: 'error' });
    return {
      success: false,
      reinitialized,
      message: `Hot-reload failed: ${error.message}`
    };
  }
}

/**
 * Check which config changes require a full restart vs hot-reload.
 */
export function getRestartRequiredChanges(oldConfig: any, newConfig: any): string[] {
  const restartRequired: string[] = [];

  // Channel token changes require restart
  if (oldConfig.channels?.telegram?.token !== newConfig.channels?.telegram?.token) {
    restartRequired.push('Telegram token');
  }
  if (oldConfig.channels?.discord?.token !== newConfig.channels?.discord?.token) {
    restartRequired.push('Discord token');
  }

  // Channel enabled state changes require restart
  if (oldConfig.channels?.telegram?.enabled !== newConfig.channels?.telegram?.enabled) {
    restartRequired.push('Telegram enabled state');
  }
  if (oldConfig.channels?.discord?.enabled !== newConfig.channels?.discord?.enabled) {
    restartRequired.push('Discord enabled state');
  }

  // UI port changes require restart
  if (oldConfig.ui?.port !== newConfig.ui?.port) {
    restartRequired.push('UI port');
  }

  // Chronos interval requires restart (it's read once in constructor)
  if (oldConfig.chronos?.check_interval_ms !== newConfig.chronos?.check_interval_ms) {
    restartRequired.push('Chronos check interval');
  }

  return restartRequired;
}
