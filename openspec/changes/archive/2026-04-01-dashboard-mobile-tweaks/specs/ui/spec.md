## ADDED Requirements

### Requirement: Mobile-Responsive Dashboard Status Cards
The system SHALL hide redundant status information on mobile viewports to prioritize essential dashboard content.

#### Scenario: Hide Status Cards on Mobile
- **WHEN** the dashboard is viewed on a viewport width less than 1024px (Tailwind `lg` breakpoint)
- **THEN** the "Agent Status", "Uptime", and "Version" StatCards SHALL be hidden from view.

#### Scenario: Show Status Cards on Desktop
- **WHEN** the dashboard is viewed on a viewport width of 1024px or greater (Tailwind `lg` breakpoint)
- **THEN** the "Agent Status", "Uptime", and "Version" StatCards SHALL be visible in the sidebar layout.

### Requirement: Visualizer Label Z-Index Management
The 3D visualizer's HTML labels SHALL have a restricted z-index range to ensure correct UI stacking when mobile overlays are active.

#### Scenario: Visualizer Labels stay behind Mobile Sidebar
- **WHEN** the 3D visualizer is active and the mobile sidebar (z-50) is opened
- **THEN** the visualizer's HTML labels MUST NOT appear above the sidebar.
