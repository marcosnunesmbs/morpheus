# Terminal UI Manager Research

## Current State Analysis

### 1. Existing Usage
- **`src/cli/commands/start.ts`**:
  - Initializes a local `ora` instance: `const spinner = ora('Agent active and listening...').start();`.
  - This instance is scoped to the `action` function and not accessible outside.
  - Lifecycle logs (start, stop) use `console.log` directly.
- **`src/channels/telegram.ts`**:
  - Uses `console.log(chalk.blue(...))` inside asynchronous callbacks (`bot.on('text')`).
  - **Problem**: When `TelegramAdapter` logs a message while the `start.ts` spinner is active, the output will likely break the spinner line or cause visual artifacts (e.g., duplicate spinner lines).

### 2. `ora` Library Capabilities
`ora` manages `stderr` to draw frames. To log messages without breaking the animation, the active spinner line must be handled.
- **Methods**:
  - `.stop()`: Clears the spinner and stops animation.
  - `.clear()`: Clears the current line but keeps state.
  - `.info(text)`: Stops the spinner, changes symbol to ℹ, prints text. (Stops animation).
- **Pattern for "Logging Above"**:
  `ora` does not have a native "log above while spinning" method that keeps the spinner running in background seamlessly without intervention.
  - **Recommended Pattern**:
    ```typescript
    if (spinner.isSpinning) {
      spinner.stop();       // 1. Clear the spinner line
      console.log(message); // 2. Print the log line
      spinner.start();      // 3. Render spinner on new line
    } else {
      console.log(message);
    }
    ```

## Recommended Architecture

### Singleton DisplayManager
To resolve the scope issue (`TelegramAdapter` vs `start.ts`), a Singleton `DisplayManager` is required.

**Validation**:
- **Central Control**: A single entity must own the `stdout`/`stderr` stream to prevent collision between the active spinner loop and async event logs.
- **Decoupling**: Adapters (`TelegramAdapter`, etc.) should not import `ora` directly. They should call a generic method like `DisplayManager.log()` or `logger.info()`.

### Implementation Summary
1.  **Stop-Log-Start**: Verified as the most robust way to handle `ora` interruptions.
2.  **Singleton**: Validated as necessary given the distributed nature of logging (adapters vs main loop).
