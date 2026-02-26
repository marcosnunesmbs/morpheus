import { Router } from 'express';
import { SkillRegistry, updateSkillDelegateDescription } from '../../runtime/skills/index.js';
import { DisplayManager } from '../../runtime/display.js';

/**
 * Create the skills API router
 * 
 * Endpoints:
 * - GET /api/skills - List all skills
 * - GET /api/skills/:name - Get single skill with content
 * - POST /api/skills/reload - Reload skills from filesystem
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
