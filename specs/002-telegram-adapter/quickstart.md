# Quickstart: Telegram Setup

## Prerequisites
1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram.
2. Get your `HTTP API Token`.

## Setup via CLI

1. **Set the token**:
   ```bash
   morpheus config set channels.telegram.token "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
   ```

2. **Enable the channel**:
   ```bash
   morpheus config set channels.telegram.enabled true
   ```

3. **Start Morpheus**:
   ```bash
   morpheus start
   ```
   *Look for `[Telegram] Connected...` in the logs.*

4. **Verify**:
   Send a message "Hello" to your bot on Telegram. You should see it appear in your terminal.
