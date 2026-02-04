# Quickstart: Sati Memory Middleware

## Prerequisites

- Morpheus CLI installed and configured.
- `better-sqlite3` installed capabilities (included in current package).

## Installation

This feature is part of the core runtime. No separate installation is needed.
Ensure your dependencies are up to date:

```bash
npm install
```

## Running with Memory

1. **Start Morpheus**:
   ```bash
   npm start -- start
   ```
   The system will automatically initialize `.morpheus/memory/santi-memory.db` on first run.

2. **Verify Initialization**:
   Check if the database file exists:
   ```bash
   ls ~/.morpheus/memory/santi-memory.db
   ```
   *(Windows path may vary, typically `C:\Users\USER\.morpheus\memory\santi-memory.db` or similar)*

## Usage

Interact normally with Morpheus.
- **Tell it facts**: "I use TypeScript for backend."
- **Check recall**: In a NEW session (restart agent), ask "What language do I use for backend?"

## Debugging

Enable verbose logging to see Sati's internal decisions (retrieval and evaluation logs).

```bash
# In config.yaml (or similar)
logging:
  level: debug
```

Look for logs tagged `[SatiMiddleware]` or `[SatiService]`.
