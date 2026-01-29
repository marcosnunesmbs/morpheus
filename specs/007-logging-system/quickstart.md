# Quickstart: Logging

**Branch**: `007-logging-system`

## Usage for Developers

### Basic Logging
Use the `DisplayManager` as usual. File logging happens automatically in the background.

```typescript
import { DisplayManager } from '../runtime/display';

const display = DisplayManager.getInstance();

// Simple UI log (also written to file as info)
display.log('Agent started');

// Structured Audit Log
// "meta" object is NOT shown in console, but IS written to file.
display.log('User authenticated', {
  level: 'info',
  source: 'AuthSystem',
  meta: { userId: '123', method: 'telegram' }
});

// Error Log with Stack Trace
try {
  throw new Error('Boom');
} catch (err) {
  display.log('Critical failure', {
    level: 'error',
    meta: { error: err }
  });
}
```

## Configuration

Edit `~/.morpheus/config.yaml`:

```yaml
logging:
  enabled: true
  level: info     # debug, info, warn, error
  retention: 14d  # Keep logs for 14 days
```

## Viewing Logs

Logs are stored in `~/.morpheus/logs/`.
File name format: `morpheus-YYYY-MM-DD.log`.

```bash
tail -f ~/.morpheus/logs/morpheus-2026-01-29.log
```
