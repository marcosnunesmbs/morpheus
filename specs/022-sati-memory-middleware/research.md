# Application Research: Sati Memory Middleware

**Feature**: Sati Memory Middleware
**Branch**: `022-sati-memory-middleware`
**Status**: Research Verified

## Technical Decisions

### Middleware Implementation
- **Decision**: Use `createMiddleware` from `langchain` package.
- **Rationale**: Direct support in the project's dependency version. Provides `beforeAgent` and `afterAgent` hooks exactly as required by the spec.
- **Implementation**:
  ```typescript
  import { createMiddleware } from "langchain";
  
  export const satiMemoryMiddleware = createMiddleware({
    name: "SatiMemoryMiddleware",
    beforeAgent: async (state, runtime) => { ... },
    afterAgent: async (state, runtime) => { ... }
  });
  ```

### Database Strategy
- **Decision**: Use `better-sqlite3` for a dedicated `santi-memory.db` file.
- **Rationale**: Isolates long-term memory from short-term session memory (`short-memory.db`), allowing independent management and strictly following the "Dual Database" requirement.
- **Location**: `.morpheus/memory/santi-memory.db`.

### LLM Configuration ("Zion")
- **Decision**: Reuse the global `ConfigManager.getInstance().getConfig().llm` settings for Sati's internal agent calls.
- **Rationale**: Meets the user requirement "o agente santi deve usar as configurações padrão de provider e model de zaion".
- **Risk**: Using the same model/provider is fine, but we must ensure we instantiate a *new* LLM instance (or chain) for Sati so it doesn't share the main agent's conversational context/scratchpad. Sati is a "sub-agent" call, effectively a function call to an LLM within the middleware.

### Context Injection
- **Decision**: Inject `SystemMessage` into `state.messages` in `beforeAgent`.
- **Rationale**: Standard LangGraph/LangChain pattern for context stuffing. The `state` object in `beforeAgent` is mutable or the return value can update it (depending on exact LangGraph version usage, typically middleware returns a state update).
- **Verification**: `createMiddleware` definition shows `beforeAgent` returns `The modified middleware state or undefined to pass through`. So we return `{ messages: [ ...state.messages, new SystemMessage(...) ] }` or similar merge strategy.

## Unknowns & Clarifications

### Resolved
- **Middleware Support**: Confirmed `createMiddleware` exists in `langchain` @ `node_modules/langchain/dist/agents/middleware.d.ts`.
- **Config Access**: Confirmed `src/config/schemas.ts` and `ConfigManager` pattern.

### Open Questions (Resolved by Plan)
- **Typing**: Need to ensure the `state` types match what `createMiddleware` expects (likely `messages` array).

## Strategy

1. **Phase 1**: Define contracts (interfaces for Sati I/O) and Data Model (SQLite schema).
2. **Phase 2**: Implement `SatiService` (encapsulates DB and LLM logic) and `satiMiddleware` (connects Service to Agent).
