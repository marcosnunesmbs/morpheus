## 1. Configuration Schema

- [x] 1.1 Update `src/config/schemas.ts` to include `santi` key in `ConfigSchema` with optional `memory_limit` and LLM properties
- [x] 1.2 Update `config.yaml` example in documentation or `src/config/index.ts` default, if applicable (ensure type safety)

## 2. Runtime Implementation

- [x] 2.1 Update `src/config/manager.ts` to add `getSatiConfig()` method which falls back to `this.config.santi` or generic LLM config with defaults
- [x] 2.2 Update `src/runtime/memory/sati/service.ts` to reuse `getSatiConfig()` instead of `getLLMConfig()`
- [x] 2.3 Verify `SatiService` uses the `memory_limit` from the config during retrieval

## 3. CLI Initialization

- [x] 3.1 Update `src/cli/commands/init.ts` to add "Configure Sati (Memory) Agent" step
- [x] 3.2 Implement logic to prompt for "Use same as main LLM" vs "Configure separately"
- [x] 3.3 Implement `memory_limit` prompt with default value
- [x] 3.4 Ensure generated `config.yaml` includes the `santi` section
