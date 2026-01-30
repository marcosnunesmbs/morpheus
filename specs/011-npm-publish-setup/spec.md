# Feature Specification: NPM Publish Configuration

**Feature Branch**: `011-npm-publish-setup`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "quero publicar esse projeot no npm para que a pessoa possa isntalar com npm globalmente e chamar o comando morpheus para chamar o cli e se der start rodar tudo além do ui na porta 3333. Veja se precisamos de alguma configuração a ser feita para isso funcionar"

## User Scenarios & Testing

### User Story 1 - Global Installation and Usage (Priority: P1)

As a developer, I want to install Morpheus globally via npm so that I can access the CLI tool from any directory on my machine.

**Why this priority**: Core requirement for distribution.

**Independent Test**: Can be tested by running `npm install -g .` from the project root (simulating a package) and verifying accessibility.

**Acceptance Scenarios**:

1. **Given** the project is built, **When** I run `npm install -g .`, **Then** the `morpheus` command is available in my terminal.
2. **Given** Morpheus is installed globally, **When** I run `morpheus --version`, **Then** I see the correct version number.

---

### User Story 2 - Start Command with UI (Priority: P1)

As a user, I want to run `morpheus start` to launch the agent and the Web UI simultaneously on the default port.

**Why this priority**: Ensures the main functionality works out-of-the-box for end users.

**Independent Test**: Run `morpheus start` and check `http://localhost:3333`.

**Acceptance Scenarios**:

1. **Given** Morpheus is running, **When** I execute `morpheus start`, **Then** the CLI daemon starts AND the Web UI is served at `http://localhost:3333`.
2. **Given** Morpheus is running, **When** I navigate to `http://localhost:3333`, **Then** the Morpheus dashboard loads.
3. **Given** I want to use a different port, **When** I run `morpheus start --port 4000`, **Then** the Web UI is served at `http://localhost:4000`.

---

## Functional Requirements

1. **Package Configuration**: `package.json` MUST be configured to include all necessary build artifacts (`dist`, `bin`) in the published package.
2. **Executable Binaries**: The `bin/morpheus.js` file MUST be executable and correctly mapped in the `bin` field of `package.json`.
3. **Build Scripts**: A `prepublishOnly` script SHOULD be added to ensure the project is fully built (frontend + backend) before publishing.
4. **Dependencies**: All runtime dependencies MUST be in `dependencies` (not `devDependencies`), except those strictly for build/test.
5. **Static Assets**: The `HttpServer` MUST correctly locate the compiled UI assets when run from the global installation path.

## Success Criteria

1. **Installability**: `npm install -g <package>` completes without error.
2. **Command Availability**: `morpheus` command is recognized by the OS shell.
3. **Functionality**: `morpheus start` successfully launches the daemon and serves the UI.
4. **Asset Integrity**: UI loads correctly (no 404s for JS/CSS files) when running from the installed package.

## Assumptions

1. The user has an npm account to publish the package.
2. The package name `morpheus-cli` (currently in package.json) is the intended registry name.
3. The environment has `node` and `npm` installed.

## Key Entities

- **Package Manifest**: `package.json`
- **Build Artifacts**: `dist/` folder (Backend and Frontend)
- **CLI Entry Point**: `bin/morpheus.js`
