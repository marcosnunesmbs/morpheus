# Feature Specification: Settings Form UI

**Feature Branch**: `010-settings-form-ui`
**Created**: January 29, 2026
**Status**: Draft
**Input**: User description: "na página de configurações quero que tenhamos sessões de formulários pra salvar os dados do config json. o usuário não editará o json, mas passará os valores de inputs e poderá clicar em salvar para mandar o json atualizado pra api"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Current Settings (Priority: P1)

As a Developer/Admin, I want to view my current Morpheus configuration in a structured form so that I can understand the active settings without reading a raw YAML/JSON file.

**Why this priority**: Essential for visibility; prerequisite for editing.

**Independent Test**: Can be tested by manually modifying `config.yaml` and verifying the UI reflects the changes after refresh.

**Acceptance Scenarios**:

1. **Given** the `config.yaml` has `agent.name = "Neo"`, **When** I navigate to the Settings page, **Then** I see "Neo" in the Agent Name input field.
2. **Given** no `config.yaml` exists (defaults used), **When** I open Settings, **Then** I see default values populated in the forms.
3. **Given** complex nested settings (e.g., Telegram channels), **When** I view the page, **Then** they are organized into logical sections/tabs (e.g., "Channels").

---

### User Story 2 - Update and Save Settings (Priority: P1)

As a Developer/Admin, I want to modify settings via form inputs and save them so that the agent's behavior changes without manual file editing.

**Why this priority**: Core functionality requested; enables configuration management via UI.

**Independent Test**: Can be tested by changing a value in UI, clicking Save, and verifying `config.yaml` content on disk.

**Acceptance Scenarios**:

1. **Given** I am on the Settings page, **When** I change the LLM Model to "gpt-4", **Then** the "Save" button becomes enabled/highlighted.
2. **Given** I have modified a setting, **When** I click "Save", **Then** a success notification appears and the `config.yaml` file on disk is updated with the new value.
3. **Given** the API returns a success response, **When** I reload the page, **Then** the new value persists in the form.

---

### User Story 3 - Input Validation (Priority: P2)

As a Developer, I want the form to validate my inputs before saving so that I don't break the agent with invalid configuration.

**Why this priority**: Prevents configuration errors and runtime failures.

**Independent Test**: Can be tested by entering invalid data (e.g., negative temperature) and observing UI errors.

**Acceptance Scenarios**:

1. **Given** the Temperature field accepts 0-1, **When** I enter "2.0" or "-1", **Then** the UI shows a validation error and prevents saving.
2. **Given** a required field (e.g., LLM Provider), **When** I clear it, **Then** the UI indicates it is required.

## Functional Requirements *(mandatory)*

### System Capabilities
- **Retrieve Configuration**: System must be able to fetch the full current active configuration.
- **Update Configuration**: System must allow updating the configuration.
    - Must validate incoming data against defined schema rules.
    - Must persist valid configuration to storage (disk).
    - Must provide updated configuration or error details upon operation.

### User Interface
- **Settings Page Layout**:
    - Split into logical sections aligning with configuration structure (e.g., Agent, LLM, Channels, UI, Logging).
    - Use tabs or collapsible sections for better navigation.
- **Form Components**:
    - Text inputs for text values (names, tokens).
    - Select/Dropdowns for predefined options (Providers, Logging Level).
    - Number inputs for numeric values (Temperature, Port).
    - Toggles/Checkboxes for on/off states (Enabled flags).
- **Interaction**:
    - Populate fields with current active settings on load.
    - Enable "Save" action when changes are detected.
    - Indicate processing state during save operations.

## Data Models *(optional)*

**Configuration Structure** (Reference existing system configuration)
- Updates must strictly adhere to the defined configuration schema.

## Success Criteria *(mandatory)*

1. **Usability**: Users can update key settings (e.g., Agent Name) via the UI in under 30 seconds.
2. **Persistence**: 100% of successful save operations result in stored settings being updated on disk.
3. **Feedback**: User receives visual confirmation within 1 second of a successful save.
4. **Safety**: Invalid configuration (violating schema rules) is rejected with clear error feedback.

## Assumptions *(optional)*

- The backend system already exists to handle load/save logic.
- The UI will be integrated into the existing dashboard.
