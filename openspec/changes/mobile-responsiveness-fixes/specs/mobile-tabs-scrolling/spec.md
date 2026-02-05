## ADDED Requirements

### Requirement: Mobile tabs scrolling functionality
The system SHALL provide horizontal scrolling for tabs on mobile devices when the content exceeds screen width.

#### Scenario: Tabs scrolling on mobile
- **WHEN** user accesses the configuration page on a mobile device
- **AND** the tabs exceed the screen width
- **THEN** the tabs container SHALL allow horizontal scrolling
- **AND** the user SHALL be able to swipe or scroll horizontally to see all tabs

### Requirement: Responsive tab display
The system SHALL adjust tab display based on screen size.

#### Scenario: Tab display on different screen sizes
- **WHEN** the screen width is less than 768px (mobile/tablet)
- **THEN** tabs SHALL be displayed in a horizontally scrollable container
- **WHEN** the screen width is 768px or greater (desktop)
- **THEN** tabs SHALL be displayed normally without horizontal scrolling constraint