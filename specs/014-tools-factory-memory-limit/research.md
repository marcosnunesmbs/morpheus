# Research: Refactor Tools Factory & Memory Config

**Feature**: Refactor Tools Factory & Memory Config
**Status**: Complete

## Unknowns & Clarifications

### 1. where should the new `ToolsFactory` be located?
*   **Context**: `src/runtime/providers/factory.ts` currently houses tool creation.
*   **Resolution**: Create `src/runtime/tools/factory.ts`.
*   **Rationale**: `tools` is a distinct domain from `providers` (LLMs). Grouping them under `runtime` makes sense.

### 2. How to handle default config migration?
*   **Context**: Spec requires default value 100.
*   **Resolution**: Update `DEFAULT_CONFIG` in `src/config/schemas.ts` (or `types/config.ts` if defaults are separate) and ensure the Zod schema applies it. `morpheus init` uses `DEFAULT_CONFIG` so it will auto-populate for new inits. Existing configs might need manual update or code handles missing key via Zod default.
*   **Decision**: Rely on Zod `.default(100)` which fills the value if missing in the parsed object, effectively handling existing configs seamlessly at runtime.

### 3. MCP Server Configuration?
*   **Context**: Currently hardcoded in `factory.ts`. 
*   **Resolution**: For this refactor, we will keep the configuration hardcoded inside `ToolsFactory` or move it to a constant, as full MCP configuration via YAML is out of scope for this specific task (implied by user request just being refactor + memory limit).
*   **Decision**: Move the hardcoded `mcpServers` definition to `ToolsFactory`.

## Decisions Log

- **D-001**: Use `src/runtime/tools/` namespace.
- **D-002**: `memory_limit` will be a root-level property or `agent` level?
    - Looking at `ConfigSchema`:
        - `agent` (name, personality)
        - `llm` (provider, model...)
        - `audio`...
    - `memory_limit` feels like it belongs in `llm` (context related) or `agent` (behavior related). `SQLiteChatMessageHistory` is used by `Agent`.
    - **Decision**: Put it in `MorpheusConfig` root or `agent`. Let's put it in `llm` settings as it relates to context window management, or create a `memory` section?
    - Current Spec just says "config file".
    - `agent` section seems appropriate as it defines agent capabilities.
    - However, `limit` often correlates with LLM context window.
    - Let's check `DEFAULT_CONFIG` structure in `factory.ts`... wait `factory.ts` imports `LLMConfig`.
    - Let's place it in `memory` section? Or just root.
    - `ConfigSchema` has `logging`.
    - I'll add a new `memory` object: `memory: { limit: number }`. Future memory settings (vector db path, etc) can go there.

- **D-003**: `ToolsFactory` API.
    - `static async create(config: MorpheusConfig): Promise<StructuredTool[]>`
