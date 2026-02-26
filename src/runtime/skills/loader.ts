/**
 * SkillLoader - Discovers and loads skills from filesystem
 * 
 * Skills are SKILL.md files with YAML frontmatter containing metadata.
 * Format:
 * ---
 * name: my-skill
 * description: What this skill does
 * execution_mode: sync
 * ---
 * 
 * # Skill Instructions...
 */

import fs from 'fs';
import path from 'path';
import { SkillMetadataSchema } from './schema.js';
import type { Skill, SkillLoadResult, SkillLoadError } from './types.js';
import { DisplayManager } from '../display.js';

const SKILL_MD = 'SKILL.md';
const MAX_SKILL_MD_SIZE = 50 * 1024; // 50KB
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Simple YAML frontmatter parser
 * Handles basic key: value pairs and arrays
 */
function parseFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for array item (indented with -)
    if (trimmed.startsWith('- ') && currentKey && currentArray !== null) {
      currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Check for key: value
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      // Save previous array if exists
      if (currentKey && currentArray !== null && currentArray.length > 0) {
        result[currentKey] = currentArray;
      }
      currentArray = null;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      currentKey = key;

      if (value === '') {
        // Could be start of array
        currentArray = [];
      } else if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      } else if (/^\d+$/.test(value)) {
        result[key] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        result[key] = parseFloat(value);
      } else {
        // Remove quotes if present
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Save last array if exists
  if (currentKey && currentArray !== null && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

export class SkillLoader {
  private display = DisplayManager.getInstance();

  constructor(private skillsDir: string) {}

  /**
   * Scan skills directory and load all valid skills
   */
  async scan(): Promise<SkillLoadResult> {
    const skills: Skill[] = [];
    const errors: SkillLoadError[] = [];

    // Check if skills directory exists
    if (!fs.existsSync(this.skillsDir)) {
      this.display.log(`Skills directory does not exist: ${this.skillsDir}`, {
        source: 'SkillLoader',
        level: 'debug',
      });
      return { skills, errors };
    }

    // Read directory contents
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    } catch (err) {
      this.display.log(`Failed to read skills directory: ${err}`, {
        source: 'SkillLoader',
        level: 'error',
      });
      return { skills, errors };
    }

    // Process each subdirectory
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(this.skillsDir, entry.name);
      const result = this.loadSkillFromDir(dirPath, entry.name);

      if (result.skill) {
        skills.push(result.skill);
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    return { skills, errors };
  }

  /**
   * Load a single skill from a directory
   */
  private loadSkillFromDir(
    dirPath: string,
    dirName: string
  ): { skill?: Skill; error?: SkillLoadError } {
    const mdPath = path.join(dirPath, SKILL_MD);

    // Check SKILL.md exists
    if (!fs.existsSync(mdPath)) {
      return {
        error: {
          directory: dirName,
          message: `Missing ${SKILL_MD}`,
        },
      };
    }

    // Read SKILL.md content
    let rawContent: string;
    try {
      const stats = fs.statSync(mdPath);
      if (stats.size > MAX_SKILL_MD_SIZE) {
        this.display.log(
          `SKILL.md for "${dirName}" exceeds ${MAX_SKILL_MD_SIZE / 1024}KB`,
          { source: 'SkillLoader', level: 'warning' }
        );
      }
      rawContent = fs.readFileSync(mdPath, 'utf-8').slice(0, MAX_SKILL_MD_SIZE);
    } catch (err) {
      return {
        error: {
          directory: dirName,
          message: `Failed to read ${SKILL_MD}: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : undefined,
        },
      };
    }

    // Parse frontmatter
    const match = rawContent.match(FRONTMATTER_REGEX);
    if (!match) {
      return {
        error: {
          directory: dirName,
          message: `Invalid format: ${SKILL_MD} must start with YAML frontmatter (--- ... ---)`,
        },
      };
    }

    const [, frontmatterYaml, content] = match;

    // Parse YAML frontmatter
    let rawMeta: Record<string, unknown>;
    try {
      rawMeta = parseFrontmatter(frontmatterYaml);
    } catch (err) {
      return {
        error: {
          directory: dirName,
          message: `Invalid YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : undefined,
        },
      };
    }

    // Validate against schema
    const parseResult = SkillMetadataSchema.safeParse(rawMeta);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return {
        error: {
          directory: dirName,
          message: `Schema validation failed: ${issues}`,
        },
      };
    }

    const metadata = parseResult.data;

    // Build Skill object
    const skill: Skill = {
      ...metadata,
      path: mdPath,
      dirName,
      content: content.trim(),
      enabled: metadata.enabled ?? true,
      execution_mode: metadata.execution_mode ?? 'sync',
    };

    return { skill };
  }

  /**
   * Read SKILL.md content for a skill (returns just the body, no frontmatter)
   */
  readContent(skill: Skill): string | null {
    return skill.content || null;
  }
}
