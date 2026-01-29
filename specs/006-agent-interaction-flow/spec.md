# Feature Specification: Agent Interaction Flow & Telegram Integration

**Feature Branch**: `006-agent-interaction-flow`
**Created**: 2026-01-29
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Interactive Configuration (Priority: P1)

A user wants to configure their agent to work with Telegram easily during the initialization process so they don't have to manually edit configuration files.

**Why this priority**: Essential for onboarding users to the new feature.

**Independent Test**:
1. Run `morpheus init`.
2. complete basic setup.
3. When asked "Configure external channels?", select "Yes".
4. Select "Telegram".
5. Enter a dummy API Token.
6. Enter `12345,67890` for allowed users.
7. Verify system configuration contains the correct Telegram config with enabled status, the token, and the list of allowed IDs.

### User Story 2 - Authorized Interaction Loop (Priority: P1)

An authorized Telegram user wants to chat with the agent via Telegram and receive intelligent responses so they can use the agent remotely.

**Why this priority**: Core value proposition of the feature.

**Independent Test**:
1. Start Morpheus with valid Telegram config.
2. As an authorized user (whose ID is in config), send "Hello".
3. Verify terminal shows "Received message from..." and then "Responded...".
4. Verify the Telegram bot replies with a relevant response from the Agent.

### User Story 3 - Unauthorized Access Control (Priority: P2)

I want the system to ignore messages from unknown users so that my agent is not abused by public access.

**Why this priority**: Security requirement.

**Independent Test**:
1. Start Morpheus.
2. Remove your ID from the config (or add a different one).
3. Send a message to the bot.
4. Verify terminal shows "Unauthorized access attempt...".
5. Verify NO response is received on Telegram.

### User Story 4 - Error Feedback (Priority: P2)

I want to be notified if something goes wrong during message processing so I know why I didn't get a proper answer.

**Why this priority**: User experience and debugging.

**Independent Test**:
1. Mock the Agent to throw an error (or disconnect internet).
2. Send a message.
3. Verify terminal shows the error.
4. Verify Telegram receives an error message (e.g., "An error occurred...").

## Functional Requirements

### CLI Initialization (`init`)
1.  **Channel Selection**: The interactive setup must ask if the user wants to configure external channels.
    *   Present a selection list (currently only "Telegram").
2.  **Telegram Configuration Flow**:
    *   If Telegram is selected, set enabled status to true.
    *   Prompt for **Bot API Token**.
    *   Prompt for **Allowed User IDs**:
        *   Display instruction: "Please ask @userinfobot to get your User ID."
        *   Accept comma-separated list (e.g., `123,456`).
        *   Parse into a list of numeric or string identifiers.
3.  **Persistence**: Save the collected values into the system configuration.

### Data Model & Configuration
1.  Update the configuration schema to support Telegram settings:
    *   Enabled status (boolean)
    *   Bot Authentication Token (string)
    *   Allowed User IDs (list of identifiers)

### Integration Logic
1.  **Initialization**:
    *   Load configuration.
    *   If enabled is false, do not connect.
    *   If token is missing, skip with a warning.
2.  **Message Handling Loop**:
    *   Listen for text messages from the channel.
    *   **Filter**: Validate the sender's User ID against the configured list of allowed users.
    *   **Unauthorized**:
        *   Log a warning indicating unauthorized access attempt (including username and ID).
        *   Do not process the message further.
        *   Do not reply to the user.
    *   **Authorized**:
        *   Log an info message indicating receipt of message from the user.
        *   Submit the message text to the Agent for processing.
        *   Wait for the Agent's response.
        *   Send the response back to the Telegram chat.
        *   Log an info message indicating the response was sent.
3.  **Error Handling**:
    *   Handle any errors during Agent processing.
    *   If an error occurs:
        *   Log the error details.
        *   Send a user-friendly error message to the Telegram chat (e.g., "Sorry, I encountered an error processing your request.").

### System Constraints
1.  The integration must interact with the initialized Agent instance.
2.  All terminal output must use the standard Display Manager to ensure consistency.

## Success Criteria

1.  **Configuration Persistence**: System configuration is correctly updated and saved after the initialization flow.
2.  **Security Enforcement**: Messages from IDs not in the allowed list trigger a log warning and receive no response.
3.  **End-to-End Conversation**: A message sent from an authorized Telegram account results in a generated reply in the same chat.
4.  **Observability**: All interactions (Receive, Reply, Error, Block) are visible in the terminal logs.

## Assumptions
*   The user has a valid Telegram account and can create a bot via BotFather to get a token.
*   The user understands how to find their User ID (instructions provided).
*   The Agent interface for processing messages is available and stable.
*   Network connectivity to Telegram APIs is available.
