# Changelog

All notable changes to Morpheus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Renamed `memory.limit` configuration to `llm.context_window` for semantic clarity
  - This field controls how many messages from history are sent to the LLM, not memory storage limits
  - Automatic migration runs on startup - existing configs are migrated seamlessly
  - Backward compatibility maintained: old `memory.limit` field still works via fallback
  - Web UI updated: field moved to "LLM Configuration" section with label "Context Window (Messages)"
  - Init command now prompts for "Context Window Size" instead of "Memory Limit"
  - Doctor command validates `llm.context_window` and detects deprecated `memory.limit` usage

### Migration Guide
If you're upgrading from a previous version:
1. **Automatic**: On first start after upgrade, your config will auto-migrate
2. **Manual** (optional): Edit `~/.morpheus/config.yaml` and move `memory.limit` to `llm.context_window` under the `llm` section
3. **Rollback**: If needed, a backup is created at `~/.morpheus/config.yaml.backup-<timestamp>`

Example:
```yaml
# Before (deprecated)
memory:
  limit: 100

# After (recommended)
llm:
  context_window: 100
```
