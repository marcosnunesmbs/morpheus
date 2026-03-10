# Feature Specification: Web UI Dashboard & Config Manager

**Feature Branch**: `009-web-ui-dashboard`
**Created**: 2026-01-29
**Status**: Draft
**Input**: User description: "Agora vamos criar nossa interface ui. Tecnologias: React com Tailwind e Vite. Matrix theme (#13402B, #1D733B, #4ED963, #9AF28D, #0D0D0D) and Dark Mode (#04060D). Features: View/Change .morpheus config, Read logs, Footer info."

## User Scenarios & Testing

### User Story 1 - Dashboard Access & System Status (Priority: P1)

The user accesses the web interface to get an immediate overview of the agent's status and environment details.

**Why this priority**: It establishes the entry point for the UI and confirms the system is running.

**Independent Test**: Can be tested by launching the application and verifying the dashboard loads with the correct theme and footer information.

**Acceptance Scenarios**:

1. **Given** the Morpheus daemon is running, **When** the user opens the UI URL in a browser, **Then** the dashboard loads displaying the Matrix-themed interface.
2. **Given** the dashboard is loaded, **When** the user views the footer, **Then** they see the correct Node version, Project version, Agent name, and Server status.

---

### User Story 2 - Configuration Management (Priority: P1)

The user views the current system configuration and makes changes directly through the UI without editing text files.

**Why this priority**: Providing a user-friendly way to manage configuration is a core requirement of the feature.

**Independent Test**: Can be tested by modifying a configuration value in the UI and verifying the file changes on disk.

**Acceptance Scenarios**:

1. **Given** the configuration page, **When** the page loads, **Then** the current settings from `.morpheus/config.yaml` are displayed in an editable form.
2. **Given** the user has modified a setting, **When** the user clicks "Save", **Then** the system updates the `config.yaml` file and confirms the save was successful.

---

### User Story 3 - Log Viewer (Priority: P2)

The user inspects the system logs through the web interface to troubleshoot issues or verify agent activities.

**Why this priority**: Essential for diagnostics without needing direct server/file access.

**Independent Test**: Can be tested by generating a new log entry and verifying it appears in the UI log viewer.

**Acceptance Scenarios**:

1. **Given** the logs page, **When** the user navigates to it, **Then** a list of recent log entries from the logs directory is displayed.
2. **Given** the log viewer, **When** new logs are written by the system, **Then** the user can refresh or see the new entries.

---

### User Story 4 - Theme Customization (Priority: P3)

The user switches between the default Matrix/Light theme and the Matrix/Dark theme.

**Why this priority**: Enhances user experience and meets specific visual requirements.

**Independent Test**: Can be tested by toggling the theme switch and verifying CSS variable/color changes.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** the user selects "Dark Mode", **Then** the background changes to `#04060D` and foreground colors adjust to the Matrix palette constraints.

### Edge Cases

- **Config File Missing/Corrupt**: How does the system handle if `.morpheus/config.yaml` cannot be read? (Expectation: Display error message and fallback/default values or prevent loading).
- **Log Directory Inaccessible**: What happens if the logs folder path is invalid or permissions are denied? (Expectation: Show "No logs available" or specific error).
- **Invalid Configuration Input**: What happens if the user enters a non-conforming value (e.g. text for a port number)? (Expectation: Validation error before saving).
- **Server Disconnection**: How does the UI behave if the backend daemon stops running? (Expectation: Show "Connection Lost" status).

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a web-based user interface served by the application.
- **FR-002**: System MUST implement a "Matrix" visual theme using the specific color palette: `#13402B` (Dark Green), `#1D733B` (Green), `#4ED963` (Bright Green), `#9AF28D` (Light Green), `#0D0D0D` (Black), and `#fff` (White) for backgrounds/text as appropriate.
- **FR-003**: System MUST provide a "Dark Mode" option that specifically uses `#04060D` as the background color.
- **FR-004**: System MUST read and display the current configuration from the user's `.morpheus` directory.
- **FR-005**: System MUST allow users to update configuration values and persist them to the underlying configuration file.
- **FR-006**: System MUST read log files from the configured logging directory and display them in the interface.
- **FR-007**: System MUST display a persistent footer containing: Node.js version, Project version, Agent name, and current Server status.
- **FR-008**: System MUST serve the UI on port **3333** by default, adjustable via configuration.

### Technical Constraints

- **TC-001**: The UI MUST be built using **React**.
- **TC-002**: Styling MUST be implemented using **Tailwind CSS**.
- **TC-003**: The build tool and development server MUST be **Vite**.

### Key Entities

- **Configuration**: Represents the settings stored in `.morpheus/config.yaml`.
- **LogEntry**: Represents a single line or block of information from the system logs.
- **SystemStatus**: Represents the runtime state (Node version, Agent Name, Uptime/Status).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can load the dashboard and view the footer information within 2 seconds of page load on a local environment.
- **SC-002**: Configuration changes saved via the UI are reflected in the `config.yaml` file immediately (verified by file inspection).
- **SC-003**: Theme toggle switches the visual appearance (background/foreground colors) instantly (< 200ms).
- **SC-004**: Log viewer displays the most recent 50 log lines correctly.
