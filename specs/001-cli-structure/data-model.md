# Data Model: CLI Structure

## Configuration (`config.yaml`)

The central configuration file located at `~/.morpheus/config.yaml`.

```yaml
agent:
  name: string          # default: "morpheus"
  personality: string   # default: "helpful_dev"

llm:
  provider: enum        # "openai" | "anthropic" | "ollama"
  model: string         # e.g. "gpt-4"
  temperature: float    # 0.0 to 1.0
  api_key: string       # format: "env:VAR_NAME" or raw key

channels:
  telegram:
    enabled: boolean
    token: string       # format: "env:VAR_NAME" or raw token
  discord:
    enabled: boolean
    token: string

ui:
  enabled: boolean      # default: true
  port: number          # default: 3333
```

## Runtime State (`morpheus.pid`)

A simple text file containing the Process ID of the active agent.

- **Path**: `~/.morpheus/morpheus.pid`
- **Content**: `<PID>` (ex: `12345`)

## Directory Structure

The global state directory managed by the CLI.

```
~/.morpheus/
├── config.yaml       # User configuration
├── mcps.json         # MCP registry
├── morpheus.pid      # Runtime lock file
├── logs/             # Text logs
├── memory/           # Vector store / Long term memory
├── cache/            # Temporary artifacts
└── commands/         # User-defined markdown commands
```
