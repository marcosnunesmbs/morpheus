## MODIFIED Requirements

### Requirement: Context window field in LLM section
The Settings UI SHALL display context window configuration under "LLM Configuration" section with appropriate label.

#### Scenario: Context window field visible in LLM section
- **WHEN** user opens Settings page
- **THEN** "Context Window (Messages)" field appears in "LLM Configuration" section

#### Scenario: Context window field removed from Memory section
- **WHEN** user opens Settings page
- **THEN** "Chat Memory" section does not contain context window field

### Requirement: Updated field label and helper text
The Settings UI SHALL use clear label "Context Window (Messages)" with descriptive helper text.

#### Scenario: Helper text explains purpose
- **WHEN** user views context window field
- **THEN** helper text reads "Number of past interactions to load into LLM context (e.g., 100)"

#### Scenario: Label is semantically clear
- **WHEN** user views the field
- **THEN** label reads "Context Window (Messages)" not "History Limit" or "Memory Limit"

### Requirement: Form path updated to llm.context_window
The Settings UI SHALL read and write to `llm.context_window` path in config.

#### Scenario: Reading current value
- **WHEN** Settings component loads
- **THEN** form displays value from `localConfig.llm.context_window`

#### Scenario: Saving updated value
- **WHEN** user changes context window value and saves
- **THEN** system updates `localConfig.llm.context_window` via `handleUpdate(['llm', 'context_window'], value)`

#### Scenario: Validation errors display correctly
- **WHEN** user enters invalid value (non-integer or negative)
- **THEN** error appears under field with key `errors['llm.context_window']`

### Requirement: Input validation for positive integers
The Settings UI SHALL validate context window as positive integer only.

#### Scenario: User enters valid positive integer
- **WHEN** user types "50" in context window field
- **THEN** input is accepted without error

#### Scenario: User enters zero or negative number
- **WHEN** user types "0" or "-10" in context window field
- **THEN** validation error appears: "Must be a positive number"

#### Scenario: User enters non-numeric value
- **WHEN** user types "abc" in context window field
- **THEN** validation error appears: "Must be a number"
