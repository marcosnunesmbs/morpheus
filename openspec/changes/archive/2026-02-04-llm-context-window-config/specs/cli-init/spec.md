## MODIFIED Requirements

### Requirement: Prompt for LLM configuration
The init command SHALL prompt users for LLM configuration including context window size.

#### Scenario: User provides context window during init
- **WHEN** user runs `morpheus init` and reaches LLM configuration step
- **THEN** system prompts "Context Window Size (number of messages to send to LLM)" with default value 100

#### Scenario: User skips context window prompt
- **WHEN** user presses Enter without providing value during context window prompt
- **THEN** system uses default value of 100 messages

#### Scenario: User provides invalid context window value
- **WHEN** user enters non-numeric or negative value for context window
- **THEN** system shows validation error and re-prompts

### Requirement: Save context window to config
The init command SHALL save context window value under `llm.context_window` in the config file.

#### Scenario: Config file created with context window
- **WHEN** init command completes successfully
- **THEN** `~/.morpheus/config.yaml` contains `llm.context_window` under `llm` section
