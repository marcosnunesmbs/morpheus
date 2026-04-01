## Why

The Morpheus dashboard currently displays redundant information on mobile devices (Agent Status, Uptime, Version) that is already present in the global footer. Additionally, 3D visualizer labels have a z-index that causes them to bleed through the mobile sidebar, breaking the UI hierarchy.

## What Changes

- **Dashboard**: Hide the "Agent Status", "Uptime", and "Version" StatCards on mobile viewports (lg and below).
- **Visualizer**: Reduce the `zIndexRange` of `Html` labels in both `AgentNode` and `OracleNode` components from `[100, 0]` to `[10, 0]` to prevent them from appearing above the mobile sidebar (which uses `z-50`).

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `ui`: Update dashboard layout for mobile responsiveness and fix visualizer stacking context.

## Impact

- `src/ui/src/pages/Dashboard.tsx`: Layout changes.
- `src/ui/src/components/dashboard/visualizer/AgentNode.tsx`: Z-index adjustment.
- `src/ui/src/components/dashboard/visualizer/OracleNode.tsx`: Z-index adjustment.
