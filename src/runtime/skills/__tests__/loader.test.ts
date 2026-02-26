import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../loader.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Helper to create SKILL.md with YAML frontmatter
 */
function createSkillMd(dir: string, frontmatter: Record<string, unknown>, content: string = ''): void {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  const yaml = lines.join('\n');
  const md = `---\n${yaml}\n---\n${content}`;
  fs.writeFileSync(path.join(dir, 'SKILL.md'), md);
}

describe('SkillLoader', () => {
  const testDir = path.join(process.cwd(), 'test-skills');
  let loader: SkillLoader;

  beforeEach(() => {
    fs.ensureDirSync(testDir);
    loader = new SkillLoader(testDir);
  });

  afterEach(() => {
    fs.removeSync(testDir);
  });

  describe('scan()', () => {
    it('should return empty list for non-existent directory', async () => {
      fs.removeSync(testDir);
      const result = await loader.scan();
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return empty list for empty directory', async () => {
      const result = await loader.scan();
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should load valid skill with all metadata', async () => {
      const skillDir = path.join(testDir, 'test-skill');
      fs.ensureDirSync(skillDir);
      
      createSkillMd(skillDir, {
        name: 'test-skill',
        description: 'A test skill for unit testing',
        version: '1.0.0',
        author: 'Test Author',
        enabled: true,
        execution_mode: 'sync',
        tags: ['test', 'unit'],
        examples: ['do something', 'do another thing'],
      }, '# Test Skill\n\nInstructions here.');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      
      const skill = result.skills[0];
      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe('A test skill for unit testing');
      expect(skill.version).toBe('1.0.0');
      expect(skill.author).toBe('Test Author');
      expect(skill.enabled).toBe(true);
      expect(skill.execution_mode).toBe('sync');
      expect(skill.tags).toEqual(['test', 'unit']);
      expect(skill.examples).toEqual(['do something', 'do another thing']);
      expect(skill.content).toBe('# Test Skill\n\nInstructions here.');
    });

    it('should load skill with minimal metadata (defaults)', async () => {
      const skillDir = path.join(testDir, 'minimal-skill');
      fs.ensureDirSync(skillDir);
      
      createSkillMd(skillDir, {
        name: 'minimal-skill',
        description: 'A minimal skill',
      }, 'Minimal instructions');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      
      const skill = result.skills[0];
      expect(skill.name).toBe('minimal-skill');
      expect(skill.enabled).toBe(true); // default
      expect(skill.execution_mode).toBe('sync'); // default
    });

    it('should report error for missing SKILL.md', async () => {
      const skillDir = path.join(testDir, 'no-md-skill');
      fs.ensureDirSync(skillDir);
      // No SKILL.md file created

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].directory).toBe('no-md-skill');
      expect(result.errors[0].message).toContain('Missing SKILL.md');
    });

    it('should report error for SKILL.md without frontmatter', async () => {
      const skillDir = path.join(testDir, 'no-frontmatter');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '# No Frontmatter\n\nJust plain markdown.'
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].directory).toBe('no-frontmatter');
      expect(result.errors[0].message).toContain('Invalid format');
    });

    it('should report error for schema validation failure', async () => {
      const skillDir = path.join(testDir, 'bad-schema');
      fs.ensureDirSync(skillDir);
      
      // Missing required 'description' field
      createSkillMd(skillDir, {
        name: 'bad-schema',
      }, 'No description provided');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Schema validation failed');
    });

    it('should reject invalid skill name format', async () => {
      const skillDir = path.join(testDir, 'invalid-name');
      fs.ensureDirSync(skillDir);
      
      createSkillMd(skillDir, {
        name: 'Invalid Name With Spaces!',
        description: 'Should fail validation',
      }, 'Content');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Schema validation failed');
    });

    it('should load multiple skills', async () => {
      // Create skill 1
      const skill1Dir = path.join(testDir, 'skill-one');
      fs.ensureDirSync(skill1Dir);
      createSkillMd(skill1Dir, { name: 'skill-one', description: 'First skill' }, 'Instructions 1');

      // Create skill 2
      const skill2Dir = path.join(testDir, 'skill-two');
      fs.ensureDirSync(skill2Dir);
      createSkillMd(skill2Dir, { name: 'skill-two', description: 'Second skill' }, 'Instructions 2');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const names = result.skills.map(s => s.name).sort();
      expect(names).toEqual(['skill-one', 'skill-two']);
    });

    it('should ignore non-directory entries', async () => {
      // Create a file instead of directory
      fs.writeFileSync(path.join(testDir, 'not-a-dir.yaml'), 'name: test');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should load async skill correctly', async () => {
      const skillDir = path.join(testDir, 'async-skill');
      fs.ensureDirSync(skillDir);
      
      createSkillMd(skillDir, {
        name: 'async-skill',
        description: 'An async skill',
        execution_mode: 'async',
      }, 'Long-running task instructions');

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].execution_mode).toBe('async');
    });
  });

  describe('content handling', () => {
    it('should include content in skill object', async () => {
      const skillDir = path.join(testDir, 'content-skill');
      fs.ensureDirSync(skillDir);
      
      const mdContent = '# Content Skill\n\nThis is the instruction content.';
      createSkillMd(skillDir, { name: 'content-skill', description: 'Test' }, mdContent);

      const result = await loader.scan();
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].content).toBe(mdContent);
    });

    it('should handle empty content after frontmatter', async () => {
      const skillDir = path.join(testDir, 'empty-content');
      fs.ensureDirSync(skillDir);
      
      createSkillMd(skillDir, { name: 'empty-content', description: 'Test' }, '');

      const result = await loader.scan();
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].content).toBe('');
    });
  });
});
