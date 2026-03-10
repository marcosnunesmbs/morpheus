# Quickstart: Running the Agent

## Prerequisites
- Node.js 18+ installed
- `npm install` run in project root
- An LLM API Key (e.g., OpenAI)

## Configuration
Run `morpheus init` to generate a configuration file, or create `.morpheus/config.yaml` manually:

```yaml
agent:
  name: "Morpheus"
  personality: "A helpful coding assistant."
llm:
  provider: "openai"
  model: "gpt-4-turbo"
  temperature: 0.7
  api_key: "sk-..."
channels:
  telegram:
    enabled: true
    token: "..."
```

## Starting the Agent
Run the start command:

```bash
npm start
# OR
./bin/morpheus.js start
```

## Expected Output
```text
Morpheus Agent (Morpheus) starting...
PID: 12345
Web UI enabled on port 3333
Agent active and listening...
```

To stop, press `CTRL+C`.
