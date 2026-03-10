# Skills Specification

## Purpose
Skills are user-defined instruction sets stored as `SKILL.md` files on the filesystem. Oracle discovers them at startup and exposes a `load_skill` tool that injects detailed skill instructions into its context on demand.

## Scope
Included:
- SkillRegistry: scan, load, enable/disable skills at runtime
- SkillLoader: filesystem scan of `~/.morpheus/skills/`
- `load_skill` tool: Oracle uses it to retrieve skill content
- System prompt section listing available skill names

Out of scope:
- Skill content authoring (user responsibility)
- Skill persistence (runtime only — enable/disable not written to YAML)

## Requirements

### Requirement: Skill discovery
The system SHALL scan `~/.morpheus/skills/` at startup, loading all valid `SKILL.md` files into SkillRegistry.

#### Scenario: Skills loaded from filesystem
- GIVEN two `SKILL.md` files exist in the skills directory
- WHEN the daemon starts and SkillRegistry loads
- THEN both skills are available in the registry

#### Scenario: Invalid skill directory skipped
- GIVEN a subdirectory exists without a `SKILL.md` file
- WHEN the scan runs
- THEN it is skipped and a warning is logged

#### Scenario: Duplicate skill name overwrites
- GIVEN two skill directories with the same `name` in their metadata
- WHEN loading completes
- THEN the second skill overwrites the first and a warning is logged

### Requirement: load_skill tool
The system SHALL expose a `load_skill` tool to Oracle's ReactAgent that retrieves the full content of a named skill.

#### Scenario: Skill content retrieved
- GIVEN Oracle needs instructions for a specific domain
- WHEN Oracle calls `load_skill` with a valid skill name
- THEN the full `SKILL.md` content is returned as the tool result

#### Scenario: Unknown skill requested
- GIVEN Oracle calls `load_skill` with a name that doesn't exist
- WHEN the tool executes
- THEN an error message is returned (skill not found)

### Requirement: System prompt section
The system SHALL include a section in Oracle's system prompt listing all enabled skills and instructing Oracle to use `load_skill` when relevant.

#### Scenario: Skills listed in system prompt
- GIVEN 3 skills are enabled in the registry
- WHEN Oracle's system prompt is built
- THEN it includes a "Available Skills" section listing the skill names and descriptions

#### Scenario: No skills available
- GIVEN no skills are loaded or all are disabled
- WHEN Oracle's system prompt is built
- THEN no "Available Skills" section is included

### Requirement: Runtime enable/disable
The system SHALL support enabling and disabling skills at runtime (in-memory only, does not persist to YAML).

#### Scenario: Skill disabled at runtime
- GIVEN skill `"code-review"` is enabled
- WHEN `SkillRegistry.disable("code-review")` is called
- THEN the skill is excluded from `getEnabled()` and the system prompt section

#### Scenario: Reload refreshes skill list
- GIVEN skills have been added or removed from the filesystem
- WHEN `SkillRegistry.reload()` is called
- THEN the registry is cleared and rescanned from the filesystem
