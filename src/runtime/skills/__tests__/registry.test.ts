import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// Define test directory as a static string path
const TEST_DIR = process.cwd() + '/test-skills-registry';

// Mock PATHS to use test directory
vi.mock('../../../config/paths.js', () => ({
  PATHS: {
    skills: process.cwd() + '/test-skills-registry',
  },
}));

// Import after mock setup
import { SkillRegistry } from '../registry.js';

describe('SkillRegistry', () => {
  beforeEach(() => {
    SkillRegistry.resetInstance();
    fs.ensureDirSync(TEST_DIR);
  });

  afterEach(() => {
    fs.removeSync(TEST_DIR);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SkillRegistry.getInstance();
      const instance2 = SkillRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = SkillRegistry.getInstance();
      SkillRegistry.resetInstance();
      const instance2 = SkillRegistry.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('load()', () => {
    it('should load skills from directory', async () => {
      const skillDir = path.join(TEST_DIR, 'test-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'test-skill', description: 'Test skill' })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('test-skill')).toBeDefined();
    });

    it('should clear previous skills on reload', async () => {
      const skillDir = path.join(TEST_DIR, 'skill-a');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'skill-a', description: 'Skill A' })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();
      expect(registry.getAll()).toHaveLength(1);

      // Remove the skill and reload
      fs.removeSync(skillDir);
      await registry.reload();

      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('enable() / disable()', () => {
    it('should enable a disabled skill', async () => {
      const skillDir = path.join(TEST_DIR, 'toggle-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'toggle-skill', description: 'Toggle test', enabled: false })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      expect(registry.get('toggle-skill')?.enabled).toBe(false);
      expect(registry.getEnabled()).toHaveLength(0);

      const result = registry.enable('toggle-skill');
      expect(result).toBe(true);
      expect(registry.get('toggle-skill')?.enabled).toBe(true);
      expect(registry.getEnabled()).toHaveLength(1);
    });

    it('should disable an enabled skill', async () => {
      const skillDir = path.join(TEST_DIR, 'toggle-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'toggle-skill', description: 'Toggle test', enabled: true })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      expect(registry.get('toggle-skill')?.enabled).toBe(true);

      const result = registry.disable('toggle-skill');
      expect(result).toBe(true);
      expect(registry.get('toggle-skill')?.enabled).toBe(false);
      expect(registry.getEnabled()).toHaveLength(0);
    });

    it('should return false for non-existent skill', async () => {
      const registry = SkillRegistry.getInstance();
      await registry.load();

      expect(registry.enable('non-existent')).toBe(false);
      expect(registry.disable('non-existent')).toBe(false);
    });
  });

  describe('getEnabled()', () => {
    it('should return only enabled skills', async () => {
      // Create enabled skill
      const enabledDir = path.join(TEST_DIR, 'enabled-skill');
      fs.ensureDirSync(enabledDir);
      fs.writeFileSync(
        path.join(enabledDir, 'skill.yaml'),
        yaml.dump({ name: 'enabled-skill', description: 'Enabled', enabled: true })
      );

      // Create disabled skill
      const disabledDir = path.join(TEST_DIR, 'disabled-skill');
      fs.ensureDirSync(disabledDir);
      fs.writeFileSync(
        path.join(disabledDir, 'skill.yaml'),
        yaml.dump({ name: 'disabled-skill', description: 'Disabled', enabled: false })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      expect(registry.getAll()).toHaveLength(2);
      expect(registry.getEnabled()).toHaveLength(1);
      expect(registry.getEnabled()[0].name).toBe('enabled-skill');
    });
  });

  describe('getSystemPromptSection()', () => {
    it('should generate prompt section with enabled skills', async () => {
      const skillDir = path.join(TEST_DIR, 'prompt-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({
          name: 'prompt-skill',
          description: 'A skill for prompts',
          examples: ['example usage'],
        })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      const section = registry.getSystemPromptSection();
      
      expect(section).toContain('Available Skills');
      expect(section).toContain('prompt-skill');
      expect(section).toContain('A skill for prompts');
      expect(section).toContain('skill_delegate');
    });

    it('should return empty string when no skills', async () => {
      const registry = SkillRegistry.getInstance();
      await registry.load();

      const section = registry.getSystemPromptSection();
      expect(section).toBe('');
    });

    it('should not include disabled skills', async () => {
      const skillDir = path.join(TEST_DIR, 'disabled-prompt');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({
          name: 'disabled-prompt',
          description: 'Disabled skill',
          enabled: false,
        })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      const section = registry.getSystemPromptSection();
      expect(section).toBe('');
    });
  });

  describe('getContent()', () => {
    it('should return SKILL.md content', async () => {
      const skillDir = path.join(TEST_DIR, 'content-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'content-skill', description: 'Test' })
      );
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '# Instructions\n\nDo the thing.'
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      const content = registry.getContent('content-skill');
      expect(content).toBe('# Instructions\n\nDo the thing.');
    });

    it('should return null for non-existent skill', async () => {
      const registry = SkillRegistry.getInstance();
      await registry.load();

      const content = registry.getContent('non-existent');
      expect(content).toBeNull();
    });

    it('should return null for missing SKILL.md', async () => {
      const skillDir = path.join(TEST_DIR, 'no-md');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'no-md', description: 'No MD file' })
      );

      const registry = SkillRegistry.getInstance();
      await registry.load();

      const content = registry.getContent('no-md');
      expect(content).toBeNull();
    });
  });
});
