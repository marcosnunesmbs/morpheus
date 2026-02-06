# Telegram Commands Contract

## Available Commands

### `/start`
Shows welcome message and available commands.

**Response**:
```
Hello, @{username}! I am {agent.name}, {agent.personality}.

I am your local AI operator/agent. Here are the commands you can use:

/start - Show this welcome message and available commands
/status - Check the status of the Morpheus agent
/doctor - Diagnose environment and configuration issues
/stats - Show token usage statistics
/help - Show available commands
/zaion - Show system configurations
/sati <qnt> - Show specific memories
/restart - Restart the Morpheus agent

How can I assist you today?
```

### `/status`
Check the status of the Morpheus agent.

**Response**:
- If running: `Morpheus is running (PID: {pid})`
- If stopped: `Morpheus is stopped.`

### `/doctor`
Diagnose environment and configuration issues.

**Response**:
Detailed diagnostic information about Node.js version, configuration validity, API keys, etc.

### `/stats`
Show token usage statistics.

**Response**:
Token usage statistics broken down by provider and model.

### `/help`
Show available commands.

**Response**:
List of all available commands with descriptions.

### `/zaion`
Show system configurations.

**Response**:
Detailed system configuration information.

### `/sati <qnt>`
Show specific memories.

**Arguments**:
- `qnt` (optional): Quantity of memories to show.

**Response**:
List of SATI memories.

### `/restart`
Restart the Morpheus agent.

**Response**:
```
🔄 Restart initiated. The Morpheus agent will restart shortly.
```

After restart, the bot sends a notification:
```
✅ Morpheus agent has been successfully restarted!
```