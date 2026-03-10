# Quickstart: External Channels

Enable your Morpheus agent to talk to the outside world.

## Setting up Telegram

1.  **Create a Bot**:
    *   Open Telegram and search for **@BotFather**.
    *   Send `/newbot` and follow instructions.
    *   Copy the **API Token**.

2.  **Get your User ID**:
    *   Search for **@userinfobot** in Telegram.
    *   Start the bot.
    *   Copy your numeric **ID** (e.g., `12345678`).

3.  **Initialize Morpheus**:
    ```bash
    morpheus init
    ```
    *   Complete the standard setup.
    *   When asked **"Configure external channels?"**, select **Yes**.
    *   Select **Telegram**.
    *   Paste your **API Token**.
    *   Enter your **User ID**.

4.  **Start the Agent**:
    ```bash
    morpheus start
    ```

5.  **Chat**:
    *   Open your bot in Telegram.
    *   Send "Hello!".
    *   Morpheus will reply!
