## Context

The dashboard UI uses a flex layout where status cards are shown in a column on the right (desktop) or below the visualizer (mobile). The visualizer uses `@react-three/drei`'s `Html` component to render labels in the DOM, which can conflict with traditional CSS z-indexing if not properly constrained.

## Goals / Non-Goals

**Goals:**
- Hide redundant StatCards on mobile viewports.
- Ensure visualizer labels stay behind the mobile sidebar.

**Non-Goals:**
- Redesigning the StatCards themselves.
- Changing the layout for non-dashboard pages.
- Modifying the mobile sidebar's z-index (kept at 50 for consistency).

## Decisions

### 1. Tailwind Responsive Classes for StatCards
- **Decision**: Use `hidden lg:flex` on the container div of the `StatCard` components in `Dashboard.tsx`.
- **Rationale**: This is the idiomatic Tailwind approach for responsive visibility. It's low-impact and easy to maintain.
- **Alternatives**: Conditional rendering in JS (e.g., `window.innerWidth`), but this is less performant and can cause hydration mismatches.

### 2. Restrict Html Label zIndexRange
- **Decision**: Update `AgentNode.tsx` and `OracleNode.tsx` to use `zIndexRange={[10, 0]}`.
- **Rationale**: The default `[100, 0]` allows labels to exceed the sidebar's `z-50`. By capping at `z-10`, we guarantee they remain behind the sidebar and other overlays while still staying above the 3D canvas itself.
- **Alternatives**: Increasing the sidebar's z-index to `101`, but this could lead to a "z-index war" with other components like modals or tooltips.

## Risks / Trade-offs

- **[Risk]** → Labels might overlap with other dashboard elements if they are also using low z-indices.
  - **Mitigation** → Verified that most dashboard UI elements are standard flow or have explicit `z-10` for specific overlays, so `z-10` for labels is safe.
