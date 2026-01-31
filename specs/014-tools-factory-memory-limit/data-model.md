# Data Model: Refactor Tools Factory & Memory Config

## Configuration Schema

### `MemoryConfig` (New)

Added to `MorpheusConfig` root.

```typescript
interface MemoryConfig {
  limit: number;
}
```

**Zod Schema**:
```typescript
memory: z.object({
  limit: z.number().int().positive().default(100)
}).default({ limit: 100 })
```

### `MorpheusConfig` (Update)

```typescript
interface MorpheusConfig {
  // ... existing
  memory: MemoryConfig;
}
```

## Classes

### `ToolsFactory`

Location: `src/runtime/tools/factory.ts`

**Responsibility**: Initialize MCP clients and return tools for the agent.

```typescript
class ToolsFactory {
  static async createTools(config: MorpheusConfig): Promise<StructuredTool[]>;
}
```

### `ProviderFactory` (Update)

**Change**: `create` method signature might remain similar, but internal logic changes.

```typescript
class ProviderFactory {
  // Now accepts tools as an argument, OR we inject them after.
  // Actually, Agent constructs the provider.
  // Option A: ProviderFactory creates the LLM, ToolsFactory creates Tools, Agent combines them.
  // This matches the "Modular" goal.
  
  static async create(config: LLMConfig): Promise<BaseChatModel>; 
  // Changed return type from ReactAgent to BaseChatModel? 
  // Wait, ProviderFactory.create currently returns `ReactAgent`.
  
  // If we want to keep ProviderFactory returning an Agent, it needs to call ToolsFactory.
  // But Spec says "separate tool creation logic ... not directly inside ProviderFactory".
  
  // So:
  // 1. ToolsFactory.create() -> tools
  // 2. ProviderFactory.create(llmConfig, tools) -> ReactAgent
}
```

**Refined Design**:

```typescript
export class ToolsFactory {
  static async create(): Promise<SupportedTool[]>; // Currently config not strictly needed for the hardcoded coingecko
}
```

```typescript
export class ProviderFactory {
  static async create(config: LLMConfig, tools: SupportedTool[]): Promise<ReactAgent>;
}
```
