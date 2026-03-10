## MODIFIED Requirements

### Requirement: System prompt construction
The Oracle system prompt SHALL include a conditional first-time setup block when the setup is not yet completed.

#### Scenario: Setup block injected when pending
- **WHEN** `SetupRepository.isCompleted()` returns `false` at the start of `chat()`
- **THEN** a `## [FIRST-TIME SETUP]` block is prepended to the system prompt listing the fields to collect and instructing Oracle to ask before any other task

#### Scenario: Setup block absent when complete
- **WHEN** `SetupRepository.isCompleted()` returns `true`
- **THEN** no setup block is added to the system prompt and Oracle behaves normally

#### Scenario: Setup block lists only missing fields
- **WHEN** some fields have already been collected in a previous partial session
- **THEN** the setup block lists only the remaining missing fields (from `getMissingFields()`)
