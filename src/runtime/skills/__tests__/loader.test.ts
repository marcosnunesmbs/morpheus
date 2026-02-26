import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../loader.js';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

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
      
      const metadata = {
        name: 'test-skill',
        description: 'A test skill for unit testing',
        version: '1.0.0',
        author: 'Test Author',
        enabled: true,
        tags: ['test', 'unit'],
        examples: ['do something', 'do another thing'],
      };
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump(metadata)
      );
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '# Test Skill\n\nInstructions here.'
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      
      const skill = result.skills[0];
      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe('A test skill for unit testing');
      expect(skill.version).toBe('1.0.0');
      expect(skill.author).toBe('Test Author');
      expect(skill.enabled).toBe(true);
      expect(skill.tags).toEqual(['test', 'unit']);
      expect(skill.examples).toEqual(['do something', 'do another thing']);
    });

    it('should load skill with minimal metadata', async () => {
      const skillDir = path.join(testDir, 'minimal-skill');
      fs.ensureDirSync(skillDir);
      
      const metadata = {
        name: 'minimal-skill',
        description: 'A minimal skill',
      };
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump(metadata)
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      
      const skill = result.skills[0];
      expect(skill.name).toBe('minimal-skill');
      expect(skill.enabled).toBe(true); // default
    });

    it('should report error for missing skill.yaml', async () => {
      const skillDir = path.join(testDir, 'no-yaml-skill');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '# No YAML\n'
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].directory).toBe('no-yaml-skill');
      expect(result.errors[0].message).toContain('Missing skill.yaml');
    });

    it('should report error for invalid YAML syntax', async () => {
      const skillDir = path.join(testDir, 'invalid-yaml');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        'name: test\n  invalid: yaml: syntax:'
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].directory).toBe('invalid-yaml');
      expect(result.errors[0].message).toContain('Invalid YAML');
    });

    it('should report error for schema validation failure', async () => {
      const skillDir = path.join(testDir, 'bad-schema');
      fs.ensureDirSync(skillDir);
      
      // Missing required 'description' field
      const metadata = {
        name: 'bad-schema',
      };
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump(metadata)
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Schema validation failed');
    });

    it('should reject invalid skill name format', async () => {
      const skillDir = path.join(testDir, 'invalid-name');
      fs.ensureDirSync(skillDir);
      
      const metadata = {
        name: 'Invalid Name With Spaces!',
        description: 'Should fail validation',
      };
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump(metadata)
      );

      const result = await loader.scan();
      
      expect(result.skills).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Schema validation failed');
    });

    it('should load multiple skills', async () => {
      // Create skill 1
      const skill1Dir = path.join(testDir, 'skill-one');
      fs.ensureDirSync(skill1Dir);
      fs.writeFileSync(
        path.join(skill1Dir, 'skill.yaml'),
        yaml.dump({ name: 'skill-one', description: 'First skill' })
      );

      // Create skill 2
      const skill2Dir = path.join(testDir, 'skill-two');
      fs.ensureDirSync(skill2Dir);
      fs.writeFileSync(
        path.join(skill2Dir, 'skill.yaml'),
        yaml.dump({ name: 'skill-two', description: 'Second skill' })
      );

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
  });

  describe('readContent()', () => {
    it('should return SKILL.md content', async () => {
      const skillDir = path.join(testDir, 'content-skill');
      fs.ensureDirSync(skillDir);
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'content-skill', description: 'Test' })
      );
      
      const mdContent = '# Content Skill\n\nThis is the instruction content.';
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), mdContent);

      const result = await loader.scan();
      expect(result.skills).toHaveLength(1);
      
      const content = loader.readContent(result.skills[0]);
      expect(content).toBe(mdContent);
    });

    it('should return null for missing SKILL.md', async () => {
      const skillDir = path.join(testDir, 'no-md-skill');
      fs.ensureDirSync(skillDir);
      
      fs.writeFileSync(
        path.join(skillDir, 'skill.yaml'),
        yaml.dump({ name: 'no-md-skill', description: 'Test' })
      );

      const result = await loader.scan();
      expect(result.skills).toHaveLength(1);
      
      const content = loader.readContent(result.skills[0]);
      expect(content).toBeNull();
    });
  });
});
