## Context

Currently, the Santi memory agent reuses the global `ConfigManager.getLLMConfig()` settings. This forces the memory agent to use the same model as the main conversation agent, which is inefficient. We want to use a cheaper/faster model for memory operations (embedding/retrieval) and control the context window size specifically for memory tasks.

## Goals / Non-Goals

**Goals:**
- Decouple Santi's LLM configuration from the main agent.
- Allow configuring a specific `memory_limit` for Santi.
- Update the initialization flow to set these values easily.

**Non-Goals:**
- Changing the underlying implementation of the memory vector store itself (just the configuration injection).
- runtime hot-reloading of this configuration (requires restart).

## Decisions

### 1. Configuration Schema Structure
We will add a root-level `santi` key (or `santi-config`) to the `Config` interface. It will extend the standard `LLMConfig` schema but add `memory_limit`.

**Decision:** Use `santi` as the key in `config.yaml`.
**Rationale:** Keeps it concise. The structure will be:
```yaml
santi:
  provider: ...
  model: ...
  memory_limit: 10 # number of messages/items to retrieve
```

### 2. Initialization Flow
In `src/cli/commands/init.ts`, after the main LLM config is set up, we will prompt:
> "Compute Santi (Memory) Config?"
> [ ] Use same as main LLM
> [ ] Configure separately

If "Use same" is selected, we copy the provider/model values and ask for `memory_limit` (defaulting to e.g., 5 or 10).

### 3. Provider Instantiation
The `SatiService` (in `src/runtime/memory/sati/service.ts`) currently likely calls `ConfigManager.getInstance().getLLMConfig()`. We will add `getSantiConfig()` to `ConfigManager` and update `SatiService` to use it.

## Risks / Trade-offs

- **Risk**: Users might be confused by having two LLM configs.
- **Mitigation**: Clear CLI prompts explaining that this is for the "Memory Agent".
- **Risk**: Defaulting to the main LLM might check for memory limit which doesn't exist on main LLM config.
- **Mitigation**: Ensure the copy logic explicitly handles the `memory_limit` addition.

## Migration Plan

- The change is backward compatible if we make `santi` config optional and fallback to `llm` config (with a default memory limit) if missing. However, the requirement implies a schema change, so we will update the Zod schema to make it distinct. Existing configs will be invalid until updated or we make the new field optional in Zod.
- **Decision**: Make `santi` optional in Zod schema for backward compatibility, falling back to `llm` config at runtime if not present, but `init` will always write it.
