/**
 * SkillLoader - Discovers and loads skills from filesystem
 * 
 * Skills are SKILL.md files with YAML frontmatter containing metadata.
 * Format:
 * ---
 * name: my-skill
 * description: What this skill does
 * ---
 * 
 * # Skill Instructions...
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMetadataSchema } from './schema.js';
import type { Skill, SkillLoadResult, SkillLoadError } from './types.js';
import { DisplayManager } from '../display.js';

const SKILL_MD = 'SKILL.md';
const MAX_SKILL_MD_SIZE = 50 * 1024; // 50KB
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parses YAML frontmatter using js-yaml
 */
function parseFrontmatter(yamlContent: string): Record<string, unknown> {
  try {
    return yaml.load(yamlContent) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`YAML parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
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
