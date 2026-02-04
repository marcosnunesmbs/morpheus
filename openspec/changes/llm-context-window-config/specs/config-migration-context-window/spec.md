## ADDED Requirements

### Requirement: Automatic migration on startup
The system SHALL automatically migrate `memory.limit` to `llm.context_window` when loading configuration during startup.

#### Scenario: Fresh config with old structure
- **WHEN** Morpheus starts and config contains `memory.limit` but not `llm.context_window`
- **THEN** system copies value from `memory.limit` to `llm.context_window` and removes `memory.limit`

#### Scenario: Already migrated config
- **WHEN** Morpheus starts and config already contains `llm.context_window`
- **THEN** system does not modify the config (idempotent operation)

#### Scenario: Both fields present
- **WHEN** Morpheus starts and config contains both `memory.limit` and `llm.context_window`
- **THEN** system preserves `llm.context_window` value and removes `memory.limit`

### Requirement: Migration backup creation
The system SHALL create a backup of the config file before applying migration.

#### Scenario: Successful migration with backup
- **WHEN** migration modifies the config file
- **THEN** system creates `~/.morpheus/config.yaml.backup-<timestamp>` with original content

### Requirement: Migration error handling
The system SHALL fail open if migration encounters errors, allowing Morpheus to start with fallback values.

#### Scenario: Migration fails due to file system error
- **WHEN** migration cannot write to config file
- **THEN** system logs error and continues startup using in-memory config

#### Scenario: Invalid config structure during migration
- **WHEN** config file has unexpected structure
- **THEN** system logs warning and skips migration, uses defaults
