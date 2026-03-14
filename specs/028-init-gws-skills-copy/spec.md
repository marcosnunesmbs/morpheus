# Feature Specification: Initialize Google Workspace Skills

**Feature Branch**: `028-init-gws-skills-copy`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "coloquei uma pasta gws-skills/skills/ que tem várias skills padrão, vamos fazer com que ao incializar o morpheus copie esse condeudo para .morpheus/skills para que o oracle saiba como mexer com ferramentas do google workspaces"

## Clarifications

### Session 2026-03-13
- Q: Conflict Resolution for Skill Files → A: Smart Sync (MD5). Only overwrite if the file matches a known codebase default; preserve user customizations.
- Q: Google Workspace CLI Authentication Method → A: Service Account (JSON). Use a pre-configured JSON key file for non-interactive authentication.
- Q: Google Workspace CLI Installation Strategy → A: Include in Dockerfile. Pre-install the `gws` CLI in the project's Docker image to ensure environment availability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Skill Availability (Priority: P1)

As a Morpheus user, I want the system to automatically include Google Workspace skills during setup so that I can immediately interact with Google Sheets, Calendar, and Drive without manual configuration.

**Why this priority**: High. This is the core requirement to enable GWS functionality out of the box.

**Independent Test**: Can be tested by deleting `.morpheus/skills/gws-*` files, starting the Morpheus daemon, and verifying the files are recreated.

**Acceptance Scenarios**:

1. **Given** Morpheus is starting for the first time, **When** the initialization process runs, **Then** all skills from `gws-skills/skills/` must be copied to `.morpheus/skills/`.
2. **Given** the user has deleted a GWS skill from their local `.morpheus/skills/` folder, **When** Morpheus restarts, **Then** the missing skill must be restored from the codebase defaults.

---

### User Story 2 - Oracle Skill Discovery (Priority: P2)

As an AI Operator (Oracle), I want to have the latest Google Workspace skills loaded in my environment so that I can correctly use the appropriate tools for user requests involving Google productivity apps.

**Why this priority**: Medium. Ensures the agent actually "sees" and uses the copied skills.

**Independent Test**: Can be tested by asking Oracle "List your Google Workspace capabilities" after a fresh start.

**Acceptance Scenarios**:

1. **Given** the skills were successfully copied during init, **When** Oracle initializes its skill registry, **Then** it must include the Google Workspace skills in its available toolset.

---

### User Story 3 - Headless Authentication (Priority: P1)

As a developer running Morpheus in a Docker container, I want to authenticate Google Workspace using a Service Account JSON file so that the system can perform actions on my behalf without requiring an interactive browser login.

**Why this priority**: High. Essential for automated/daemonized environments where interactive login is impossible.

**Independent Test**: Can be tested by providing a valid Service Account JSON via config and running a `gws` command through Oracle.

**Acceptance Scenarios**:

1. **Given** a valid Service Account JSON key is configured, **When** a Google Workspace skill is invoked, **Then** the `gws` CLI must use that key to authenticate non-interactively.

---

### User Story 4 - Pre-installed Tools (Priority: P1)

As a user deploying Morpheus via Docker, I want the Google Workspace CLI to be pre-installed in the container image so that I don't have to manually install dependencies to use Google Workspace skills.

**Why this priority**: High. Eliminates deployment friction and ensures tool availability.

**Independent Test**: Can be tested by running `gws --version` inside the Morpheus Docker container.

**Acceptance Scenarios**:

1. **Given** the Morpheus Docker image is built, **When** a container is started, **Then** the `gws` CLI must be available in the system PATH.

---

### Edge Cases

- **Source Directory Missing**: What happens if `gws-skills/skills/` is not found in the installation directory? (System should log a warning and continue).
- **Permissions Error**: How does the system handle cases where it cannot write to `.morpheus/skills/`? (Should log an error but the daemon should still attempt to start with available functionality).
- **Conflict with User Modifications**: System MUST only overwrite a destination file if its MD5 hash matches a known previous codebase default. If the user has customized the file, it MUST be preserved to prevent data loss.
- **Invalid Service Account Key**: System MUST detect and report authentication failures with clear guidance on how to fix the JSON key configuration.
- **CLI Missing (Non-Docker)**: If running outside of Docker and `gws` is not in PATH, Morpheus MUST provide a helpful error message with installation instructions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify the source directory `gws-skills/skills/` relative to the application root.
- **FR-002**: System MUST ensure the destination directory `.morpheus/skills/` exists, creating it if necessary.
- **FR-003**: System MUST copy all files from the source to the destination during the `scaffold()` or `initialize()` phase of the daemon startup.
- **FR-004**: System MUST perform a Smart Sync: compare the destination file's MD5 hash against known defaults. Update if it's a known default; skip if it's customized.
- **FR-005**: System MUST log the number of skills initialized/updated during startup for audit purposes.
- **FR-006**: System MUST support non-interactive authentication for the `gws` CLI using a Google Service Account JSON file.
- **FR-007**: System MUST provide a configuration path (env var or config file) for specifying the location of the Service Account JSON key.
- **FR-008**: The project's `Dockerfile` MUST be updated to include the installation of the `gws` CLI.

### Key Entities *(include if feature involves data)*

- **Skill Definition**: A file (usually Markdown or YAML) containing the instructions and tool schemas for a specific capability (e.g., `gws-calendar.md`).
- **Skill Registry**: The internal system component that tracks and loads available skills for the Oracle agent.
- **Service Account Key**: A JSON file containing credentials for Google Workspace API access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of files present in `gws-skills/skills/` at build time are available in the user's `.morpheus/skills/` directory after the first successful startup.
- **SC-002**: System initialization time increase due to the copy operation is less than 200ms on standard SSD hardware.
- **SC-003**: Zero manual steps are required by the user to enable Google Workspace tool definitions after installing Morpheus.
- **SC-004**: Oracle successfully answers "Yes" when asked if it can handle Google Workspace tasks immediately after startup.
- **SC-005**: `gws` CLI commands execute successfully in a headless/Docker environment using only the provided Service Account JSON.
- **SC-006**: The `gws` CLI is verified to be present and functional in the final production Docker image.
