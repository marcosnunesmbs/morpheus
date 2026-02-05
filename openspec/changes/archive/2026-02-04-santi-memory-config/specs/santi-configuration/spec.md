## ADDED Requirements

### Requirement: Sati Configuration Schema
The system SHALL support a dedicated configuration section for the Sati memory agent, allowing independent control over its LLM provider and operational parameters.

#### Scenario: Valid Sati Configuration
- **WHEN** the configuration file contains a `santi-config` section
- **THEN** the system parses the `provider` and `model` from that section
- **THEN** the system parses the `memory_limit` as a number (defaulting to a sensible value if optional)

### Requirement: CLI Initialization Prompts
The initialization process SHALL guide the user to configure the Sati agent.

#### Scenario: Configuring Sati during init
- **WHEN** running `morpheus init`
- **THEN** the user is asked to configure the Sati memory agent
- **THEN** the user is presented with an option to copy settings from the main LLM configuration
- **THEN** the user is asked to specify the `memory_limit` for Sati
