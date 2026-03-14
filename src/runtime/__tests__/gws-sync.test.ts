import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { syncGwsSkills } from '../gws-sync.js';
import { PATHS } from '../../config/paths.js';
import { ConfigManager } from '../../config/manager.js';
import { calculateMd5 } from '../hash-utils.js';
import { tmpdir } from 'os';

vi.mock('../../config/manager.js');
vi.mock('../display.js', () => ({
  DisplayManager: {
    getInstance: () => ({
      log: vi.fn(),
    }),
  },
}));

describe('GwsSync', () => {
  let mockDestDir: string;
  let mockHashesFile: string;
  const mockSourceDir = path.join(process.cwd(), 'gws-skills', 'skills');

  beforeEach(async () => {
    vi.resetAllMocks();

    // Create a truly temporary directory for this test run
    mockDestDir = path.join(tmpdir(), `morpheus-test-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mockHashesFile = path.join(mockDestDir, '.gws-hashes.json');

    vi.mocked(ConfigManager.getInstance).mockReturnValue({
      getGwsConfig: () => ({ enabled: true }),
    } as any);

    await fs.ensureDir(mockDestDir);
  });

  afterEach(async () => {
    await fs.remove(mockDestDir);
  });

  it('should copy new skills if destination does not exist', async () => {
    if (!(await fs.pathExists(mockSourceDir))) {
      console.warn('Skipping test: gws-skills/skills not found');
      return;
    }

    await syncGwsSkills(mockDestDir);

    const skills = await fs.readdir(mockSourceDir);
    if (skills.length > 0) {
      const firstSkill = skills[0];
      expect(await fs.pathExists(path.join(mockDestDir, firstSkill, 'SKILL.md'))).toBe(true);
      
      const metadata = await fs.readJson(mockHashesFile);
      expect(metadata.skills[firstSkill]).toBeDefined();
    }
  });

  it('should not overwrite customized skills', async () => {
    if (!(await fs.pathExists(mockSourceDir))) return;

    const skills = await fs.readdir(mockSourceDir);
    if (skills.length === 0) return;
    
    const skillName = skills[0];
    const destPath = path.join(mockDestDir, skillName, 'SKILL.md');
    
    // 1. Initial sync to set baseline
    await syncGwsSkills(mockDestDir);
    const originalMetadata = await fs.readJson(mockHashesFile);
    const originalHash = originalMetadata.skills[skillName];

    // 2. User modifies the file
    await fs.writeFile(destPath, 'USER CUSTOMIZATION');
    const customHash = calculateMd5('USER CUSTOMIZATION');
    expect(customHash).not.toBe(originalHash);

    // 3. Sync again
    await syncGwsSkills(mockDestDir);

    // 4. Verify file was preserved
    const content = await fs.readFile(destPath, 'utf-8');
    expect(content).toBe('USER CUSTOMIZATION');
  });
});
