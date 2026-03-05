/**
 * SkillRegistry - Singleton registry for loaded skills
 */

import { PATHS } from '../../config/paths.js';
import { DisplayManager } from '../display.js';
import { SkillLoader } from './loader.js';
import type { Skill, SkillLoadResult } from './types.js';

export class SkillRegistry {
  private static instance: SkillRegistry | null = null;

  private skills: Map<string, Skill> = new Map();
  private loader: SkillLoader;
  private display = DisplayManager.getInstance();

  private constructor() {
    this.loader = new SkillLoader(PATHS.skills);
  }

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  static resetInstance(): void {
    SkillRegistry.instance = null;
  }

  /**
   * Load skills from filesystem
   */
  async load(): Promise<SkillLoadResult> {
    const result = await this.loader.scan();

    this.skills.clear();
    for (const skill of result.skills) {
      if (this.skills.has(skill.name)) {
        this.display.log(`Duplicate skill name "${skill.name}", overwriting`, {
          source: 'SkillRegistry',
          level: 'warning',
        });
      }
      this.skills.set(skill.name, skill);
    }

    // Log errors
    for (const error of result.errors) {
      this.display.log(`Failed to load skill from "${error.directory}": ${error.message}`, {
        source: 'SkillRegistry',
        level: 'warning',
      });
    }

    this.display.log(`Loaded ${this.skills.size} skills`, { source: 'SkillRegistry' });

    return result;
  }

  /**
   * Reload skills from filesystem
   */
  async reload(): Promise<SkillLoadResult> {
    return this.load();
  }

  /**
   * Get all loaded skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get only enabled skills
   */
  getEnabled(): Skill[] {
    return this.getAll().filter((s) => s.enabled);
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Enable a skill (runtime only, doesn't persist to YAML)
   */
  enable(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    skill.enabled = true;
    return true;
  }

  /**
   * Disable a skill (runtime only, doesn't persist to YAML)
   */
  disable(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    skill.enabled = false;
    return true;
  }

  /**
   * Read SKILL.md content for a skill
   */
  getContent(name: string): string | null {
    const skill = this.skills.get(name);
    if (!skill) return null;
    return skill.content || null;
  }

  /**
   * Generate system prompt section listing available skills
   */
  getSystemPromptSection(): string {
    const enabled = this.getEnabled();
    if (enabled.length === 0) {
      return '';
    }

    const skillList = enabled
      .map(s => `- **${s.name}**: ${s.description}`)
      .join('\n');

    return `## Available Skills

${skillList}

Use the \`load_skill\` tool when you need detailed instructions for handling a specific type of request.`;
  }

  /**
   * Get skill names for tool description
   */
  getSkillNamesForTool(): string {
    const enabled = this.getEnabled();
    if (enabled.length === 0) {
      return 'No skills available.';
    }
    return `Available skills: ${enabled.map((s) => s.name).join(', ')}`;
  }
}
