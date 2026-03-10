# Config Specification

## Purpose
The configuration system manages all Morpheus settings with a three-tier precedence: environment variables override YAML file which overrides compiled defaults. Configuration is loaded at startup and hot-reloadable at runtime via the Settings UI or HTTP API.

## Scope
Included:
- Config file: `~/.morpheus/zaion.yaml`
- Zod schema validation for all config sections
- Environment variable overrides per config key
- ConfigManager singleton with typed getters
- HTTP API for reading and updating config sections
- Scaffold: ensure `~/.morpheus/` dirs and `zaion.yaml` exist on first run

Out of scope:
- Per-section behavior (covered in respective domain specs)

## Requirements

### Requirement: Config precedence
The system SHALL apply configuration in the following priority order (highest to lowest):
1. Environment variables (e.g., `MORPHEUS_LLM_PROVIDER`)
2. `~/.morpheus/zaion.yaml`
3. Compiled defaults in `src/types/config.ts`

#### Scenario: Env var overrides YAML
- GIVEN `zaion.yaml` sets `llm.provider: openai` and `MORPHEUS_LLM_PROVIDER=anthropic` is set
- WHEN ConfigManager loads
- THEN `config.llm.provider` is `'anthropic'`

#### Scenario: YAML overrides default
- GIVEN the default `llm.temperature` is 0.7 and `zaion.yaml` sets `llm.temperature: 0.2`
- WHEN ConfigManager loads
- THEN `config.llm.temperature` is `0.2`

### Requirement: Schema validation
The system SHALL validate the parsed YAML config against Zod schemas and report validation errors clearly. Child schemas MUST be declared before the root `ConfigSchema` to avoid forward-reference TypeScript errors.

#### Scenario: Invalid config rejected
- GIVEN `zaion.yaml` has `llm.temperature: "hot"` (wrong type)
- WHEN ConfigManager loads
- THEN a validation error is thrown listing the invalid field

#### Scenario: Unknown keys ignored
- GIVEN `zaion.yaml` has an unrecognized key `llm.foo: bar`
- WHEN ConfigManager loads
- THEN the key is stripped and no error is raised (Zod strip mode)

### Requirement: Config scaffold
The system SHALL create `~/.morpheus/` directories and a default `zaion.yaml` on first run if they don't exist.

#### Scenario: First run initialization
- GIVEN `~/.morpheus/` does not exist
- WHEN the daemon starts
- THEN the directory structure is created and `zaion.yaml` is written with default values

### Requirement: Hot-reload
The system SHALL support reloading configuration at runtime without restarting the daemon. All subagents and workers MUST re-read their configuration after a reload.

#### Scenario: Config updated via Settings UI
- GIVEN a user changes the LLM provider in the Settings UI
- WHEN `PUT /api/config` is called
- THEN `zaion.yaml` is updated, ConfigManager reloads, and Oracle is reinitialised

### Requirement: Per-section HTTP API
The system SHALL expose read and write endpoints for each config section:
- `GET/POST /api/config` — global config
- `GET/POST /api/config/apoc` — Apoc config
- `GET/POST /api/config/trinity` — Trinity config
- `GET/POST /api/config/neo` — Neo config
- `GET/POST /api/config/chronos` — Chronos config
- `GET/POST /api/config/smiths` — Smiths config
- `GET/POST /api/config/devkit` — DevKit security config

#### Scenario: Config section read
- GIVEN Apoc is configured with a custom model
- WHEN `GET /api/config/apoc` is called
- THEN the current Apoc config (merged from YAML + env vars) is returned

#### Scenario: Config section updated
- GIVEN `POST /api/config/apoc` is called with `{"model": "claude-opus-4"}`
- WHEN the request is processed
- THEN `zaion.yaml` is updated and the change is reflected immediately

### Requirement: API key authentication
The system SHALL protect all API endpoints with an API key when `api.key` is configured in `zaion.yaml`.

#### Scenario: Valid API key accepted
- GIVEN `api.key` is set to `my-secret`
- WHEN a request includes `Authorization: Bearer my-secret`
- THEN the request is processed normally

#### Scenario: Missing API key rejected
- GIVEN `api.key` is configured
- WHEN a request is made without the Authorization header
- THEN a 401 response is returned

#### Scenario: No API key configured — open access
- GIVEN `api.key` is not set in `zaion.yaml`
- WHEN any request is made
- THEN all endpoints are accessible without authentication
