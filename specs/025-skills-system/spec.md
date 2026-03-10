# Feature Specification: Dynamic Skills System

**Feature Branch**: `025-skills-system`
**Created**: 2026-02-25
**Status**: Draft
**Input**: User description: "Sistema de skills dinâmicas onde o usuário pode adicionar habilidades customizadas em ~/.morpheus/skills/ que Oracle determina quando usar baseado em descrição semântica."

## Overview

Skills são extensões de comportamento definidas pelo usuário. Cada skill é um conjunto de instruções (markdown) que definem como executar uma tarefa especializada. Oracle identifica quando usar uma skill e delega para **Keymaker**, um novo agente com acesso a TODAS as ferramentas (DevKit + MCP + Database).

**Por que Keymaker?** No universo Matrix, o Keymaker pode "abrir qualquer porta" — a metáfora perfeita para um agente com acesso universal a todas as ferramentas do sistema.

**Abordagem escolhida**: Listar todas as skills disponíveis no system prompt do Oracle. Quando uma skill é necessária, Oracle usa `skill_delegate` para criar uma task assíncrona executada pelo Keymaker.

## Architectural Principles

- **Zero-config discovery**: Skills são carregadas automaticamente de `~/.morpheus/skills/` no startup.
- **Hot-reload ready**: Skills podem ser recarregadas sem restart do daemon.
- **Isolation**: Skills são instruções (SKILL.md) usadas como system prompt do Keymaker.
- **Full Power Execution**: Keymaker tem acesso a DevKit (Apoc), MCP tools (Neo), e DB tools (Trinity).
- **Async by Default**: Skills são executadas via TaskWorker como qualquer outra delegação.

## Directory Structure

```
~/.morpheus/skills/
  ├── github-pr-review/
  │   ├── skill.yaml         # Metadata obrigatório
  │   └── SKILL.md           # Instruções completas (carregado sob demanda)
  ├── k8s-debugging/
  │   ├── skill.yaml
  │   └── SKILL.md
  └── data-analysis/
      ├── skill.yaml
      └── SKILL.md
```

## Skill Metadata Schema (`skill.yaml`)

```yaml
name: github-pr-review
version: 1.0.0
description: "Review pull requests, analyze code changes, suggest improvements based on best practices"
author: user
enabled: true
tags:
  - github
  - code-review
  - development
examples:
  - "Review PR #123 on repo morpheus"
  - "Analyze the changes in this pull request"
  - "What could be improved in PR 456?"
```

**Campos obrigatórios**:
- `name`: Identificador único da skill
- `description`: Descrição concisa usada no system prompt (máx. 200 chars)

**Campos opcionais**:
- `version`: Versão semântica
- `author`: Autor da skill
- `enabled`: Se a skill está ativa (default: true)
- `tags`: Tags para categorização
- `examples`: Exemplos de uso (ajudam o LLM a entender quando usar)

## User Scenarios & Testing

### User Story 1 - Skill Discovery (Priority: P1)

As a user, I want Oracle to automatically discover and load skills from `~/.morpheus/skills/` on startup.

**Independent Test**: Create skills directory with sample skill.yaml files, start daemon, verify skills appear in `GET /api/skills`.

**Acceptance Scenarios**:

1. **Given** valid skills in `~/.morpheus/skills/`, **When** daemon starts, **Then** skills are loaded into SkillRegistry.
2. **Given** a skill with `enabled: false`, **When** daemon starts, **Then** skill is not included in Oracle's available skills.
3. **Given** malformed skill.yaml, **When** loading skills, **Then** error is logged but other skills load successfully.

---

### User Story 2 - Skill Delegation to Keymaker (Priority: P1)

As a user, when I make a request that matches a skill's domain, Oracle should delegate execution to Keymaker with the skill's instructions.

**Independent Test**: Ask Oracle to review a PR, verify task is created for Keymaker agent, and Keymaker executes with SKILL.md as system prompt.

**Acceptance Scenarios**:

1. **Given** a skill "github-pr-review" is loaded, **When** user asks "review PR #123", **Then** Oracle calls `skill_delegate` tool creating a task for Keymaker.
2. **Given** skill task is created, **When** TaskWorker picks it up, **Then** Keymaker is instantiated with SKILL.md content as system prompt.
3. **Given** Keymaker has all tools, **When** SKILL.md instructs to use git/filesystem/shell, **Then** Keymaker executes those tools directly.
4. **Given** no skill matches the request, **When** Oracle processes message, **Then** normal flow continues without skill delegation.

---

### User Story 3 - Skill Management via API (Priority: P2)

As a user, I want to view, enable/disable, and reload skills via the API.

**Independent Test**: Call `/api/skills` to list, `/api/skills/:name/disable` to toggle, `/api/skills/reload` to refresh.

**Acceptance Scenarios**:

1. **Given** skills are loaded, **When** GET `/api/skills`, **Then** return list with name, description, enabled status.
2. **Given** a skill is enabled, **When** POST `/api/skills/:name/disable`, **Then** skill is excluded from Oracle context.
3. **Given** user adds new skill to filesystem, **When** POST `/api/skills/reload`, **Then** new skill is discovered.

---

### User Story 4 - Skill Management via UI (Priority: P3)

As a user, I want a Skills page in the dashboard to browse and manage my skills.

**Independent Test**: Open Skills page, verify skill cards show name/description/status, toggle enable/disable.

**Acceptance Scenarios**:

1. **Given** skills are loaded, **When** opening Skills page, **Then** cards display name, description, enabled badge.
2. **Given** a skill card, **When** clicking toggle, **Then** skill enabled state changes.
3. **Given** Skills page open, **When** clicking Reload button, **Then** skills are refreshed from filesystem.

---

### User Story 5 - Keymaker Full Execution Power (Priority: P1)

As a user, when a skill is executed by Keymaker, it should have access to all tools needed to complete the task.

**Independent Test**: Create a skill that requires filesystem + shell + git operations, invoke it, verify Keymaker executes all steps.

**Acceptance Scenarios**:

1. **Given** skill requires filesystem operations, **When** Keymaker executes, **Then** DevKit filesystem tools are available.
2. **Given** skill requires shell commands, **When** Keymaker executes, **Then** DevKit shell tools are available.
3. **Given** skill requires MCP tools, **When** Keymaker executes, **Then** loaded MCP tools are available.
4. **Given** skill requires database queries, **When** Keymaker executes, **Then** Trinity-style DB tools are available.
5. **Given** skill has complex multi-step instructions, **When** Keymaker executes, **Then** steps are followed autonomously.

## Edge Cases

- Skills directory doesn't exist on startup (create it automatically).
- Skill folder exists but missing skill.yaml (log warning, skip).
- Skill folder exists but missing SKILL.md (log warning, skill loads but invoke returns error).
- SKILL.md is very large (truncate with warning at 50KB).
- Duplicate skill names across folders (last loaded wins, log warning).
- Skill name contains special characters (sanitize to alphanumeric + hyphen).
- Circular skill references (skill A instructs to use skill B which uses A) - not supported, ignored.
- skill.yaml has invalid YAML syntax (log error, skip skill).

## Requirements

### Functional Requirements

- **FR-001**: SkillLoader MUST discover skills from `~/.morpheus/skills/` on startup.
- **FR-002**: SkillLoader MUST parse skill.yaml and validate against schema (Zod).
- **FR-003**: SkillRegistry MUST maintain in-memory list of enabled skills.
- **FR-004**: Oracle system prompt MUST include descriptions of all enabled skills.
- **FR-005**: Oracle MUST have `skill_delegate` tool to create async tasks for Keymaker.
- **FR-006**: `skill_delegate` MUST create a task with `agent: 'keymaker'` and skill name.
- **FR-007**: Keymaker agent MUST be instantiated with SKILL.md content as system prompt.
- **FR-008**: Keymaker MUST have access to DevKit tools, MCP tools, and DB tools.
- **FR-009**: TaskWorker MUST route `agent: 'keymaker'` tasks to Keymaker executor.
- **FR-010**: HTTP API MUST expose `/api/skills` endpoints for list, reload, enable, disable.
- **FR-011**: Skills MUST be reloadable without daemon restart via API/Telegram command.
- **FR-012**: Disabled skills MUST NOT appear in Oracle's available skills list.
- **FR-013**: SkillLoader MUST gracefully handle malformed skill directories.

### Non-Functional Requirements

- **NFR-001**: Skill loading MUST complete in <500ms for up to 50 skills.
- **NFR-002**: Skill descriptions in system prompt MUST NOT exceed 5KB total.
- **NFR-003**: SKILL.md content MUST be loaded lazily (only on invoke).

### Key Entities

- **Skill**: User-defined behavioral extension.
  - `name`: Unique identifier
  - `description`: Short description for LLM context
  - `version`: Semver string
  - `author`: Creator attribution
  - `enabled`: Active status
  - `tags`: Categorization labels
  - `examples`: Usage examples
  - `path`: Filesystem path to skill directory

- **SkillRegistry**: Runtime container for loaded skills.
  - `skills`: Map<name, Skill>
  - `load()`: Discover and parse skills
  - `reload()`: Re-discover skills
  - `getEnabled()`: Return enabled skills
  - `enable(name)`: Enable skill
  - `disable(name)`: Disable skill
  - `getContent(name)`: Read SKILL.md

- **Keymaker**: Specialized agent for skill execution.
  - Has access to ALL tools: DevKit + MCP + DB
  - System prompt is dynamically built from SKILL.md
  - Executes via TaskWorker like other subagents
  - Registered as `agent: 'keymaker'` in tasks table

## Agent Comparison

| Agent | Role | Tools | When Used |
|-------|------|-------|-----------|
| Oracle | Orchestrator | Delegation tools only | Always (main conversation) |
| Neo | MCP execution | MCP tools | `neo_delegate` |
| Apoc | DevKit execution | DevKit tools | `apoc_delegate` |
| Trinity | Database execution | DB tools | `trinity_delegate` |
| **Keymaker** | **Skill execution** | **ALL tools** | `skill_delegate` |

## System Prompt Integration

Oracle's system prompt will include:

```
## Available Skills

You have access to user-defined skills that provide specialized expertise.
When a request matches a skill's domain, use `skill_delegate` to delegate execution to Keymaker.
Keymaker has full access to filesystem, shell, git, MCP tools, and databases.

Skills available:
- **github-pr-review**: Review pull requests, analyze code changes, suggest improvements
- **k8s-debugging**: Debug Kubernetes issues, analyze pod logs, trace failures
- **data-analysis**: Analyze datasets, create visualizations, statistical insights

To use a skill: call skill_delegate(skillName, objective)
The skill will be executed asynchronously and results delivered when complete.
```

## Telegram Commands

- `/skills` - List all skills with enabled status
- `/skill_reload` - Reload skills from filesystem
- `/skill_enable <name>` - Enable a skill
- `/skill_disable <name>` - Disable a skill
