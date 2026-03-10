# Quickstart: Morpheus Internal Tools

## Overview
The Morpheus Internal Tools provide capabilities to query and modify configurations, diagnose system health, and analyze database statistics directly from within conversations with the AI agent.

## Available Tools

### Configuration Tools

#### `config_query`
- **Purpose**: Query current configuration values
- **Usage**: Call with optional `key` parameter to get specific config, or no parameters for all configs
- **Example**: 
  ```
  {
    "tool": "config_query",
    "tool_input": {}
  }
  ```

#### `config_update`
- **Purpose**: Update configuration values
- **Usage**: Call with `updates` object containing key-value pairs to update
- **Example**:
  ```
  {
    "tool": "config_update", 
    "tool_input": {
      "updates": {
        "llm.provider": "openai",
        "llm.model": "gpt-4"
      }
    }
  }
  ```

### Diagnostic Tools

#### `diagnostic_check`
- **Purpose**: Perform system health diagnostics
- **Usage**: Call with no parameters to run all diagnostic checks
- **Example**:
  ```
  {
    "tool": "diagnostic_check",
    "tool_input": {}
  }
  ```

### Analytics Tools

#### `message_count`
- **Purpose**: Get count of stored messages
- **Usage**: Optionally specify `timeRange` to filter by date
- **Example**:
  ```
  {
    "tool": "message_count",
    "tool_input": {
      "timeRange": {
        "start": "2023-01-01T00:00:00Z",
        "end": "2023-12-31T23:59:59Z"
      }
    }
  }
  ```

#### `token_usage`
- **Purpose**: Get token usage statistics
- **Usage**: Optionally specify `timeRange` to filter by date
- **Example**:
  ```
  {
    "tool": "token_usage",
    "tool_input": {}
  }
  ```

## Integration
These tools are automatically registered with all supported LLM providers through the existing agent factory system. Once implemented, they will be available to any agent created by Morpheus.

## Error Handling
- Configuration updates are validated before application
- Database queries handle connection errors gracefully
- Diagnostic tools report specific failure reasons