# Data Model: Dynamic Skills System

## TypeScript Interfaces

### SkillMetadata
Dados carregados do `skill.yaml`:

```typescript
interface SkillMetadata {
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
```

### Skill
Skill carregado em runtime com paths resolvidos:

```typescript
interface Skill extends SkillMetadata {
  /** Absolute path to skill directory */
  path: string;
  
  /** Absolute path to SKILL.md file */
  contentPath: string;
  
  /** Resolved enabled state (default: true) */
  enabled: boolean;
}
```

### SkillLoadResult
Resultado do carregamento de skills:

```typescript
interface SkillLoadResult {
  /** Successfully loaded skills */
  skills: Skill[];
  
  /** Errors encountered during loading */
  errors: SkillLoadError[];
}

interface SkillLoadError {
  /** Directory name that failed */
  directory: string;
  
  /** Error message */
  message: string;
  
  /** Full error for debugging */
  error?: Error;
}
```

## Zod Schema

```typescript
import { z } from 'zod';

export const SkillMetadataSchema = z.object({
  name: z
    .string()
    .min(1, 'Skill name is required')
    .max(64, 'Skill name must be at most 64 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      'Skill name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen'
    ),
  
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be at most 500 characters'),
  
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g., 1.0.0)')
    .optional(),
  
  author: z
    .string()
    .max(100)
    .optional(),
  
  enabled: z
    .boolean()
    .default(true),
  
  tags: z
    .array(z.string().max(32))
    .max(10)
    .optional(),
  
  examples: z
    .array(z.string().max(200))
    .max(5)
    .optional(),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;
```

## File Structure

```
~/.morpheus/skills/
├── README.md                    # Instructions for creating skills
├── code-reviewer/
│   ├── skill.yaml               # Metadata (required)
│   └── SKILL.md                 # Instructions (required)
├── github-pr-review/
│   ├── skill.yaml
│   └── SKILL.md
└── k8s-debugging/
    ├── skill.yaml
    └── SKILL.md
```

### skill.yaml Example

```yaml
name: code-reviewer
version: 1.0.0
description: "Review code snippets for bugs, style issues, and suggested improvements"
author: morpheus
enabled: true
tags:
  - development
  - code-quality
  - review
examples:
  - "Review this code for bugs"
  - "What's wrong with this function?"
  - "Can you improve this code?"
```

### SKILL.md Example

```markdown
# Code Reviewer Skill

You are now acting as a senior code reviewer.

## Instructions

1. First, identify the programming language
2. Analyze the code structure
3. Look for common issues:
   - Bugs and logic errors
   - Security vulnerabilities  
   - Performance problems
   - Code style issues
4. Provide constructive feedback

## Output Format

### Summary
Brief overview of code quality (1-2 sentences)

### Issues Found
- **[Severity]** Description of issue

### Recommendations
- Specific improvement suggestions

### What's Good
- Positive aspects of the code
```

## API Response Shapes

### GET /api/skills

```typescript
interface GetSkillsResponse {
  skills: Array<{
    name: string;
    description: string;
    version?: string;
    author?: string;
    enabled: boolean;
    tags?: string[];
    examples?: string[];
  }>;
}
```

### POST /api/skills/reload

```typescript
interface ReloadSkillsResponse {
  success: boolean;
  loaded: number;
  errors: Array<{
    directory: string;
    message: string;
  }>;
}
```

### POST /api/skills/:name/enable | /api/skills/:name/disable

```typescript
interface ToggleSkillResponse {
  success: boolean;
}
```

### Error Response

```typescript
interface SkillErrorResponse {
  error: string;
  code?: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
}
```

## System Prompt Format

Oracle recebe as skills disponíveis no system prompt:

```
## Available Skills

You have access to user-defined skills that provide specialized expertise.
When a request matches a skill's domain, use `skill_delegate` to delegate execution to Keymaker.
Keymaker has full access to filesystem, shell, git, MCP tools, and databases.

Skills available:
- **code-reviewer**: Review code snippets for bugs, style issues, and improvements
- **github-pr-review**: Review GitHub pull requests and suggest changes
- **k8s-debugging**: Debug Kubernetes deployments, pods, and services

To use a skill: call skill_delegate(skillName, objective)
The skill will be executed asynchronously and results delivered when complete.
```

## Task Schema for Keymaker

Keymaker tasks are stored in the `tasks` table with additional skill metadata:

```typescript
interface KeymakerTask {
  id: string;              // UUID
  agent: 'keymaker';       // Fixed value
  status: TaskStatus;      // pending | running | completed | failed
  input: string;           // User's objective
  context: string;         // "Skill: <skill_name>"
  skill_name: string;      // Skill identifier (stored in context or separate column)
  output?: string;         // Keymaker's result
  error?: string;          // Error if failed
  origin_channel: string;  // telegram | discord | ui | api
  session_id: string;      // Session UUID
  origin_user_id?: string; // User ID for notifications
  created_at: number;      // Timestamp
  started_at?: number;     // When worker picked it up
  finished_at?: number;    // When completed/failed
}
```

## Keymaker Config Schema

```typescript
interface KeymakerConfig {
  provider?: string;       // LLM provider (default: inherits from llm)
  model?: string;          // Model name (default: inherits from llm)
  temperature?: number;    // Temperature (default: 0.3)
  max_tokens?: number;     // Max output tokens
  personality?: string;    // Personality preset (default: 'versatile_executor')
  api_key?: string;        // Provider API key (encrypted at rest)
}
```

## Keymaker System Prompt Template

```typescript
const keymakerSystemPrompt = `
You are Keymaker, a specialized agent executing the "${skill.name}" skill.
You have access to ALL tools: filesystem, shell, git, browser, MCP tools, and databases.

## Your Objective
${objective}

## Skill Instructions
${skillContent}

Execute the skill instructions to accomplish the objective.
Be thorough and autonomous. Use the tools at your disposal.
Return a clear, actionable result.
`;
```

## Agent Comparison

| Agent | Tools | Config Key | Task Agent Value |
|-------|-------|------------|------------------|
| Oracle | Delegation only | `llm` | N/A (orchestrator) |
| Neo | MCP tools | `neo` | `'neo'` |
| Apoc | DevKit tools | `apoc` | `'apoc'` |
| Trinity | Database tools | `trinity` | `'trinit'` |
| **Keymaker** | **ALL tools** | `keymaker` | `'keymaker'` |

## Limits & Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max skill name length | 64 chars | Filesystem compatibility |
| Max description length | 500 chars | System prompt budget |
| Max tags per skill | 10 | Prevent bloat |
| Max tag length | 32 chars | Display sanity |
| Max examples per skill | 5 | Context budget |
| Max example length | 200 chars | Context budget |
| Max SKILL.md size | 50KB | Prevent context overflow |
| Max skills in prompt | 50 | ~5KB limit for descriptions |
