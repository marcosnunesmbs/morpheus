# Data Model: Morpheus Internal Tools

## Configuration Tool Data

### ConfigQueryTool
- **Purpose**: Query current configuration values
- **Input**: 
  - `key` (optional string): Specific configuration key to query, or null for all
- **Output**: Object containing configuration values
- **Validation**: None required (queries existing values)

### ConfigUpdateTool
- **Purpose**: Update configuration values
- **Input**:
  - `updates` (object): Key-value pairs of configuration updates
- **Output**: Boolean indicating success
- **Validation**: Updates must conform to existing Zod configuration schema

## Diagnostic Tool Data

### DiagnosticTool
- **Purpose**: Check system health and return diagnostic report
- **Input**: None
- **Output**: Object containing diagnostic results with status for each component
- **Validation**: None required (reports current state)

## Analytics Tool Data

### MessageCountTool
- **Purpose**: Query message counts from database
- **Input**:
  - `timeRange` (optional object): Start and end timestamps for filtering
- **Output**: Number representing message count
- **Validation**: Time range values must be valid ISO date strings

### TokenUsageTool
- **Purpose**: Query token usage statistics from database
- **Input**:
  - `timeRange` (optional object): Start and end timestamps for filtering
- **Output**: Object containing token usage statistics
- **Validation**: Time range values must be valid ISO date strings

## Common Tool Properties

### Tool Schema
All tools follow the LangChain BaseTool schema:
- `name` (string): Unique identifier for the tool
- `description` (string): Human-readable description of what the tool does
- `schema` (Zod schema): Defines the input parameters for the tool
- `call` (function): Implementation of the tool's functionality