# Sati UI Settings

## Overview
UI components for configuring Sati agent settings in the Settings page, including a toggle to synchronize with Oracle Agent configuration.

## User Stories

### P1: View and Edit Sati Configuration
**As a** Morpheus user  
**I want** to configure Sati's LLM settings independently from Oracle  
**So that** I can optimize the memory agent separately (e.g., use faster/cheaper model)

**Acceptance Criteria:**
- Sati Agent section appears below Oracle Agent section in Settings page
- Section includes fields: Provider, Model, API Key, Memory Limit
- Fields match Oracle Agent field types and validation
- Saving Sati config persists to config file under `santi` key
- Form shows existing Sati config values on load (if present)

### P1: Sync Sati Config with Oracle
**As a** Morpheus user  
**I want** a toggle to use Oracle's configuration for Sati  
**So that** I don't have to duplicate settings when I want them identical

**Acceptance Criteria:**
- Toggle labeled "Use same configuration as Oracle Agent" appears at top of Sati section
- When checked, Sati fields populate with Oracle's current values
- When unchecked, Sati fields become editable independently
- Toggling on copies Oracle config but doesn't lock fields (allows starting from Oracle then customizing)
- Toggle state reflects whether `santi` config exists in file (unchecked if exists, checked if not)

### P2: Clear Visual Distinction
**As a** Morpheus user  
**I want** clear labels distinguishing Oracle and Sati sections  
**So that** I understand which config affects which agent

**Acceptance Criteria:**
- "LLM Configuration" section renamed to "Oracle Agent"
- New section labeled "Sati Agent" (or "Sati Agent (Memory)")
- Sections use same visual styling (cards/borders) for consistency
- Brief description under Sati section: "Configure the LLM used for memory consolidation"

## Functional Requirements

**FR-UI-01** MUST rename existing "LLM Configuration" section to "Oracle Agent"

**FR-UI-02** MUST add new "Sati Agent" section immediately after Oracle Agent section

**FR-UI-03** MUST include toggle "Use same configuration as Oracle Agent" at top of Sati section

**FR-UI-04** Sati section MUST include fields:
- Provider (dropdown: OpenAI, Anthropic, Google Gemini, Ollama)
- Model (text input)
- API Key (password input)
- Memory Limit (number input)

**FR-UI-05** MUST validate Sati config fields using same rules as Oracle config:
- Provider required
- Model required
- API Key optional (but required for non-Ollama providers)
- Memory Limit must be positive integer if provided

**FR-UI-06** MUST show info banner after save: "Restart Morpheus daemon for changes to take effect"

**FR-UI-07** Form submission MUST POST to `/api/config/sati` endpoint

**FR-UI-08** Form load MUST GET from `/api/config/sati` endpoint to populate fields

## Edge Cases

**EC-01** No Sati config in file
- Toggle defaults to checked
- Fields show Oracle's values (grayed out or with helper text)
- Saving with toggle checked stores no `santi` config (uses fallback)

**EC-02** Existing Sati config in file
- Toggle defaults to unchecked
- Fields show Sati's values from config file
- User can toggle on to sync with Oracle

**EC-03** Invalid API key format
- Show error message matching Oracle config validation
- Prevent form submission

**EC-04** Network error on save
- Show error toast/banner with retry option
- Don't clear form fields

## Non-Functional Requirements

**NFR-01** Form fields MUST match styling of existing Settings page

**NFR-02** Toggle interaction MUST feel responsive (<100ms to update fields)

**NFR-03** Section MUST be accessible via keyboard navigation

## Dependencies
- Existing Settings page component (`src/ui/src/pages/Settings.tsx`)
- Existing LLM config form patterns
- API endpoints for Sati config (see `sati-api-endpoints` spec)

## Success Metrics
- Users can successfully configure Sati independently
- Toggle behavior is intuitive (no support requests about confusion)
- Form validation catches same errors as Oracle config
