import { Router } from 'express';
import multer from 'multer';
import extract from 'extract-zip';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SkillRegistry, updateSkillDelegateDescription } from '../../runtime/skills/index.js';
import { DisplayManager } from '../../runtime/display.js';
import { PATHS } from '../../config/paths.js';
import { SkillMetadataSchema } from '../../runtime/skills/schema.js';

// Multer config for ZIP uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

// YAML frontmatter regex
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Simple YAML frontmatter parser
 */
function parseFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey && currentArray !== null) {
      currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      if (currentKey && currentArray !== null && currentArray.length > 0) {
        result[currentKey] = currentArray;
      }
      currentArray = null;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      currentKey = key;

      if (value === '') {
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
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (currentKey && currentArray !== null && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

/**
 * Create the skills API router
 * 
 * Endpoints:
 * - GET /api/skills - List all skills
 * - GET /api/skills/:name - Get single skill with content
 * - POST /api/skills/reload - Reload skills from filesystem
 * - POST /api/skills/upload - Upload a skill ZIP
 * - POST /api/skills/:name/enable - Enable a skill
 * - POST /api/skills/:name/disable - Disable a skill
 */
export function createSkillsRouter(): Router {
  const router = Router();
  const display = DisplayManager.getInstance();

  // GET /api/skills - List all skills
  router.get('/', (_req, res) => {
    try {
      const registry = SkillRegistry.getInstance();
      const skills = registry.getAll();
      
      const response = skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        enabled: skill.enabled,
        tags: skill.tags,
        examples: skill.examples,
        path: skill.path,
      }));

      res.json({
        skills: response,
        total: skills.length,
        enabled: skills.filter(s => s.enabled).length,
      });
    } catch (err: any) {
      display.log(`Skills API error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/skills/reload - Reload from filesystem
  // Must be before /:name routes
  router.post('/reload', async (_req, res) => {
    try {
      const registry = SkillRegistry.getInstance();
      const result = await registry.reload();
      
      // Update skill_delegate tool description with new skills
      updateSkillDelegateDescription();

      display.log(`Skills reloaded: ${result.skills.length} loaded, ${result.errors.length} errors`, {
        source: 'SkillsAPI',
      });

      res.json({
        success: true,
        loaded: result.skills.length,
        errors: result.errors.map(e => ({
          directory: e.directory,
          message: e.message,
        })),
      });
    } catch (err: any) {
      display.log(`Skills reload error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/skills/upload - Upload a skill ZIP
  // Must be before /:name routes
  router.post('/upload', upload.single('file'), async (req, res) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'morpheus-skill-'));
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const zipPath = path.join(tempDir, 'skill.zip');
      const extractDir = path.join(tempDir, 'extracted');

      // Write buffer to temp file
      await fs.writeFile(zipPath, req.file.buffer);

      // Extract ZIP
      await extract(zipPath, { dir: extractDir });

      // Find root entries
      const entries = await fs.readdir(extractDir, { withFileTypes: true });
      const folders = entries.filter(e => e.isDirectory());
      const files = entries.filter(e => e.isFile());

      // Validate: exactly one folder at root, no loose files
      if (folders.length !== 1 || files.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid ZIP structure',
          details: 'ZIP must contain exactly one folder at root level (no loose files)',
        });
      }

      const skillFolderName = folders[0].name;
      const skillFolderPath = path.join(extractDir, skillFolderName);

      // Check for SKILL.md
      const skillMdPath = path.join(skillFolderPath, 'SKILL.md');
      if (!await fs.pathExists(skillMdPath)) {
        return res.status(400).json({
          error: 'Missing SKILL.md',
          details: `Folder "${skillFolderName}" must contain a SKILL.md file`,
        });
      }

      // Read and validate SKILL.md frontmatter
      const skillMdContent = await fs.readFile(skillMdPath, 'utf-8');
      const match = skillMdContent.match(FRONTMATTER_REGEX);
      
      if (!match) {
        return res.status(400).json({
          error: 'Invalid SKILL.md format',
          details: 'SKILL.md must have YAML frontmatter between --- delimiters',
        });
      }

      const [, frontmatterYaml] = match;
      const rawMetadata = parseFrontmatter(frontmatterYaml);

      // Validate with Zod schema
      const parseResult = SkillMetadataSchema.safeParse(rawMetadata);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return res.status(400).json({
          error: 'Invalid skill metadata',
          details: issues.join('; '),
        });
      }

      const metadata = parseResult.data;

      // Check if skill already exists
      const targetPath = path.join(PATHS.skills, metadata.name);
      if (await fs.pathExists(targetPath)) {
        return res.status(409).json({
          error: 'Skill already exists',
          details: `A skill named "${metadata.name}" already exists. Delete it first or choose a different name.`,
        });
      }

      // Copy to skills directory
      await fs.copy(skillFolderPath, targetPath);

      // Reload skills
      const registry = SkillRegistry.getInstance();
      await registry.reload();
      updateSkillDelegateDescription();

      display.log(`Skill "${metadata.name}" uploaded successfully`, { source: 'SkillsAPI' });

      res.json({
        success: true,
        skill: {
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          author: metadata.author,
          path: targetPath,
        },
      });
    } catch (err: any) {
      display.log(`Skill upload error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    } finally {
      // Cleanup temp directory
      await fs.remove(tempDir).catch(() => {});
    }
  });

  // GET /api/skills/:name - Get single skill with content
  router.get('/:name', (req, res) => {
    try {
      const { name } = req.params;
      const registry = SkillRegistry.getInstance();
      const skill = registry.get(name);

      if (!skill) {
        return res.status(404).json({ error: `Skill "${name}" not found` });
      }

      const content = registry.getContent(name);

      res.json({
        ...skill,
        content: content || null,
      });
    } catch (err: any) {
      display.log(`Skills API error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/skills/:name/enable - Enable a skill
  router.post('/:name/enable', (req, res) => {
    try {
      const { name } = req.params;
      const registry = SkillRegistry.getInstance();
      const success = registry.enable(name);

      if (!success) {
        return res.status(404).json({ error: `Skill "${name}" not found` });
      }

      // Update skill_delegate tool description
      updateSkillDelegateDescription();

      display.log(`Skill "${name}" enabled`, { source: 'SkillsAPI' });
      res.json({ success: true, name, enabled: true });
    } catch (err: any) {
      display.log(`Skills API error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/skills/:name/disable - Disable a skill
  router.post('/:name/disable', (req, res) => {
    try {
      const { name } = req.params;
      const registry = SkillRegistry.getInstance();
      const success = registry.disable(name);

      if (!success) {
        return res.status(404).json({ error: `Skill "${name}" not found` });
      }

      // Update skill_delegate tool description
      updateSkillDelegateDescription();

      display.log(`Skill "${name}" disabled`, { source: 'SkillsAPI' });
      res.json({ success: true, name, enabled: false });
    } catch (err: any) {
      display.log(`Skills API error: ${err.message}`, { source: 'SkillsAPI', level: 'error' });
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
