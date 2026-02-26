import fs from 'fs-extra';
import path from 'path';
import { PATHS } from '../config/paths.js';
import { ConfigManager } from '../config/manager.js';
import { DEFAULT_MCP_TEMPLATE } from '../types/mcp.js';
import chalk from 'chalk';
import ora from 'ora';
import { migrateConfigFile } from './migration.js';

const SKILLS_README = `# Morpheus Skills

This folder contains custom skills for Morpheus.

## Creating a Skill

1. Create a folder with your skill name (lowercase, hyphens allowed):
   \`\`\`
   mkdir my-skill
   \`\`\`

2. Create \`SKILL.md\` with YAML frontmatter + instructions:
   \`\`\`markdown
   ---
   name: my-skill
   description: What this skill does (max 500 chars)
   execution_mode: sync
   version: 1.0.0
   author: your-name
   tags:
     - category
   examples:
     - "Example request that triggers this skill"
   ---

   # My Skill

   Instructions for Keymaker to follow when executing this skill.

   ## Steps
   1. First step
   2. Second step

   ## Output Format
   How to format the result.
   \`\`\`

## Execution Modes

| Mode | Tool | Description |
|------|------|-------------|
| sync | skill_execute | Result returned immediately (default) |
| async | skill_delegate | Runs in background, notifies when done |

**sync** (default): Best for quick tasks like code review, analysis.
**async**: Best for long-running tasks like builds, deployments.

## How It Works

- Oracle lists available skills in its system prompt
- When a request matches a sync skill, Oracle calls \`skill_execute\`
- When a request matches an async skill, Oracle calls \`skill_delegate\`
- Keymaker has access to ALL tools (filesystem, shell, git, MCP, databases)
- Keymaker follows SKILL.md instructions to complete the task

## Frontmatter Schema

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| name | Yes | - | Unique identifier (a-z, 0-9, hyphens) |
| description | Yes | - | Short description (max 500 chars) |
| execution_mode | No | sync | sync or async |
| version | No | - | Semver (e.g., 1.0.0) |
| author | No | - | Your name |
| enabled | No | true | true/false |
| tags | No | - | Array of tags (max 10) |
| examples | No | - | Example requests (max 5) |
`;

export async function scaffold(): Promise<void> {
  const spinner = ora('Ensuring Morpheus environment...').start();

  try {
    // Create all directories
    await Promise.all([
      fs.ensureDir(PATHS.root),
      fs.ensureDir(PATHS.logs),
      fs.ensureDir(PATHS.memory),
      fs.ensureDir(PATHS.cache),
      fs.ensureDir(PATHS.commands),
      fs.ensureDir(PATHS.skills),
    ]);

    // Migrate config.yaml -> zaion.yaml if needed
    await migrateConfigFile();

    // Create config if not exists
    const configManager = ConfigManager.getInstance();
    if (!(await fs.pathExists(PATHS.config))) {
        await configManager.save({}); // Saves default config
    } else {
        await configManager.load(); // Load if exists (although load handles existence check too)
    }

    // Create mcps.json if not exists
    if (!(await fs.pathExists(PATHS.mcps))) {
      await fs.writeJson(PATHS.mcps, DEFAULT_MCP_TEMPLATE, { spaces: 2 });
    }

    // Create skills README if not exists
    const skillsReadme = path.join(PATHS.skills, 'README.md');
    if (!(await fs.pathExists(skillsReadme))) {
      await fs.writeFile(skillsReadme, SKILLS_README, 'utf-8');
    }

    spinner.succeed('Morpheus environment ready at ' + chalk.cyan(PATHS.root));
  } catch (error) {
    spinner.fail('Failed to scaffold environment');
    throw error;
  }
}
