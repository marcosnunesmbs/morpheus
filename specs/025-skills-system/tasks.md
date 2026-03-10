# Tasks: Dynamic Skills System

**Branch**: `025-skills-system` | **Status**: Complete

## Phase 1: Core Infrastructure

- [x] **T1.1** Create `src/runtime/skills/types.ts`
  - Define `SkillMetadata` interface
  - Define `Skill` interface extending metadata
  - Export types

- [x] **T1.2** Create `src/runtime/skills/schema.ts`
  - Create `SkillMetadataSchema` with Zod
  - Validate name (alphanumeric + hyphen, max 64 chars)
  - Validate description (max 500 chars)
  - Optional fields: version, author, enabled, tags, examples

- [x] **T1.3** Create `src/runtime/skills/loader.ts`
  - Implement `SkillLoader` class
  - `scan()`: Read skills directory, find subdirs with skill.yaml
  - `parseSkillYaml()`: Parse YAML and validate schema
  - Handle errors gracefully (log and skip invalid skills)

- [x] **T1.4** Create `src/runtime/skills/registry.ts`
  - Implement `SkillRegistry` singleton
  - `load()` / `reload()` methods
  - `getEnabled()`: Return enabled skills only
  - `enable(name)` / `disable(name)`: Toggle state
  - `getContent(name)`: Read SKILL.md lazily
  - `getSystemPromptSection()`: Generate prompt text

- [x] **T1.5** Add `PATHS.skills` to `src/config/paths.ts`
  - Add skills directory constant

- [x] **T1.6** Update `src/runtime/scaffold.ts`
  - Create `~/.morpheus/skills/` directory on init
  - Create README.md template in skills folder

- [x] **T1.7** Create `src/runtime/skills/index.ts`
  - Re-export all public APIs

## Phase 2: Keymaker Agent

- [x] **T2.1** Add `keymaker` config to `src/config/schemas.ts`
  - Create `KeymakerConfigSchema` (provider, model, temperature, personality)
  - Add to main ConfigSchema

- [x] **T2.2** Add `KeymakerConfig` to `src/types/config.ts`
  - Define interface matching schema
  - Add to main Config type

- [x] **T2.3** Create `src/runtime/keymaker.ts`
  - Import buildDevKit, loadMcpTools
  - Implement `executeKeymakerTask(skillName, objective)` function
  - Build system prompt from SKILL.md + objective
  - Assemble all tools (DevKit + MCP + morpheusTools)
  - Create and invoke ReactAgent
  - Return final response

- [x] **T2.4** Create `src/runtime/skills/tool.ts`
  - Implement `SkillDelegateTool`
  - Validate skill exists and enabled
  - Create task with `agent: 'keymaker'` and skill_name in context
  - Return task creation acknowledgement

- [x] **T2.5** Update `src/runtime/tasks/worker.ts`
  - Add case for `agent: 'keymaker'`
  - Extract `skill_name` from task context JSON
  - Call `executeKeymakerTask(skillName, input)`
  - Handle errors and return result

- [x] **T2.6** Update `src/runtime/tasks/types.ts`
  - Add `'keymaker'` to TaskAgent type

## Phase 3: Oracle Integration

- [x] **T3.1** Update `src/runtime/oracle.ts`
  - Import SkillRegistry and SkillDelegateTool
  - Add skills section to system prompt via `getSystemPromptSection()`
  - Add `skill_delegate` tool to tools array
  - Update tool description on catalog refresh

- [x] **T3.2** Update `src/cli/commands/start.ts`
  - Initialize SkillRegistry before Oracle
  - Log loaded skill count

## Phase 4: API Endpoints

- [x] **T4.1** Create skill router in `src/http/routers/skills.ts`
  - `GET /api/skills` - List all skills
  - `GET /api/skills/:name` - Get single skill
  - `POST /api/skills/reload` - Reload from filesystem
  - `POST /api/skills/:name/enable` - Enable skill
  - `POST /api/skills/:name/disable` - Disable skill

- [x] **T4.2** Mount skills router in `src/http/api.ts`

## Phase 5: Channel Commands

- [x] **T5.1** Add Telegram commands in `src/channels/telegram.ts`
  - `/skills` - List skills with enabled status
  - `/skill_reload` - Reload from filesystem
  - `/skill_enable <name>` - Enable skill
  - `/skill_disable <name>` - Disable skill

- [x] **T5.2** Add Discord slash commands in `src/channels/discord.ts`
  - `/skills` - List skills
  - `/skill_reload` - Reload skills
  - `/skill_enable name:` - Enable skill
  - `/skill_disable name:` - Disable skill

## Phase 6: Web UI

- [x] **T6.1** Create `src/ui/src/services/skills.ts`
  - `getSkills()`: Fetch all skills
  - `reloadSkills()`: POST reload
  - `enableSkill(name)`: POST enable
  - `disableSkill(name)`: POST disable

- [x] **T6.2** Create `src/ui/src/pages/Skills.tsx`
  - Skill cards with name, description, tags
  - Enable/disable toggle per skill
  - Reload button in header
  - Empty state with instructions

- [x] **T6.3** Update `src/ui/src/App.tsx`
  - Add `/skills` route

- [x] **T6.4** Update sidebar component
  - Add Skills menu item with icon

## Phase 7: Testing

- [x] **T7.1** Create `src/runtime/skills/__tests__/loader.test.ts`
  - Test valid skill parsing
  - Test missing skill.yaml
  - Test invalid YAML
  - Test schema validation errors

- [x] **T7.2** Create `src/runtime/skills/__tests__/registry.test.ts`
  - Test singleton pattern
  - Test enable/disable
  - Test getSystemPromptSection
  - Test getContent

- [x] **T7.3** Create `src/runtime/__tests__/keymaker.test.ts`
  - Test tool assembly
  - Test system prompt construction
  - Test skill content injection

- [x] **T7.4** Create `src/runtime/skills/__tests__/tool.test.ts`
  - Test skill_delegate task creation
  - Test skill not found error
  - Test task acknowledgement format

## Phase 8: Documentation & Polish

- [x] **T8.1** Create sample skill in `~/.morpheus/skills/code-reviewer/`
  - skill.yaml with full metadata
  - SKILL.md with example instructions

- [x] **T8.2** Update `README.md`
  - Add Skills section
  - Document Keymaker agent
  - Document file structure
  - Show skill.yaml schema

- [x] **T8.3** Update `DOCUMENTATION.md`
  - Add API endpoints for skills
  - Document Telegram/Discord commands

- [x] **T8.4** Create `~/.morpheus/skills/README.md` template
  - Instructions for creating skills
  - Schema reference
  - Best practices

---

## Progress Summary

| Phase | Tasks | Completed |
|-------|-------|-----------|
| 1. Core Infrastructure | 7 | 7 |
| 2. Keymaker Agent | 6 | 6 |
| 3. Oracle Integration | 2 | 2 |
| 4. API Endpoints | 2 | 2 |
| 5. Channel Commands | 2 | 2 |
| 6. Web UI | 4 | 4 |
| 7. Testing | 4 | 4 |
| 8. Documentation | 4 | 4 |
| **Total** | **31** | **31** |
