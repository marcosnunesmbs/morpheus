## MODIFIED Requirements

### Requirement: Validate LLM context window configuration
The doctor command SHALL validate that `llm.context_window` is present and report when default values are being used.

#### Scenario: Context window is properly configured
- **WHEN** user runs `morpheus doctor` and config contains valid `llm.context_window`
- **THEN** system shows "✓ LLM context window: <value> messages"

#### Scenario: Context window is missing
- **WHEN** user runs `morpheus doctor` and config is missing `llm.context_window`
- **THEN** system shows "⚠ LLM context window not configured, using default: 100 messages"

#### Scenario: Context window has invalid value
- **WHEN** user runs `morpheus doctor` and `llm.context_window` is not a positive integer
- **THEN** system shows "✗ LLM context window has invalid value, using default: 100 messages"

### Requirement: Detect deprecated memory.limit field
The doctor command SHALL detect usage of deprecated `memory.limit` field and suggest migration.

#### Scenario: Deprecated field detected
- **WHEN** user runs `morpheus doctor` and config contains `memory.limit` but not `llm.context_window`
- **THEN** system shows "⚠ Deprecated config detected: 'memory.limit' should be migrated to 'llm.context_window'. Will auto-migrate on next start."

#### Scenario: Both old and new fields present
- **WHEN** user runs `morpheus doctor` and config contains both `memory.limit` and `llm.context_window`
- **THEN** system shows "⚠ Found both 'memory.limit' and 'llm.context_window'. Remove 'memory.limit' from config."
