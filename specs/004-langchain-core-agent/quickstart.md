# Quickstart: LangChain Core Agent

## Prerequisites
- Node.js 18+ installed
- An API Key for one of: OpenAI, Anthropic, Google Gemini (or Ollama installed locally)

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install @langchain/core @langchain/openai @langchain/anthropic @langchain/ollama @langchain/google-genai inquirer
   ```

2. **Initialize Configuration**
   Run the interactive setup wizard:
   ```bash
   morpheus init
   ```
   *Follow the prompts to select your provider and enter your API key.*

## Usage

### Simple Chat (Testing)

You can verify the agent using the start command (once implemented):

```bash
morpheus start
```

### Programmatic Usage

```typescript
import { AgentFactory } from "./runtime/agent";
import { ConfigManager } from "./config/manager";

// 1. Load Config
const config = ConfigManager.load();

// 2. Create Agent
const agent = AgentFactory.create(config);

// 3. Chat
const response = await agent.chat("Hello, world!");
console.log(response);
```
