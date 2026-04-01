## ADDED Requirements

### Requirement: Unified Global Usage Statistics
The system SHALL provide a unified global usage summary derived exclusively from the `audit_events` and `model_pricing` tables to ensure consistency across all reporting interfaces.

#### Scenario: Global stats use Audit data
- **WHEN** the `/api/stats/usage` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().totals`.

#### Scenario: Grouped stats use Audit data
- **WHEN** the `/api/stats/usage/grouped` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().byModel`.

#### Scenario: Agent stats use Audit data
- **WHEN** the `/api/stats/usage/by-agent` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().byAgent`.

### Requirement: Complete Audit Coverage for Subagents
All subagent LLM calls MUST be recorded as `llm_call` events in the `audit_events` table to ensure global statistics are complete.

#### Scenario: Subagent LLM call audited
- **WHEN** a subagent (Apoc, Neo, Trinity, Smith, Link) completes an LLM invocation
- **THEN** an `llm_call` event MUST be inserted into the `audit_events` table with accurate token usage and duration.
