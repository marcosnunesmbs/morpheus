# Data Model: LangChain Core Agent

## Configuration (`config.yaml`)

The `init` command generates this strict structure.

```yaml
# Core Agent Configuration
agent:
  name: string          # e.g., "morpheus"
  role: string          # e.g., "assistant" - System prompt context

# LLM Provider Configuration
llm:
  provider: "openai" | "anthropic" | "ollama" | "gemini"
  model: string         # e.g., "gpt-4o", "claude-3-5-sonnet", "llama3"
  api_key: string       # RAW key or "env:VAR_NAME"
  temperature: number   # default: 0.7

# [Future extensibility for Phase 2+]
memory:
  type: "in-memory"     # MVP only supports in-memory
```

## Runtime Types (TypeScript)

### Config Schema (Zod)

```typescript
const ConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["openai", "anthropic", "ollama", "gemini"]),
    model: z.string().min(1),
    temperature: z.number().min(0).max(1).optional().default(0.7),
    api_key: z.string().optional() // Optional for Ollama
  })
});
```

### Conversation State

```typescript
interface Session {
  id: string;
  history: BaseMessage[]; // LangChain core type
  lastActivity: Date;
}
```
