import fs from 'fs-extra';
import path from 'path';
import { PATHS } from '../config/paths.js';
import { ConfigManager } from '../config/manager.js';
import { calculateFileMd5 } from './hash-utils.js';
import { DisplayManager } from './display.js';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { GwsOAuthManager } from './gws-oauth/manager.js';

interface SyncMetadata {
  skills: Record<string, string>;
  last_sync: string;
}

/**
 * Checks if a binary is available in the system PATH.
 */
function isBinaryAvailable(name: string): boolean {
  try {
    const command = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronizes built-in Google Workspace skills to the user's skills directory.
 * Uses MD5 hashes to avoid overwriting user customizations.
 */
export async function syncGwsSkills(destOverride?: string): Promise<void> {
  const config = ConfigManager.getInstance().getGwsConfig();
  if (config.enabled === false) return;

  const display = DisplayManager.getInstance();
  const sourceDir = path.join(process.cwd(), 'gws-skills', 'skills');
  const destDir = destOverride ?? PATHS.skills;
  const hashesFile = path.join(destDir, '.gws-hashes.json');

  // Check if gws binary is available
  if (!isBinaryAvailable('gws')) {
    display.log(
      `⚠️ Google Workspace CLI (gws) not found in system PATH. GWS skills will not function.`,
      { source: 'GwsSync', level: 'warning' }
    );
  }

  // Validate auth status based on auth method
  if (config.auth_method === 'oauth') {
    try {
      const oauthStatus = await GwsOAuthManager.getInstance().getStatus();
      if (oauthStatus.status === 'pending' || oauthStatus.status === 'not_configured') {
        display.log(
          `⚠️ GWS OAuth not configured. Skills will prompt for auth on first use. Run setup from Settings → GWS tab.`,
          { source: 'GwsSync', level: 'warning' }
        );
      } else if (oauthStatus.status === 'expired') {
        display.log(
          `⚠️ GWS OAuth tokens expired. Please re-authorize from Settings → GWS tab.`,
          { source: 'GwsSync', level: 'warning' }
        );
      } else if (oauthStatus.status === 'authorized') {
        display.log(
          `✅ GWS OAuth authorized. ${oauthStatus.scopes.length > 0 ? `Scopes: ${oauthStatus.scopes.join(', ')}` : ''}`,
          { source: 'GwsSync', level: 'info' }
        );
      }
    } catch {
      // Ignore OAuth status errors — skills can still sync
    }
  } else {
    // Validate Service Account JSON if provided
    if (config.service_account_json) {
      if (!(await fs.pathExists(config.service_account_json))) {
        display.log(
          `⚠️ Google Workspace Service Account JSON not found at: ${chalk.yellow(config.service_account_json)}. GWS tools may fail to authenticate.`,
          { source: 'GwsSync', level: 'warning' }
        );
      }
    }
  }

  if (!(await fs.pathExists(sourceDir))) {
    // Silent skip if source doesn't exist (e.g. in some production environments)
    return;
  }

  try {
    let metadata: SyncMetadata = { skills: {}, last_sync: new Date().toISOString() };
    if (await fs.pathExists(hashesFile)) {
      metadata = await fs.readJson(hashesFile);
    }

    const builtInSkills = await fs.readdir(sourceDir);
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const skillName of builtInSkills) {
      const skillSourcePath = path.join(sourceDir, skillName, 'SKILL.md');
      const skillDestPath = path.join(destDir, skillName, 'SKILL.md');

      if (!(await fs.pathExists(skillSourcePath))) continue;

      const sourceHash = await calculateFileMd5(skillSourcePath);

      if (!(await fs.pathExists(skillDestPath))) {
        // New skill
        await fs.ensureDir(path.dirname(skillDestPath));
        await fs.copy(skillSourcePath, skillDestPath);
        metadata.skills[skillName] = sourceHash;
        newCount++;
      } else {
        // Existing skill - check for customization
        const destHash = await calculateFileMd5(skillDestPath);
        const lastKnownHash = metadata.skills[skillName];

        if (destHash === sourceHash) {
          // Already up to date
          continue;
        }

        if (destHash === lastKnownHash) {
          // Unmodified default, update to latest
          await fs.copy(skillSourcePath, skillDestPath);
          metadata.skills[skillName] = sourceHash;
          updatedCount++;
        } else {
          // User modified or unknown state, preserve
          skippedCount++;
        }
      }
    }

    metadata.last_sync = new Date().toISOString();
    await fs.writeJson(hashesFile, metadata, { spaces: 2 });

    if (newCount > 0 || updatedCount > 0) {
      display.log(
        `🔧 Google Workspace skills initialized: ${chalk.green(newCount)} new, ${chalk.blue(updatedCount)} updated${skippedCount > 0 ? `, ${chalk.yellow(skippedCount)} customized (skipped)` : ''}`,
        { source: 'GwsSync', level: 'info' }
      );
    }
  } catch (error) {
    display.log(`Failed to sync Google Workspace skills: ${error instanceof Error ? error.message : String(error)}`, {
      source: 'GwsSync',
      level: 'error',
    });
  }
}
