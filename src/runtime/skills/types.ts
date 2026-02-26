/**
 * Skills System Type Definitions
 *
 * Skills are user-defined behavioral extensions loaded from ~/.morpheus/skills/
 * Each skill is a SKILL.md file with YAML frontmatter containing metadata.
 */

/**
 * Execution mode for a skill
 * - sync: Execute inline, result returned immediately to Oracle
 * - async: Execute as background task, result delivered via notification
 */
export type SkillExecutionMode = 'sync' | 'async';

/**
 * Metadata parsed from SKILL.md frontmatter
 */
export interface SkillMetadata {
  /** Unique identifier (kebab-case, max 64 chars) */
  name: string;

  /** Short description for LLM context (max 500 chars) */
  description: string;

  /** Execution mode: sync (default) or async */
  execution_mode?: SkillExecutionMode;

  /** Semantic version (optional) */
  version?: string;

  /** Skill author (optional) */
  author?: string;

  /** Whether skill is active (default: true) */
  enabled?: boolean;

  /** Categorization tags (optional) */
  tags?: string[];

  /** Usage examples for LLM understanding (optional) */
  examples?: string[];
}

/**
 * Skill loaded in runtime with resolved paths and content
 */
export interface Skill extends SkillMetadata {
  /** Absolute path to the SKILL.md file */
  path: string;

  /** Directory name containing the skill */
  dirName: string;

  /** Skill content (markdown body after frontmatter) */
  content: string;

  /** Resolved enabled state (default: true) */
  enabled: boolean;

  /** Resolved execution mode (default: sync) */
  execution_mode: SkillExecutionMode;
}

/**
 * Result of loading skills from filesystem
 */
export interface SkillLoadResult {
  /** Successfully loaded skills */
  skills: Skill[];

  /** Errors encountered during loading */
  errors: SkillLoadError[];
}

/**
 * Error encountered while loading a skill
 */
export interface SkillLoadError {
  /** Directory name that failed */
  directory: string;

  /** Error message */
  message: string;

  /** Full error for debugging */
  error?: Error;
}
