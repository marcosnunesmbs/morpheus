## Why

The Santi memory agent currently relies on the shared LLM configuration. To optimize memory retrieval and agent performance, we need a dedicated configuration section (`santi-config`) that allows specifying a distinct LLM provider/model and a `memory_limit` for context retrieval, independent of the main agent's settings.

## What Changes

- **Schema Update**: Introduce `santi-config` key in the global configuration, mirroring the `llm` structure but adding a `memory_limit` field.
- **CLI Initialization**: Update `morpheus init` to ask for Santi settings, with a convenience option to copy the default LLM configuration.
- **Runtime**: Update the Santi provider initialization to consume `santi-config` instead of the generic `llm` config.

## Capabilities

### New Capabilities
- `santi-configuration`: Defines the new configuration structure and the updated CLI initialization flow.

### Modified Capabilities
<!-- No existing specs are fundamentally changing their requirements, this is an additive configuration change. -->

## Impact

- **Configuration**: Updates `config/schemas.ts` and `config.yaml` structure.
- **CLI**: Updates `src/cli/commands/init.ts` interaction flow.
- **Runtime**: Affects `src/runtime/memory/sati/service.ts` and provider factory instantiation.
