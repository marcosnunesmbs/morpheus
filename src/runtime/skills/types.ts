/**
 * Skills System Type Definitions
 *
 * Skills are user-defined behavioral extensions loaded from ~/.morpheus/skills/
 * Each skill has metadata (skill.yaml) and instructions (SKILL.md).
 */

/**
 * Metadata loaded from skill.yaml
 */
export interface SkillMetadata {
  /** Unique identifier (alphanumeric + hyphen, max 64 chars) */
  name: string;

  /** Short description for LLM context (max 500 chars) */
  description: string;

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
 * Skill loaded in runtime with resolved paths
 */
export interface Skill extends SkillMetadata {
  /** Absolute path to skill directory */
  path: string;

  /** Absolute path to SKILL.md file */
  contentPath: string;

  /** Resolved enabled state (default: true) */
  enabled: boolean;
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
