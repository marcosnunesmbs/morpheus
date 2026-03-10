# CLI Contract: Telegram Config

## `config set`

Updates a configuration value in `config.yaml`.

**Usage**:
```bash
morpheus config set <key> <value>
```

**Arguments**:
- `key`: Dot-notation path to the config property (e.g. `channels.telegram.token`).
- `value`: The value to set.
    - If `true`/`false` -> parsed as boolean.
    - If numeric string -> parsed as number.
    - Otherwise -> string.

**Output**:
- Success: `✓ Updated <key> to <value>`
- Error (Invalid Key): `✗ Invalid configuration key: <key>`
- Error (Schema Validation): `✗ Invalid value for <key>: <reason>`

**Example**:
```bash
$ morpheus config set channels.telegram.enabled true
✓ Updated channels.telegram.enabled to true
```

## `start` (Updated)

**Behavior Change**:
- If `channels.telegram.enabled` is `true`:
    - Attempt to connect to Telegram.
    - Log success/failure.
    - On `SIGINT`, gracefully stop the bot.

**Log Format**:
```text
[Telegram] Connecting...
[Telegram] Connected as @MyBot
[Telegram] User: Hello World
```
