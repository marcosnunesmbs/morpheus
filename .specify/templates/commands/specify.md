# Specify Command Documentation

## Command
`speckit.specify`

## Purpose
Creates a comprehensive feature specification (`spec.md`) from a user request, defining user stories, requirements, and acceptance criteria.

## When to Use
- Starting a new feature development
- Documenting user requirements
- Before creating an implementation plan

## Prerequisites
- User must provide a feature description
- Constitution should be defined (for alignment checks)

## Execution Flow

1. **Capture User Intent**: Understand the feature request
2. **Define User Stories**: Create prioritized user journeys
3. **Specify Requirements**: Define functional and non-functional requirements
4. **Define Edge Cases**: Identify boundary conditions
5. **Create Acceptance Criteria**: Define testable outcomes
6. **Entity Identification**: List key data entities (if applicable)

## User Story Structure

Each user story must include:
- **Priority**: P1 (critical), P2 (important), P3 (nice-to-have)
- **Independent Test**: How to verify in isolation
- **Acceptance Scenarios**: Given-When-Then format
- **Value Justification**: Why this priority level

## Output

Creates `specs/###-feature-name/spec.md` with:
- Prioritized user stories
- Functional requirements
- Edge cases
- Key entities
- Acceptance criteria

## Agent-Specific Guidance

This command is agent-agnostic and can be executed by any AI assistant with access to the project context.
