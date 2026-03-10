# Quickstart: 014-tools-factory-memory-limit

## Configuration

To use the new memory limit, add the `memory` section to your `config.yaml` (automatically added on new init).

```yaml
memory:
  limit: 100 # Number of past messages to retain in context
```

## Developers

### Using ToolsFactory

Tools are now created separately from the LLM Provider.

```typescript
import { ToolsFactory } from "../tools/factory.js";
import { ProviderFactory } from "../providers/factory.js";

const tools = await ToolsFactory.create();
const agent = await ProviderFactory.create(llmConfig, tools);
```
