## ADDED Requirements

### Requirement: Mobile sidebar toggle functionality
The system SHALL provide a mechanism to toggle the visibility of the sidebar on mobile devices.

#### Scenario: Toggle sidebar on mobile
- **WHEN** user accesses the application on a mobile device
- **THEN** the sidebar SHOULD be hidden by default and accessible via a toggle button

### Requirement: Responsive sidebar behavior
The system SHALL automatically adjust the sidebar visibility based on screen size.

#### Scenario: Sidebar visibility on different screen sizes
- **WHEN** the screen width is less than 768px (mobile/tablet)
- **THEN** the sidebar SHALL be collapsible and accessible via a header menu
- **WHEN** the screen width is 768px or greater (desktop)
- **THEN** the sidebar SHALL remain visible by default

### Requirement: Mobile header menu
The system SHALL display a header menu button on mobile devices to control the sidebar visibility.

#### Scenario: Mobile header menu interaction
- **WHEN** user clicks the header menu button on a mobile device
- **THEN** the sidebar SHALL slide in from the left side of the screen
- **WHEN** user clicks the close button or outside the sidebar area
- **THEN** the sidebar SHALL slide back out of view