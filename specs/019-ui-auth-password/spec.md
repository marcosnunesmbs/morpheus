# Feature Specification: UI Authentication with Environment Variable

**Feature Branch**: `019-ui-auth-password`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "agora preciso pegar de uma variável de ambiente (que aqui pode vir de .evn) e se chamará THE_ARCHITECT_PASS, e esse passoword será necessário para acessar o painel do ui, as apis que ela comunica precisam receber essa senha no cabeçalho que pode ficar salvo em localstorage ao fazer o longin no painel, para consultas futuras."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Access to Dashboard (Priority: P1)

As an Administrator ("The Architect"), I want to restrict access to the dashboard so that only I can control the agent.

**Why this priority**: Critical security requirement to prevent unauthorized access.

**Independent Test**: Start server with `THE_ARCHITECT_PASS` set. Verify UI redirects to login. Verify entering password grants access.

**Acceptance Scenarios**:

1. **Given** the environment variable `THE_ARCHITECT_PASS` is set, **When** I navigate to the dashboard root configuration, **Then** I am redirected to a Login page.
2. **Given** I am on the Login page, **When** I enter the correct password, **Then** I am redirected to the main dashboard and the password is saved for future use.
3. **Given** I am on the Login page, **When** I enter an **incorrect** password, **Then** I see an "Invalid Password" error and remain on the page.

---

### User Story 2 - API Request Authorization (Priority: P1)

As the Backend System, I want to reject any API calls that do not provide the correct credentials in the request headers.

**Why this priority**: Prevents bypassing the UI to access the agent's functions directly.

**Independent Test**: Run `src/http/__tests__/auth.test.ts` to verify middleware rejects/accepts requests correctly.

**Acceptance Scenarios**:

1. **Given** `THE_ARCHITECT_PASS` is configured, **When** a request is made to a protected API endpoint (e.g., `/api/agents`) without the auth header, **Then** the server returns `401 Unauthorized`.
2. **Given** `THE_ARCHITECT_PASS` is configured, **When** a request includes the header `X-Architect-Pass` matching the env var, **Then** the server processes the request normally.
3. **Given** `THE_ARCHITECT_PASS` is **NOT** configured (empty), **When** a request is made without headers, **Then** the server allows the request (Backward compatibility/Open mode).

---

### User Story 3 - Session Persistence (Priority: P2)

As a User, I want my login session to persist so I don't have to enter the password every time I refresh the page.

**Why this priority**: Improves user experience (UX).

**Independent Test**: Log in, refresh browser, ensure dashboard loads without login prompt.

**Acceptance Scenarios**:

1. **Given** I have previously logged in (password saved in Client Storage), **When** I reload the page, **Then** the application automatically uses the stored password and bypasses the login screen.
2. **Given** I have a stored password that is now incorrect (e.g., env var changed), **When** the app loads and checks the API, **Then** it detects the 401 error, clears the invalid password, and redirects to Login.

## Functional Requirements *(mandatory)*

1.  **Backend Configuration**:
    -   Read `THE_ARCHITECT_PASS` from existing configuration or directly from environment.
    -   If set, enable authentication mode. If unset, disable authentication (allow all).

2.  **API Request Validation**:
    -   Implement a server-side mechanism to intercept protected API routes.
    -   Check for header `x-architect-pass` (case-insensitive).
    -   Compare header value with memory/env value.
    -   Reject with 401 if mismatch.

3.  **Frontend Auth Handling**:
    -   Create a `Login` view.
    -   Implement a mechanism to manage authentication state (check if has password).
    -   On App init, if password missing and Auth is required (backend returns 401 on initial probe or similar), show Login.
    -   Store valid password in Client Storage (e.g., LocalStorage).
    -   Inject password into API requests via headers.

4.  **UI Feedback**:
    -   Show clear errors on failed login attempts.
    -   (Optional) Add a visual indicator or "Logout" button to clear stored password.

## Success Criteria *(mandatory)*

1.  **Secure Default**: When the env var is present, no protected data is exposed without the password.
2.  **Header Compliance**: API expects and validates the specific custom header.
3.  **Persistence**: Valid credentials persist across browser restarts/refreshes.
4.  **Graceful Failures**: UI handles auth failures (401s) by redirecting to login.

## Key Entities *(if data involved)*

*   **Auth Token/Password**: The string value of `THE_ARCHITECT_PASS`.
*   **Storage Key**: The client-side key used to store the password (e.g., `morpheus.auth.token`).

## Assumptions & Risks *(optional)*

*   **Assumption**: All API routes under `/api/` are considered "protected" except maybe a status/health check if needed for initial loading.
*   **Assumption**: Storing password in LocalStorage is acceptable for this local-first architecture.
*   **Risk**: If the user loses the env password, they just need to check their `.env` file or server config to recover it.