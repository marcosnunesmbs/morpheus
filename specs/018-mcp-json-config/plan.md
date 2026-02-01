# Implementation Plan: MCP JSON Configuration

**Branch**: `018-mcp-json-config` | **Date**: February 1, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/018-mcp-json-config/spec.md`

## Summary

Replace hardcoded MCP server definitions in `ToolsFactory` with an external JSON configuration file (`~/.morpheus/mcps.json`). The file is auto-created with a documented template during `morpheus init` or any CLI command execution. This enables users to configure MCP servers without modifying source code, following the Local-First principle.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18)  
**Primary Dependencies**: `fs-extra` (file operations), `zod` (validation), `@langchain/mcp-adapters` (MCP client)  
**Storage**: JSON file at `~/.morpheus/mcps.json`  
**Testing**: Vitest (existing test framework)  
**Target Platform**: Cross-platform (Windows, macOS, Linux)  
**Project Type**: Single project (CLI + Runtime)  
**Performance Goals**: File read < 50ms on startup (negligible impact)  
**Constraints**: Must be idempotent, must not overwrite existing user configurations  
**Scale/Scope**: Single configuration file, ~10-50 MCP server entries typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Local-First & Privacy** | ✅ PASS | MCP configs stored locally in `~/.morpheus/mcps.json`. No cloud sync. |
| **II. Extensibility by Design** | ✅ PASS | MCPs added via JSON file, no recompilation needed. Aligns perfectly with principle. |
| **III. Orchestration & Context** | ✅ PASS | MCPs provide tools for context gathering. Configuration is transparent. |
| **IV. Developer Experience** | ✅ PASS | Declarative file-based config. Auto-scaffold ensures files exist. |
| **V. Reliability & Transparency** | ✅ PASS | Clear logging of which MCPs loaded/failed. No magic boxes. |

**Quality Gates**:
- [ ] Unit tests for MCP config loading and validation
- [ ] Documentation in template file (self-documenting JSON)

## Project Structure

### Documentation (this feature)

```text
specs/018-mcp-json-config/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── mcp-config.ts    # TypeScript interfaces
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── paths.ts           # PATHS.mcps already defined ✓
│   ├── schemas.ts         # Add MCPServerSchema, MCPConfigSchema
│   └── mcp-loader.ts      # NEW: Load and validate mcps.json
├── runtime/
│   ├── scaffold.ts        # MODIFY: Add mcps.json creation
│   └── tools/
│       └── factory.ts     # MODIFY: Read from mcps.json instead of hardcoded
├── cli/
│   └── index.ts           # MODIFY: Call scaffold() before command execution
└── types/
    └── mcp.ts             # NEW: MCP configuration types
```

**Structure Decision**: Single project structure. Changes span config, runtime, and CLI layers. New files are minimal (2 new files, 3 modifications).

## Complexity Tracking

> No Constitution violations. No complexity tracking needed.
