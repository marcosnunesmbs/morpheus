# Feature Specification: Logging System

**Feature Branch**: `007-logging-system`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "Implement persistent logging system as defined in SPEC.md"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Peristent Auditing (Priority: P1)

As a developer or administrator, I need the system to persist operational logs to the filesystem so that I can diagnose issues and audit agent behavior after the fact, even if the console output is lost.

**Why this priority**: Essential for debugging a daemon process that runs in the background.

**Independent Test**: Can be fully tested by running the daemon, performing known actions (like sending a message), and verifying the existence and content of the log file.

**Acceptance Scenarios**:

1. **Given** the daemon is started, **When** it initializes, **Then** a log file is created in `~/.morpheus/logs/`.
2. **Given** the daemon is running, **When** an event occurs (e.g. error or info message), **Then** a corresponding entry is appended to the current day's log file with a timestamp.
3. **Given** an error occurs, **When** it is logged, **Then** the stack trace and metadata are included in the log file.

---

### User Story 2 - Automated Log Rotation (Priority: P2)

As a user, I want log files to be automatically rotated daily and cleaned up after a retention period, so that my disk space is not consumed by indefinite logging.

**Why this priority**: Prevents resource exhaustion and ensures system health over long-term usage.

**Independent Test**: Can be tested by configuring a short retention period or simulating date changes and verifying file creation/deletion.

**Acceptance Scenarios**:

1. **Given** a log file exists for the current day, **When** the date changes (or next run is on a new day), **Then** a new log file is created for the new day.
2. **Given** log files exist that are older than the configured retention period (e.g. 14 days), **When** a new log is written/rotation check occurs, **Then** those old files are deleted from the disk.

---

### User Story 3 - Configurable Logging Logic (Priority: P2)

As a user, I want to be able to configure the log level and retention policy via the application configuration, so that I can control the verbosity and storage usage according to my needs.

**Why this priority**: Allows adapting the tool to different environments (dev vs prod) and user preferences.

**Independent Test**: Update configuration settings and verify behavior changes (e.g., set level to 'error' and ensure 'info' logs don't appear in file).

**Acceptance Scenarios**:

1. **Given** configuration specifies a retention of '7d', **When** rotation runs, **Then** logs older than 7 days are deleted.
2. **Given** configuration specifies logging `enabled: false`, **When** the daemon runs, **Then** no log files are written.

---

### Edge Cases

- What happens if the `logs` directory is not writable? The system should likely fall back to console only or log a startup error (without crashing the main application if possible, or fail fast).
- What happens if configuration has invalid logging values? System should use safe defaults (enabled, info level, 14d retention).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist all operational logs to the application's log directory (e.g. `~/.morpheus/logs/`).
- **FR-002**: System MUST use a structured, machine-parsable format for file logs: `[ISO-TIMESTAMP] [LEVEL] MESSAGE {METADATA}`.
- **FR-003**: System MUST support daily log rotation, creating a new file for each day.
- **FR-004**: System MUST automatically delete log files that are older than the configured retention period.
- **FR-005**: System MUST allow configuration of log settings (enabled, level, retention) via the central configuration.
- **FR-006**: System MUST maintain existing console output behavior while simultaneously writing to files.
- **FR-007**: System MUST initialize the logging subsystem immediately upon daemon startup.
- **FR-008**: System MUST default to '14d' retention and 'info' level if not explicitly configured.

### Key Entities

- **LogConfig**: Configuration object containing `enabled` (boolean), `level` (string), and `retention` (string).
- **LogFile**: The physical text file containing the logs, named by date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Log files are successfully created and written to in 100% of tested sessions.
- **SC-002**: Log rotation successfully creates a new file when the date changes.
- **SC-003**: Disk usage for logs does not exceed the bounds defined by the retention policy (e.g. files older than N days are effectively removed).
- **SC-004**: Console output remains identical to previous versions (no regression in CLI UX).

## Assumptions *(optional)*

- Users have standard permissions to write to their home directory.
- The runtime environment supports file system access and localized log rotation.
- Log volume is moderate (text-based chat logs).
