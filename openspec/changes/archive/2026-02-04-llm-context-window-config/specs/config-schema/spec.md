## MODIFIED Requirements

### Requirement: LLM configuration schema includes context_window
The config schema SHALL include `context_window` field under `llm` configuration section.

#### Scenario: Valid context window in config
- **WHEN** config file contains `llm.context_window` with positive integer value
- **THEN** Zod validation passes and config loads successfully

#### Scenario: Missing context window uses default
- **WHEN** config file does not contain `llm.context_window`
- **THEN** Zod schema applies default value of 100

#### Scenario: Invalid context window value
- **WHEN** config file contains `llm.context_window` with non-integer or negative value
- **THEN** Zod validation fails with clear error message

### Requirement: Memory.limit field marked as deprecated
The config schema SHALL accept but mark `memory.limit` as optional/deprecated to support migration.

#### Scenario: Old config with memory.limit
- **WHEN** config file contains only `memory.limit` (legacy structure)
- **THEN** Zod validation passes and Oracle can still read the value via fallback

#### Scenario: Deprecated field warning
- **WHEN** config validation encounters `memory.limit`
- **THEN** system logs deprecation warning (but does not fail)

### Requirement: TypeScript interfaces reflect new structure
The `LLMConfig` interface SHALL include `context_window` as optional number field.

#### Scenario: TypeScript compilation with new interface
- **WHEN** code references `config.llm.context_window`
- **THEN** TypeScript compiler recognizes the field as `number | undefined`

#### Scenario: Type safety for Oracle usage
- **WHEN** Oracle accesses context window with fallback chain
- **THEN** TypeScript ensures type-safe access pattern
