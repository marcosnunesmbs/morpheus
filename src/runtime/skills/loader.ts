/**
 * SkillLoader - Discovers and loads skills from filesystem
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SkillMetadataSchema } from './schema.js';
import type { Skill, SkillLoadResult, SkillLoadError, SkillMetadata } from './types.js';
import { DisplayManager } from '../display.js';

const SKILL_YAML = 'skill.yaml';
const SKILL_MD = 'SKILL.md';
const MAX_SKILL_MD_SIZE = 50 * 1024; // 50KB

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
    const yamlPath = path.join(dirPath, SKILL_YAML);
    const mdPath = path.join(dirPath, SKILL_MD);

    // Check skill.yaml exists
    if (!fs.existsSync(yamlPath)) {
      return {
        error: {
          directory: dirName,
          message: `Missing ${SKILL_YAML}`,
        },
      };
    }

    // Parse skill.yaml
    let rawYaml: unknown;
    try {
      const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
      rawYaml = yaml.load(yamlContent);
    } catch (err) {
      return {
        error: {
          directory: dirName,
          message: `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : undefined,
        },
      };
    }

    // Validate against schema
    const parseResult = SkillMetadataSchema.safeParse(rawYaml);
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

    // Check SKILL.md exists (warning only, skill still loads)
    const hasSkillMd = fs.existsSync(mdPath);
    if (!hasSkillMd) {
      this.display.log(`Skill "${metadata.name}" is missing ${SKILL_MD}`, {
        source: 'SkillLoader',
        level: 'warning',
      });
    }

    // Build Skill object
    const skill: Skill = {
      ...metadata,
      path: dirPath,
      contentPath: mdPath,
      enabled: metadata.enabled ?? true,
    };

    return { skill };
  }

  /**
   * Read SKILL.md content for a skill (lazy loading)
   */
  readContent(skill: Skill): string | null {
    if (!fs.existsSync(skill.contentPath)) {
      return null;
    }

    try {
      const stats = fs.statSync(skill.contentPath);
      if (stats.size > MAX_SKILL_MD_SIZE) {
        this.display.log(
          `SKILL.md for "${skill.name}" exceeds ${MAX_SKILL_MD_SIZE / 1024}KB, truncating`,
          { source: 'SkillLoader', level: 'warning' }
        );
      }

      const content = fs.readFileSync(skill.contentPath, 'utf-8');
      return content.slice(0, MAX_SKILL_MD_SIZE);
    } catch (err) {
      this.display.log(`Failed to read SKILL.md for "${skill.name}": ${err}`, {
        source: 'SkillLoader',
        level: 'error',
      });
      return null;
    }
  }
}
