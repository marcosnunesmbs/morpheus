/**
 * Skills System - Public API
 */

export { SkillRegistry } from './registry.js';
export { SkillLoader } from './loader.js';
export { SkillMetadataSchema } from './schema.js';
export {
  SkillExecuteTool,
  SkillDelegateTool,
  getSkillExecuteDescription,
  getSkillDelegateDescription,
  updateSkillToolDescriptions,
  updateSkillDelegateDescription, // backwards compat
} from './tool.js';
export type {
  Skill,
  SkillMetadata,
  SkillLoadResult,
  SkillLoadError,
  SkillExecutionMode,
} from './types.js';
