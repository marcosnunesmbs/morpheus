# Implementation Plan: Dynamic Skills System

**Branch**: `025-skills-system` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)

## Summary

Implement a dynamic skills system that allows users to extend Morpheus capabilities by placing skill definitions in `~/.morpheus/skills/`. Each skill consists of metadata (skill.yaml) and instructions (SKILL.md). Oracle lists enabled skills in its system prompt and delegates execution to **Keymaker** — a new agent with access to ALL tools (DevKit + MCP + DB).

**Why Keymaker?** In the Matrix universe, the Keymaker can "open any door" — perfect metaphor for an agent with universal access to all system tools.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18, ESM)
**Primary Dependencies**: `zod` (schema validation), `js-yaml` (YAML parsing)
**Storage**: Filesystem (`~/.morpheus/skills/`)
**Testing**: Vitest
**Target Platform**: Local daemon (CLI + HTTP + channels)

## Constitution Check

- [x] Local-first (skills stored in user's filesystem)
- [x] No external dependencies for skill storage
- [x] Maintains Oracle orchestration role (delegates to Keymaker)
- [x] Compatible with existing tool architecture
- [x] Async execution via TaskWorker

## Scope

### In Scope

- SkillLoader for filesystem discovery
- SkillRegistry singleton for runtime state
- Skill schema validation with Zod
- **Keymaker agent** with full tool access
- `skill_delegate` tool for Oracle
- TaskWorker routing for `agent: 'keymaker'`
- Oracle system prompt integration
- HTTP API endpoints (/api/skills)
- Telegram/Discord commands
- Basic UI page for skill management

### Out of Scope (Future)

- Skill marketplace / sharing
- Embedding-based skill selection
- Skill versioning / dependencies
- Skill sandboxing / security scanning
- Skill analytics / usage tracking

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ~/.morpheus/skills/                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ skill-a/     │  │ skill-b/     │  │ skill-c/     │          │
│  │ ├ skill.yaml │  │ ├ skill.yaml │  │ ├ skill.yaml │          │
│  │ └ SKILL.md   │  │ └ SKILL.md   │  │ └ SKILL.md   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SkillLoader                                 │
│  - scanDirectory(): Skill[]                                      │
│  - parseSkillYaml(path): SkillMetadata                          │
│  - validateSchema(data): Result<Skill, ZodError>                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SkillRegistry (Singleton)                     │
│  - skills: Map<string, Skill>                                    │
│  - load(): void                                                  │
│  - reload(): void                                                │
│  - getEnabled(): Skill[]                                         │
│  - enable(name): void                                            │
│  - disable(name): void                                           │
│  - getContent(name): string                                      │
│  - getSystemPromptSection(): string                              │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Oracle         │  │  HTTP API       │  │  Telegram       │
│  (system prompt)│  │  /api/skills    │  │  /skills cmd    │
│  skill_delegate │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼ skill_delegate("code-reviewer", "Review PR #123")
┌─────────────────────────────────────────────────────────────────┐
│                      TaskRepository                              │
│  Creates: { agent: 'keymaker', skill: 'code-reviewer', ... }    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ TaskWorker picks up
┌─────────────────────────────────────────────────────────────────┐
│                        Keymaker                                  │
│  "The one who opens any door"                                   │
│                                                                  │
│  System Prompt: SKILL.md content + user objective               │
│                                                                  │
│  Tools: DevKit (Apoc's) + MCP (Neo's) + DB (Trinity's)          │
│         ─────────────────────────────────────────────           │
│         filesystem, shell, git, browser, network,               │
│         MCP servers, PostgreSQL, MySQL, SQLite, MongoDB         │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TaskNotifier                                │
│  Routes result back to origin channel                            │
└─────────────────────────────────────────────────────────────────┘
```

## Execution Flow

```
1. User: "Review PR #123 on repo morpheus"
2. Oracle: identifies "github-pr-review" skill matches
3. Oracle: calls skill_delegate("github-pr-review", "Review PR #123 on repo morpheus")
4. TaskRepository: creates task { agent: 'keymaker', skill: 'github-pr-review', input: '...' }
5. Oracle: responds "Task created: <id> (keymaker/github-pr-review)"
6. TaskWorker: picks up task, calls createKeymaker("github-pr-review")
7. Keymaker: instantiated with SKILL.md as system prompt
8. Keymaker: uses git tools to fetch PR, filesystem to read files, etc.
9. Keymaker: returns review result
10. TaskNotifier: sends result to user's origin channel
```

## File-Level Plan

### New Files

#### `src/runtime/skills/types.ts`
```typescript
export interface SkillMetadata {
  name: string;
  version?: string;
  description: string;
  author?: string;
  enabled?: boolean;
  tags?: string[];
  examples?: string[];
}

export interface Skill extends SkillMetadata {
  path: string;           // Directory path
  contentPath: string;    // SKILL.md path
  enabled: boolean;
}
```

#### `src/runtime/skills/schema.ts`
Zod schema for skill.yaml validation.
```typescript
export const SkillMetadataSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  version: z.string().optional(),
  description: z.string().min(1).max(500),
  author: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
});
```

#### `src/runtime/skills/loader.ts`
```typescript
export class SkillLoader {
  constructor(private skillsDir: string) {}
  
  async scan(): Promise<Skill[]>;
  private parseSkillYaml(dirPath: string): SkillMetadata | null;
  private validateSkill(meta: SkillMetadata, dirPath: string): Skill | null;
}
```

#### `src/runtime/skills/registry.ts`
```typescript
export class SkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, Skill> = new Map();
  
  static getInstance(): SkillRegistry;
  
  async load(): Promise<void>;
  async reload(): Promise<void>;
  
  getAll(): Skill[];
  getEnabled(): Skill[];
  get(name: string): Skill | undefined;
  
  enable(name: string): boolean;
  disable(name: string): boolean;
  
  getContent(name: string): string | null;
  getSystemPromptSection(): string;
}
```

#### `src/runtime/skills/index.ts`
Re-exports and initialization helper.

#### `src/runtime/skills/tool.ts`
skill_delegate tool for Oracle (similar to apoc_delegate, neo_delegate).
```typescript
export function createSkillDelegateTool(
  taskRepo: TaskRepository,
  context: TaskRequestContext
): StructuredTool {
  return tool({
    name: "skill_delegate",
    description: "Delegate a task to Keymaker using a specific skill. {available_skills}",
    schema: z.object({
      skillName: z.string().describe("Name of the skill to use"),
      objective: z.string().describe("What Keymaker should accomplish"),
    }),
    func: async ({ skillName, objective }) => {
      const registry = SkillRegistry.getInstance();
      const skill = registry.get(skillName);
      if (!skill) {
        return `Error: Skill "${skillName}" not found.`;
      }
      
      const taskId = await taskRepo.create({
        agent: 'keymaker',
        input: objective,
        context: `Skill: ${skillName}`,
        skill_name: skillName,
        origin_channel: context.originChannel,
        session_id: context.sessionId,
        origin_user_id: context.userId,
      });
      
      return `Task created: ${taskId} (keymaker/${skillName})`;
    },
  });
}
```

#### `src/runtime/keymaker.ts`
New agent with full tool access.
```typescript
import { buildDevKit } from '../devkit/index.js';
import { loadMcpTools } from './tools/factory.js';
import { buildTrinityTools } from './trinity-tools.js';

export async function createKeymaker(
  skillName: string,
  objective: string
): Promise<string> {
  const registry = SkillRegistry.getInstance();
  const skillContent = registry.getContent(skillName);
  const skill = registry.get(skillName);
  
  if (!skillContent) {
    throw new Error(`SKILL.md not found for skill: ${skillName}`);
  }
  
  const tools = [
    ...buildDevKit(),           // Filesystem, shell, git, browser, etc.
    ...await loadMcpTools(),    // All MCP servers
    ...buildTrinityTools(),     // Database tools
  ];
  
  const systemPrompt = `
You are Keymaker, a specialized agent executing the "${skill.name}" skill.
You have access to ALL tools: filesystem, shell, git, browser, MCP tools, and databases.

## Your Objective
${objective}

## Skill Instructions
${skillContent}

Execute the skill instructions to accomplish the objective.
Be thorough and autonomous. Use the tools at your disposal.
`;

  const llm = await createLLM('keymaker');
  const agent = createReactAgent({ llm, tools });
  
  const result = await agent.invoke({
    messages: [new HumanMessage(objective)],
  }, { configurable: { systemPrompt } });
  
  return extractFinalResponse(result);
}
```

### Modified Files

#### `src/config/paths.ts`
Add `PATHS.skills` constant:
```typescript
export const PATHS = {
  // ... existing
  skills: path.join(root, 'skills'),
};
```

#### `src/runtime/scaffold.ts`
Ensure `~/.morpheus/skills/` directory exists on init.

#### `src/runtime/oracle.ts`
- Import SkillRegistry
- Add skills section to system prompt via `SkillRegistry.getSystemPromptSection()`
- Add `skill_delegate` tool to Oracle's tool list

#### `src/cli/commands/start.ts`
- Initialize SkillRegistry before Oracle
- Log skill count on startup

#### `src/runtime/tasks/worker.ts`
- Add routing for `agent: 'keymaker'`
- Call `createKeymaker(skillName, input)` for keymaker tasks

#### `src/config/schemas.ts`
- Add `keymaker` config schema (similar to apoc/neo/trinity)

#### `src/types/config.ts`
- Add `KeymakerConfig` interface

#### `src/http/api.ts`
Add skill routes:
```typescript
// GET /api/skills - List all skills
// POST /api/skills/reload - Reload from filesystem
// POST /api/skills/:name/enable - Enable skill
// POST /api/skills/:name/disable - Disable skill
// GET /api/skills/:name - Get single skill details
```

#### `src/channels/telegram.ts`
Add commands:
- `/skills` - List skills
- `/skill_reload` - Reload skills
- `/skill_enable <name>`
- `/skill_disable <name>`

### UI Files

#### `src/ui/src/pages/Skills.tsx`
New page for skill management:
- Skill cards with name, description, tags, enabled toggle
- Reload button
- Empty state with instructions

#### `src/ui/src/services/skills.ts`
API client:
```typescript
export async function getSkills(): Promise<Skill[]>;
export async function reloadSkills(): Promise<void>;
export async function enableSkill(name: string): Promise<void>;
export async function disableSkill(name: string): Promise<void>;
```

#### `src/ui/src/App.tsx`
Add /skills route.

#### `src/ui/src/components/Sidebar.tsx`
Add Skills menu item.

## Implementation Order

### Phase 1: Core Infrastructure
1. Create `src/runtime/skills/types.ts` with interfaces
2. Create `src/runtime/skills/schema.ts` with Zod validation
3. Create `src/runtime/skills/loader.ts` for filesystem discovery
4. Create `src/runtime/skills/registry.ts` singleton
5. Add `PATHS.skills` to paths.ts
6. Update scaffold.ts to create skills directory

### Phase 2: Keymaker Agent
1. Add `keymaker` config schema to schemas.ts
2. Add `KeymakerConfig` to types/config.ts
3. Create `src/runtime/keymaker.ts` agent
4. Create `src/runtime/skills/tool.ts` with skill_delegate
5. Update TaskWorker to route keymaker tasks

### Phase 3: Oracle Integration
1. Update oracle.ts to include skills in system prompt
2. Update oracle.ts to include skill_delegate tool
3. Update start.ts to initialize SkillRegistry
4. Log skill count on startup

### Phase 4: API & Channels
1. Add skill routes to api.ts
2. Add Telegram commands
3. Add Discord slash commands

### Phase 5: UI
1. Create Skills page component
2. Add API client functions
3. Add route and sidebar entry

### Phase 6: Testing & Polish
1. Add unit tests for SkillLoader
2. Add unit tests for SkillRegistry
3. Add integration tests for Keymaker
4. Create sample skills for documentation

## Sample Skill for Testing

```yaml
# ~/.morpheus/skills/code-reviewer/skill.yaml
name: code-reviewer
version: 1.0.0
description: "Review code snippets for bugs, style issues, and improvements"
author: morpheus
enabled: true
tags:
  - development
  - code-quality
examples:
  - "Review this code for bugs"
  - "What's wrong with this function?"
```

```markdown
# ~/.morpheus/skills/code-reviewer/SKILL.md

# Code Reviewer Skill

You are now acting as a senior code reviewer. Follow these steps:

## 1. Initial Assessment
- Identify the programming language
- Understand the code's purpose
- Note the overall structure

## 2. Bug Detection
Look for:
- Off-by-one errors
- Null/undefined handling
- Resource leaks
- Race conditions
- Security vulnerabilities

## 3. Style & Best Practices
Check for:
- Naming conventions
- Code duplication
- Function length
- Comment quality
- Error handling patterns

## 4. Output Format
Provide feedback in this structure:

### Summary
Brief overview of code quality.

### Critical Issues
- List any bugs or security issues

### Suggestions
- Improvement recommendations

### Positive Notes
- What the code does well
```

## API Endpoints

### GET /api/skills
```json
{
  "skills": [
    {
      "name": "code-reviewer",
      "description": "Review code snippets for bugs, style issues, and improvements",
      "version": "1.0.0",
      "author": "morpheus",
      "enabled": true,
      "tags": ["development", "code-quality"],
      "examples": ["Review this code for bugs"]
    }
  ]
}
```

### POST /api/skills/reload
```json
{
  "success": true,
  "loaded": 3,
  "errors": []
}
```

### POST /api/skills/:name/enable
```json
{
  "success": true
}
```

### POST /api/skills/:name/disable
```json
{
  "success": true
}
```

## Testing Strategy

### Unit Tests
- `src/runtime/skills/__tests__/loader.test.ts`
  - Valid skill parsing
  - Missing skill.yaml handling
  - Invalid YAML handling
  - Schema validation errors

- `src/runtime/skills/__tests__/registry.test.ts`
  - Singleton behavior
  - Enable/disable state
  - getSystemPromptSection output
  - getContent lazy loading

- `src/runtime/__tests__/keymaker.test.ts`
  - Tool assembly (DevKit + MCP + DB)
  - System prompt construction
  - Skill content injection

### Integration Tests
- `src/runtime/skills/__tests__/integration.test.ts`
  - Oracle with skill_delegate tool
  - Task creation for keymaker agent
  - End-to-end skill execution

## Documentation Updates

- Update `README.md` with Skills section
- Update `DOCUMENTATION.md` with API endpoints
- Create `~/.morpheus/skills/README.md` template with instructions
