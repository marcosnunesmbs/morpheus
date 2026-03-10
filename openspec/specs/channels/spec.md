# Channels Specification

## Purpose
Channels are communication adapters that connect Morpheus to external messaging platforms (Telegram, Discord). The ChannelRegistry provides a uniform interface for sending messages and broadcasting results, so notification machinery never holds direct adapter references.

## Scope
Included:
- IChannelAdapter interface contract
- ChannelRegistry — register, get, broadcast, sendToUser
- Telegram adapter: receive commands, send messages, callback queries
- Discord adapter: receive messages, send messages

Out of scope:
- How task results are routed to channels (covered in `tasks` spec)
- Webhook notification delivery (covered in `webhooks` spec)
- Chronos result broadcast (covered in `chronos` spec)

## Requirements

### Requirement: Channel adapter contract
The system SHALL require every channel adapter to implement `IChannelAdapter` with:
- `channel: string` — unique identifier (e.g., `'telegram'`, `'discord'`)
- `sendMessage(text)` — broadcast to all users of that channel
- `sendMessageToUser(userId, text)` — send to a specific user
- `disconnect()` — clean shutdown

#### Scenario: Adapter registered at startup
- GIVEN Telegram is configured and enabled
- WHEN the daemon starts
- THEN `TelegramAdapter` is instantiated, connected, and registered via `ChannelRegistry.register(adapter)`

### Requirement: Broadcast
The system SHALL broadcast a message to all registered channel adapters in parallel, logging but not propagating individual adapter errors.

#### Scenario: Broadcast to multiple channels
- GIVEN Telegram and Discord adapters are both registered
- WHEN `ChannelRegistry.broadcast("hello")` is called
- THEN both adapters' `sendMessage("hello")` are called concurrently
- AND if Discord fails, Telegram still receives the message

#### Scenario: Broadcast with no adapters
- GIVEN no adapters are registered
- WHEN `ChannelRegistry.broadcast("hello")` is called
- THEN the call completes without error (no-op)

### Requirement: Targeted send
The system SHALL route a message to a specific user on a specific channel.

#### Scenario: Message sent to known user
- GIVEN a Telegram adapter is registered and user ID `12345` is known
- WHEN `ChannelRegistry.sendToUser('telegram', '12345', 'done')` is called
- THEN the message is delivered to that Telegram user

#### Scenario: Channel not registered
- GIVEN no Discord adapter is registered
- WHEN `ChannelRegistry.sendToUser('discord', '99', 'hello')` is called
- THEN a warning is logged and no error is thrown

### Requirement: Telegram — command routing
The system SHALL process Telegram commands and route them to the appropriate handler:

| Command | Action |
|---|---|
| `/start` | Welcome message |
| `/help` | Help text |
| `/trinity` | List registered databases |
| `/chronos <...>` | Schedule a new Chronos job |
| `/chronos_list` | List Chronos jobs |
| `/chronos_view <id>` | View job details |
| `/chronos_enable <id>` / `/chronos_disable <id>` | Toggle job |
| `/chronos_delete <id>` | Delete job |
| Any other text | Forwarded to Oracle as a chat message |

#### Scenario: Unknown command forwarded to Oracle
- GIVEN a user sends `/foo bar` in Telegram
- WHEN the adapter receives the message
- THEN it is forwarded to Oracle as a regular chat message

### Requirement: Telegram — callback queries
The system SHALL handle Telegram inline keyboard callback queries (e.g., Chronos confirmations) using safe methods that do not throw on expired callbacks.

#### Scenario: Callback answered safely
- GIVEN a Telegram callback query arrives for a Chronos confirmation
- WHEN the adapter processes it
- THEN it answers the callback without throwing if the query has expired

### Requirement: Discord — message routing
The system SHALL process Discord messages from authorized users and route them to Oracle, ignoring bot messages.

#### Scenario: User message forwarded
- GIVEN a Discord user sends a message in a configured channel
- WHEN the adapter receives it
- THEN the message is forwarded to Oracle with the user's Discord ID as `userId`

#### Scenario: Bot message ignored
- GIVEN a bot sends a message in the Discord channel
- WHEN the adapter receives it
- THEN it is silently ignored

### Requirement: Graceful disconnect
The system SHALL disconnect all channel adapters cleanly on daemon shutdown.

#### Scenario: Shutdown sequence
- GIVEN Telegram and Discord are connected
- WHEN the daemon receives SIGTERM
- THEN each adapter's `disconnect()` is called and connections are closed
